import {
  addExpense,
  createGroup,
  expectBalance,
  EXPENSES_URL,
  openTab,
  paidForRow,
  reimbursementRow,
  uniqueSuffix,
  useAdvancedMode,
} from './app'
import { expect, test } from './fixtures'
import { money } from './ui'

test('settles a debt through "Settle up"', async ({ page }) => {
  // Two participants, so the suggested reimbursement is unique and deterministic.
  const groupId = await createGroup(page, {
    name: `E2E Reimbursement ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })

  await addExpense(page, groupId, {
    title: 'Hotel',
    amount: '100',
    paidBy: 'Alice',
  })

  await openTab(page, 'Expenses')
  await expectBalance(page, 'Alice', 50)
  await expectBalance(page, 'Bob', -50)

  const row = reimbursementRow(page, 'Bob', 'Alice')
  await expect(row).toContainText('Bob owes Alice')
  await expect(row).toContainText(money(50))

  await row.getByRole('link', { name: 'Settle up' }).click()
  await page.waitForURL(/\/expenses\/create\?.*reimbursement=yes/, {
    timeout: 30_000,
  })

  // Simple mode shows only who paid whom and how much.
  await expect(
    page.getByRole('heading', { name: 'Record a payment' }),
  ).toBeVisible()
  await expect(page.getByTestId('repayment-summary')).toHaveText(
    'Bob paid Alice',
  )
  await expect(page.locator('input[name="title"]')).toHaveCount(0)
  await expect(page.locator('input[name="amount"]')).toHaveValue(/^50/)

  // The link prefills the whole form from its query string.
  await useAdvancedMode(page)
  await expect(page.locator('input[name="title"]')).toHaveValue('Reimbursement')
  await expect(page.getByTestId('paid-by')).toContainText('Bob')
  await expect(paidForRow(page, 'Alice').getByRole('checkbox')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(paidForRow(page, 'Bob').getByRole('checkbox')).toHaveAttribute(
    'aria-checked',
    'false',
  )

  await page
    .getByRole('button', { name: 'Record a payment', exact: true })
    .click()
  await page.waitForURL(EXPENSES_URL, { timeout: 30_000 })

  await expect(
    page.getByTestId('expense-card').filter({ hasText: 'Reimbursement' }),
  ).toBeVisible()

  await openTab(page, 'Expenses')
  await expectBalance(page, 'Alice', 0)
  await expectBalance(page, 'Bob', 0)
  await expect(page.getByText('Everyone is settled up.')).toBeVisible()
})
