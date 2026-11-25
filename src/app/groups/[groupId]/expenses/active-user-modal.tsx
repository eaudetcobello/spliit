'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { readActiveUser, saveActiveUser } from '@/lib/active-user'
import { useActiveUser, useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { useTranslations } from 'next-intl'
import { ComponentProps, useEffect, useState } from 'react'

export function ActiveUserModal({ groupId }: { groupId: string }) {
  const t = useTranslations('Expenses.ActiveUserModal')
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })

  const group = groupData?.group
  const activeUser = useActiveUser(groupId)

  useEffect(() => {
    if (!group) return

    const tempUser = localStorage.getItem(`newGroup-activeUser`)
    const stored = readActiveUser(group.id)
    const isValid =
      stored === 'None' || group.participants.some((p) => p.id === stored)
    if (!tempUser && !isValid) {
      setOpen(true)
    }
  }, [group, activeUser])

  function updateOpen(open: boolean) {
    if (!group) return

    if (!open && !localStorage.getItem(`${group.id}-activeUser`)) {
      saveActiveUser(group.id, 'None')
    }
    setOpen(open)
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={updateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <ActiveUserForm
            group={group}
            activeUser={activeUser}
            close={() => setOpen(false)}
          />
          <DialogFooter className="sm:justify-center">
            <p className="text-sm text-center text-muted-foreground">
              {t('footer')}
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={updateOpen}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DrawerHeader>
        <ActiveUserForm
          className="px-4"
          group={group}
          activeUser={activeUser}
          close={() => setOpen(false)}
        />
        <DrawerFooter className="pt-2">
          <p className="text-sm text-center text-muted-foreground">
            {t('footer')}
          </p>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ActiveUserForm({
  group,
  close,
  className,
  activeUser,
}: ComponentProps<'form'> & {
  group?: AppRouterOutput['groups']['get']['group']
  close: () => void
  activeUser: string | null
}) {
  const t = useTranslations('Expenses.ActiveUserModal')
  const [selected, setSelected] = useState(
    group?.participants.some((p) => p.id === activeUser) ? activeUser! : 'None',
  )

  return (
    <form
      className={cn('grid items-start gap-4', className)}
      onSubmit={(event) => {
        if (!group) return

        event.preventDefault()
        saveActiveUser(group.id, selected)
        close()
      }}
    >
      <RadioGroup value={selected} onValueChange={setSelected}>
        <div className="flex flex-col gap-4 my-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="None" id="none" />
            <Label htmlFor="none" className="italic font-normal flex-1">
              {t('nobody')}
            </Label>
          </div>
          {group?.participants.map((participant) => (
            <div key={participant.id} className="flex items-center space-x-2">
              <RadioGroupItem value={participant.id} id={participant.id} />
              <Label htmlFor={participant.id} className="flex-1">
                {participant.name}
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>
      <Button type="submit">{t('save')}</Button>
    </form>
  )
}
