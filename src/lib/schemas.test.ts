import { expenseFormSchema } from './schemas'

function byAmountExpense(amount: string, shares: string[]) {
  return {
    expenseDate: new Date('2026-09-01'),
    title: 'Dinner',
    amount,
    paidBy: 'a',
    splitMode: 'BY_AMOUNT',
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    paidFor: shares.map((shares, i) => ({ participant: `p${i}`, shares })),
  }
}

function issueMessages(input: unknown): string[] {
  const result = expenseFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('expenseFormSchema, split by amount', () => {
  it('accepts amounts that add up to the expense amount', () => {
    expect(
      issueMessages(
        byAmountExpense('524.34', [
          '110.11',
          '209.74',
          '104.87',
          '89.14',
          '10.48',
        ]),
      ),
    ).toEqual([])
  })

  it('rejects amounts one cent off', () => {
    expect(
      issueMessages(
        byAmountExpense('524.34', [
          '110.11',
          '209.74',
          '104.87',
          '89.14',
          '10.49',
        ]),
      ),
    ).toEqual(['amountSum'])
  })

  it('sums amounts typed with a decimal comma', () => {
    expect(
      issueMessages(byAmountExpense('100', ['50', '30', '20,00'])),
    ).toEqual([])
  })

  it('reports an emptied amount instead of throwing on it', () => {
    expect(issueMessages(byAmountExpense('100', ['60', '']))).toEqual([
      'noZeroShares',
      'amountSum',
    ])
  })
})

describe('expenseFormSchema, expense date', () => {
  it('keeps only the UTC calendar day, as the old DATE column did', () => {
    const result = expenseFormSchema.parse({
      ...byAmountExpense('10', ['10']),
      expenseDate: new Date('2026-09-01T23:30:15.250Z'),
    })
    expect(result.expenseDate.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  it('reads a date-only string as that day', () => {
    const result = expenseFormSchema.parse({
      ...byAmountExpense('10', ['10']),
      expenseDate: '2026-02-28',
    })
    expect(result.expenseDate.toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })
})
