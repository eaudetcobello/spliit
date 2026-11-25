import { getTranslations } from 'next-intl/server'
import { SettleUpForm } from './settle-up-form'

export async function generateMetadata() {
  const t = await getTranslations('SettleUp')
  return { title: t('title') }
}

export default async function SettleUpPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  return <SettleUpForm groupId={groupId} />
}
