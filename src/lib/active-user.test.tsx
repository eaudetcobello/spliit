import { act, renderHook } from '@testing-library/react'
import { readActiveUser, saveActiveUser } from './active-user'
import { useActiveUser } from './hooks'

beforeEach(() => localStorage.clear())

it('keeps the selected participant after the view is remounted', () => {
  saveActiveUser('trip', 'john')
  const first = renderHook(() => useActiveUser('trip'))
  expect(first.result.current).toBe('john')
  first.unmount()
  const nextSession = renderHook(() => useActiveUser('trip'))
  expect(nextSession.result.current).toBe('john')
  expect(readActiveUser('trip')).toBe('john')
})

it('updates every mounted view immediately when the participant is changed', () => {
  const first = renderHook(() => useActiveUser('trip'))
  const second = renderHook(() => useActiveUser('trip'))
  act(() => saveActiveUser('trip', 'jane'))
  expect(first.result.current).toBe('jane')
  expect(second.result.current).toBe('jane')
  act(() => saveActiveUser('trip', 'john'))
  expect(first.result.current).toBe('john')
  expect(second.result.current).toBe('john')
})

it('keeps different groups independent and clears the previous group identity', () => {
  saveActiveUser('trip', 'john')
  const { result, rerender } = renderHook(
    ({ groupId }) => useActiveUser(groupId),
    {
      initialProps: { groupId: 'trip' },
    },
  )
  expect(result.current).toBe('john')
  rerender({ groupId: 'household' })
  expect(result.current).toBeNull()
  act(() => saveActiveUser('household', 'jane'))
  expect(result.current).toBe('jane')
  expect(readActiveUser('trip')).toBe('john')
})

it('responds to identity changes and storage loss in another tab', () => {
  saveActiveUser('trip', 'john')
  const { result } = renderHook(() => useActiveUser('trip'))
  act(() => {
    localStorage.setItem('trip-activeUser', 'jane')
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'trip-activeUser' }),
    )
  })
  expect(result.current).toBe('jane')
  act(() => {
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
  })
  expect(result.current).toBeNull()
})
