import { describe, it, expect } from 'vitest'
import { parseBankTransactionsExcel } from './excelParser'

describe('excelParser', () => {
  it('returns error for empty buffer', () => {
    const result = parseBankTransactionsExcel(new ArrayBuffer(0), new Date())
    expect(result.error).toBeTruthy()
    expect(result.sums.cash).toBe(0)
    expect(result.sums.mada).toBe(0)
    expect(result.sums.visa).toBe(0)
    expect(result.employeeName).toBeNull()
  })

  it('returns error for invalid/empty file (no sheet)', () => {
    const result = parseBankTransactionsExcel(new ArrayBuffer(100), new Date())
    expect(result.error).toBeTruthy()
  })

  it('returns zero sums and null error when afterDate is used (no rows after date)', () => {
    const future = new Date(Date.now() + 86400000 * 365)
    const result = parseBankTransactionsExcel(new ArrayBuffer(0), future)
    expect(result.sums.cash).toBe(0)
    expect(result.sums.mada).toBe(0)
  })
})
