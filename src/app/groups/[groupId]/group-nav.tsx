'use client'

import { cn } from '@/lib/utils'
import { Activity, BarChart3, Receipt, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ComponentType, ReactNode } from 'react'

type Section = {
  value: string
  label: string
  Icon: ComponentType<{ className?: string }>
}

function useSections(groupId: string) {
  const t = useTranslations()
  const pathname = usePathname()
  const current =
    pathname.replace(/\/groups\/[^\/]+\/([^/]+).*/, '$1') || 'expenses'

  const sections: Section[] = [
    { value: 'expenses', label: t('Expenses.title'), Icon: Receipt },
    { value: 'stats', label: t('Stats.title'), Icon: BarChart3 },
    { value: 'activity', label: t('Activity.title'), Icon: Activity },
    { value: 'edit', label: t('Settings.title'), Icon: Settings },
  ]

  return sections.map((section) => ({
    ...section,
    href: `/groups/${groupId}/${section.value}`,
    isActive: section.value === current,
  }))
}

/** Underlined section links under the group name, from the md breakpoint up. */
export function GroupDesktopNav({
  groupId,
  actions,
}: {
  groupId: string
  actions?: ReactNode
}) {
  const sections = useSections(groupId)

  return (
    <div className="hidden md:flex items-end justify-between gap-4 border-b">
      <nav aria-label="Group" className="flex -mb-px">
        {sections.map(({ value, label, Icon, href, isActive }) => (
          <Link
            key={value}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
      {actions && <div className="pb-2">{actions}</div>}
    </div>
  )
}

/** Bottom tab bar below the md breakpoint. */
export function GroupMobileNav({ groupId }: { groupId: string }) {
  const sections = useSections(groupId)

  return (
    <>
      {/* Keeps the end of the page clear of the fixed bar. */}
      <div aria-hidden className="h-20 md:hidden" />
      <nav
        aria-label="Group"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-4">
          {sections.map(({ value, label, Icon, href, isActive }) => (
            <li key={value}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 pt-2 pb-2.5 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-primary/10',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
