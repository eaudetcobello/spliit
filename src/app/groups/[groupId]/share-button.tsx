'use client'

import { CopyButton } from '@/components/copy-button'
import { ShareQrCodeDialog } from '@/components/share-qr-code-dialog'
import { ShareUrlButton } from '@/components/share-url-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Group } from '@/generated/prisma/browser'
import { useBaseUrl } from '@/lib/hooks'
import { MoreVertical, Share } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/** The group's three-dot menu in the header. Sharing opens a dialog. */
export function GroupActionsMenu({ group }: { group: Group }) {
  const t = useTranslations('Share')
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      {/* Not modal, so closing it does not fight the dialog it opens over
          focus and pointer events. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            title={t('groupActions')}
            aria-label={t('groupActions')}
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0 text-muted-foreground"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => setShareOpen(true)}
          >
            <Share className="w-4 h-4" />
            {t('title')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareDialog group={group} open={shareOpen} onOpenChange={setShareOpen} />
    </>
  )
}

function ShareDialog({
  group,
  open,
  onOpenChange,
}: {
  group: Group
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('Share')
  const baseUrl = useBaseUrl()
  const url = baseUrl && `${baseUrl}/groups/${group.id}/expenses?ref=share`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        {url && (
          <div className="flex gap-2">
            <Input className="flex-1" defaultValue={url} readOnly />
            <CopyButton text={url} title={t('copyLink')} />
            <ShareUrlButton
              text={`Join my expense group ${group.name}`}
              url={url}
              title={t('shareLink')}
            />
            <ShareQrCodeDialog url={url} groupName={group.name} />
          </div>
        )}
        <p className="text-sm">
          <strong>{t('warning')}</strong> {t('warningHelp')}
        </p>
      </DialogContent>
    </Dialog>
  )
}
