'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAnalytics } from '@/lib/analytics/context'
import { useActiveUser } from '@/lib/hooks'
import { randomId } from '@/lib/random'
import {
  amountAsDecimal,
  amountAsMinorUnits,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, ReactNode, useState } from 'react'

/**
 * "Settle up": records that one participant paid another back, as a
 * reimbursement expense. Opened from a debt on the Balances card, which
 * passes who pays (`from`), who is paid (`to`) and the amount in minor units.
 */
export function SettleUpForm({ groupId }: { groupId: string }) {
  const t = useTranslations('SettleUp')
  const tExpense = useTranslations('ExpenseForm')
  const searchParams = useSearchParams()
  const router = useRouter()
  const utils = trpc.useUtils()
  const sendEvent = useAnalytics()
  const activeUser = useActiveUser(groupId)
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const group = groupData?.group
  const { mutateAsync: createExpense } =
    trpc.groups.expenses.create.useMutation()

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const initialMinor = Number(searchParams.get('amount')) || 0

  const [amount, setAmount] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [expenseId, setExpenseId] = useState(() => randomId())

  if (!group) return null

  const currency = getCurrencyFromGroup(group)
  const amountValue =
    amount ?? String(amountAsDecimal(initialMinor, currency, true))
  const name = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? ''
  const isValidPair = !!name(from) && !!name(to) && from !== to

  const strong = (chunks: ReactNode) => (
    <strong className="font-semibold">{chunks}</strong>
  )
  const sentence =
    from === activeUser
      ? t.rich('youPaid', { to: name(to), strong })
      : to === activeUser
        ? t.rich('paidYou', { from: name(from), strong })
        : t.rich('paid', { from: name(from), to: name(to), strong })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = Number(amountValue.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('invalidAmount'))
      return
    }
    setError(null)
    setIsSaving(true)
    const now = new Date()
    try {
      await createExpense({
        groupId,
        expenseId,
        participantId:
          activeUser && activeUser !== 'None' ? activeUser : undefined,
        expenseFormValues: {
          expenseDate: new Date(
            Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
          ),
          title: tExpense('reimbursement'),
          category: 1, // Payment
          amount: amountAsMinorUnits(value, currency),
          paidBy: from,
          paidFor: [{ participant: to, shares: '1' }],
          splitMode: 'EVENLY',
          saveDefaultSplittingOptions: false,
          isReimbursement: true,
          documents: [],
          notes: '',
          recurrenceRule: 'NONE',
        },
      })
    } catch (e) {
      // The server may have saved it and only the response was lost; a retry
      // with the same id would collide with it.
      setExpenseId(randomId())
      setIsSaving(false)
      setError(t('error'))
      return
    }
    sendEvent(
      { event: 'expense: create', props: {} },
      `/groups/${groupId}/expenses`,
    )
    utils.groups.expenses.invalidate()
    utils.groups.balances.invalidate()
    utils.groups.stats.invalidate()
    router.push(`/groups/${groupId}/expenses`)
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isValidPair ? (
            <p className="text-lg" data-testid="settle-up-summary">
              {sentence}
            </p>
          ) : (
            <p className="text-destructive">{t('unknownParticipants')}</p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="settle-up-amount">{t('amount')}</Label>
            <div className="flex items-baseline gap-2">
              <span className="text-lg">{group.currency}</span>
              <Input
                id="settle-up-amount"
                name="amount"
                className="text-2xl h-12 max-w-[180px]"
                type="text"
                inputMode="decimal"
                value={amountValue}
                onChange={(event) => {
                  setAmount(event.target.value.replace(/[^\d.,]/g, ''))
                  setError(null)
                }}
                onFocus={(event) => {
                  const target = event.currentTarget
                  setTimeout(() => target.select(), 1)
                }}
                aria-invalid={!!error}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col sm:flex-row mt-4 gap-2">
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={!isValidPair || isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? t('saving') : t('submit')}
        </Button>
        <Button variant="ghost" className="w-full sm:w-auto" asChild>
          <Link href={`/groups/${groupId}/expenses`}>{t('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
