import { redirect } from 'next/navigation'

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  redirect(`/groups/${groupId}/expenses`)
}
