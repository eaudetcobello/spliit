import { addExpense, createGroup, openExpense, uniqueSuffix } from './app'
import { expect, test } from './fixtures'
import { fieldByLabel, fillStable, selectRadixOption } from './ui'

test('opens groups at home without branding or language controls', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/groups$/)
  await expect(page.getByRole('heading', { name: 'My groups' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'English', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('banner').locator('img')).toHaveCount(1)
  await expect(page).not.toHaveTitle(/Spliit/)
})

test('shows balances and reimbursements in one card before expenses', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Combined ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await addExpense(page, groupId, {
    title: 'Dinner',
    amount: '60',
    paidBy: 'Alice',
  })
  await expect(
    page.getByRole('tab', { name: 'Balances', exact: true }),
  ).toHaveCount(0)
  const card = page.getByTestId('balances-card')
  await expect(
    card.getByRole('heading', { name: 'Balances', exact: true }),
  ).toBeVisible()
  await expect(
    card.getByRole('heading', { name: 'Suggested reimbursements' }),
  ).toBeVisible()
  await expect(card.getByTestId('reimbursement-row')).toContainText(
    'Bob owes Alice',
  )
  const summary = await card.boundingBox()
  const list = await page.getByTestId('expense-card').first().boundingBox()
  expect(summary && list && summary.y + summary.height <= list.y).toBeTruthy()
  await page.goto(`/groups/${groupId}/balances`)
  await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/expenses$`))
})

test('creates a simple expense with the hidden field defaults', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Simple ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await page.goto(`/groups/${groupId}/expenses/create`)
  await expect(
    page.getByRole('button', { name: 'Simple', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  for (const label of [
    'Currency of expense',
    'Category',
    'Expense Recurrence',
  ]) {
    await expect(fieldByLabel(page, label)).toHaveCount(0)
  }
  await expect(page.locator('textarea[name="notes"]')).toHaveCount(0)
  await fillStable(page.locator('input[name="title"]'), 'Lunch')
  await fillStable(page.locator('input[name="amount"]'), '25')
  await selectRadixOption(page, page.getByTestId('paid-by'), 'Alice')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(new RegExp(`/groups/${groupId}/expenses$`))
  const data = await (
    await page.request.get(`/groups/${groupId}/expenses/export/json`)
  ).json()
  expect(data.expenses).toHaveLength(1)
  expect(data.expenses[0]).toMatchObject({
    title: 'Lunch',
    amount: 2500,
    notes: '',
    recurrenceRule: 'NONE',
    originalCurrency: null,
    originalAmount: null,
    category: { name: 'General' },
  })
})

test('keeps advanced values when switching modes and saving', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Advanced ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await page.goto(`/groups/${groupId}/expenses/create`)
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await fillStable(page.locator('input[name="title"]'), 'Household shop')
  await fillStable(page.locator('input[name="amount"]'), '40')
  await selectRadixOption(page, page.getByTestId('paid-by'), 'Bob')
  await selectRadixOption(
    page,
    fieldByLabel(page, 'Category').getByRole('combobox'),
    'Groceries',
  )
  await fillStable(page.locator('textarea[name="notes"]'), 'Keep this note')
  await selectRadixOption(
    page,
    fieldByLabel(page, 'Expense Recurrence').getByRole('combobox'),
    'Monthly',
  )
  await page.getByRole('button', { name: 'Simple', exact: true }).click()
  await expect(page.locator('textarea[name="notes"]')).toHaveCount(0)
  await expect(page.locator('input[name="title"]')).toHaveValue(
    'Household shop',
  )
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.locator('textarea[name="notes"]')).toHaveValue(
    'Keep this note',
  )
  await expect(
    fieldByLabel(page, 'Category').getByRole('combobox'),
  ).toContainText('Groceries')
  await expect(
    fieldByLabel(page, 'Expense Recurrence').getByRole('combobox'),
  ).toContainText('Monthly')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(new RegExp(`/groups/${groupId}/expenses$`))
  await openExpense(page, 'Household shop')
  await expect(page.locator('textarea[name="notes"]')).toHaveValue(
    'Keep this note',
  )
  await expect(
    fieldByLabel(page, 'Expense Recurrence').getByRole('combobox'),
  ).toContainText('Monthly')
})
