'use client'

import { ActiveUserModal } from '@/app/groups/[groupId]/expenses/active-user-modal'
import { GroupDesktopNav } from '@/app/groups/[groupId]/group-nav'
import { ShareButton } from '@/app/groups/[groupId]/share-button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { useCurrentGroup } from './current-group-context'

export const GroupHeader = () => {
  const { isLoading, groupId, group } = useCurrentGroup()

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-bold text-2xl min-w-0 truncate">
          <Link href={`/groups/${groupId}`}>
            {isLoading ? (
              <Skeleton className="mt-1.5 mb-1.5 h-5 w-32" />
            ) : (
              group.name
            )}
          </Link>
        </h1>
        {group && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <ActiveUserModal groupId={groupId} />
            {/* On mobile, sharing sits with the other header actions; on
                desktop it moves to the end of the section nav. */}
            <ShareButton group={group} className="md:hidden" />
          </div>
        )}
      </div>

      <GroupDesktopNav
        groupId={groupId}
        actions={group && <ShareButton group={group} variant="labeled" />}
      />
    </div>
  )
}
