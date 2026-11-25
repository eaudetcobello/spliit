export const ACTIVE_USER_CHANGED = 'active-user-changed'

export function readActiveUser(groupId: string): string | null {
  return localStorage.getItem(`${groupId}-activeUser`)
}

export function saveActiveUser(groupId: string, participantId: string) {
  localStorage.setItem(`${groupId}-activeUser`, participantId)
  window.dispatchEvent(new Event(ACTIVE_USER_CHANGED))
}
