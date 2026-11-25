'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Participant } from '@/generated/prisma/browser'
import { Balances, Reimbursement } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { useActiveUser } from '@/lib/hooks'
import { cn, formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { ReactNode, useEffect } from 'react'
import { useCurrentGroup } from '../current-group-context'

/**
 * Who owes whom, phrased from the active user's side ("Alice owes you
 * $10.00", "You owe Bob $5.00"), each with a "Settle up" link that pre-fills
 * the payment. Everyone's net balance is one click away.
 */
export default function BalancesAndReimbursements() {
  const utils = trpc.useUtils()
  const { groupId, group } = useCurrentGroup()
  const { data: balancesData, isLoading: balancesAreLoading } =
    trpc.groups.balances.list.useQuery({ groupId })
  const t = useTranslations('Balances')
  const activeUser = useActiveUser(groupId)

  useEffect(() => {
    // Until we use tRPC more widely and can invalidate the cache on expense
    // update, it's easier and safer to invalidate the cache on page load.
    utils.groups.balances.invalidate()
  }, [utils])

  const isLoading = balancesAreLoading || !balancesData || !group

  return (
    <Card
      className="mb-4 rounded-none -mx-4 border-x-0 sm:border-x sm:rounded-lg sm:mx-0"
      data-testid="balances-card"
    >
      <CardHeader className="pb-2">
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <BalancesLoading />
        ) : (
          <>
            <Debts
              reimbursements={balancesData.reimbursements}
              participants={group.participants}
              currency={getCurrencyFromGroup(group)}
              groupId={groupId}
              activeUser={activeUser}
            />
            <EveryonesBalance
              balances={balancesData.balances}
              participants={group.participants}
              currency={getCurrencyFromGroup(group)}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Debts({
  reimbursements,
  participants,
  currency,
  groupId,
  activeUser,
}: {
  reimbursements: Reimbursement[]
  participants: Participant[]
  currency: Currency
  groupId: string
  activeUser: string | null
}) {
  const t = useTranslations('Balances')
  const locale = useLocale()
  const name = (id: string) => participants.find((p) => p.id === id)?.name ?? ''
  const isMe = (id: string) => !!activeUser && id === activeUser

  if (reimbursements.length === 0) {
    return <p className="py-2">{t('allSettled')}</p>
  }

  // The active user's own debts first.
  const sorted = [...reimbursements].sort(
    (a, b) =>
      Number(isMe(b.from) || isMe(b.to)) - Number(isMe(a.from) || isMe(a.to)),
  )
  const involvesMe = sorted.some((r) => isMe(r.from) || isMe(r.to))

  return (
    <ul className="divide-y">
      {activeUser && activeUser !== 'None' && !involvesMe && (
        <li className="py-3">{t('youAreSettled')}</li>
      )}
      {sorted.map((reimbursement) => {
        const { from, to, amount } = reimbursement
        const formatted = formatCurrency(currency, amount, locale)
        const amountTag = (tone: 'positive' | 'negative' | 'neutral') =>
          function Amount(chunks: ReactNode) {
            return (
              <strong
                className={cn(
                  'font-semibold whitespace-nowrap',
                  tone === 'positive' && 'text-green-600 dark:text-green-500',
                  tone === 'negative' && 'text-red-600 dark:text-red-500',
                )}
              >
                {chunks}
              </strong>
            )
          }
        const strong = (chunks: ReactNode) => (
          <strong className="font-semibold">{chunks}</strong>
        )
        const sentence = isMe(to)
          ? t.rich('owesYou', {
              from: name(from),
              amount: formatted,
              strong,
              money: amountTag('positive'),
            })
          : isMe(from)
            ? t.rich('youOwe', {
                to: name(to),
                amount: formatted,
                strong,
                money: amountTag('negative'),
              })
            : t.rich('owes', {
                from: name(from),
                to: name(to),
                amount: formatted,
                strong,
                money: amountTag('neutral'),
              })
        const mine = isMe(from) || isMe(to)

        return (
          <li
            key={`${from}-${to}`}
            data-testid="reimbursement-row"
            data-from={name(from)}
            data-to={name(to)}
            className={cn(
              'flex items-center justify-between gap-3 py-3',
              activeUser && !mine && 'text-muted-foreground text-sm',
            )}
          >
            <span>{sentence}</span>
            <Button
              asChild
              size="sm"
              variant={mine ? 'default' : 'outline'}
              className="flex-shrink-0"
            >
              <Link
                href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${from}&to=${to}&amount=${amount}`}
              >
                {t('settleUp')}
              </Link>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function EveryonesBalance({
  balances,
  participants,
  currency,
}: {
  balances: Balances
  participants: Participant[]
  currency: Currency
}) {
  const t = useTranslations('Balances')
  const locale = useLocale()

  // A native <details> rather than a Collapsible: it keeps the rows in the
  // page while closed, so they stay searchable and readable by tests.
  return (
    <details className="group mt-2 border-t pt-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        {t('everyone')}
      </summary>
      <ul className="mt-2">
        {participants.map((participant) => {
          const balance = balances[participant.id]?.total ?? 0
          return (
            <li
              key={participant.id}
              data-testid="balance-row"
              data-participant={participant.name}
              className="flex justify-between py-1"
            >
              <span>{participant.name}</span>
              <span
                className={cn(
                  balance > 0 && 'text-green-600 dark:text-green-500',
                  balance < 0 && 'text-red-600 dark:text-red-500',
                  balance === 0 && 'text-muted-foreground',
                )}
              >
                {formatCurrency(currency, balance, locale)}
              </span>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

const BalancesLoading = () => (
  <div className="flex flex-col divide-y">
    {[0, 1].map((index) => (
      <div key={index} className="flex items-center justify-between py-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-20" />
      </div>
    ))}
  </div>
)
