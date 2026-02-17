import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getActiveRows, addRow, getRowById, updateRow, deleteRow } from './storage'

vi.mock('./firebaseClosedRows', () => ({
  addClosedRowToFirebase: vi.fn(() => Promise.resolve()),
  deleteClosedRowFromFirebase: vi.fn(() => Promise.resolve()),
}))

const store: Record<string, string> = {}
const fakeLocalStorage = {
  getItem(key: string) {
    return store[key] ?? null
  },
  setItem(key: string, value: string) {
    store[key] = value
  },
  removeItem(key: string) {
    delete store[key]
  },
  clear() {
    for (const k of Object.keys(store)) delete store[k]
  },
  get length() {
    return Object.keys(store).length
  },
  key() {
    return null
  },
}

describe('storage (active rows only)', () => {
  const BRANCH = 'corniche' as const

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage)
    delete store['cashbox_rows_corniche']
    delete store['cashbox_rows_andalusia']
  })

  it('getActiveRows returns empty array when no data', () => {
    expect(getActiveRows(BRANCH)).toEqual([])
  })

  it('addRow adds a row and getActiveRows returns it', () => {
    addRow(BRANCH, 'أحمد')
    const rows = getActiveRows(BRANCH)
    expect(rows.length).toBe(1)
    expect(rows[0]!.employeeName).toBe('أحمد')
    expect(rows[0]!.status).toBe('active')
    expect(rows[0]!.id).toBeDefined()
  })

  it('getRowById returns row by id', () => {
    addRow(BRANCH, 'محمد')
    const rows = getActiveRows(BRANCH)
    const id = rows[0]!.id
    expect(getRowById(BRANCH, id)?.employeeName).toBe('محمد')
    expect(getRowById(BRANCH, 'invalid')).toBeNull()
  })

  it('updateRow patches row', () => {
    addRow(BRANCH, 'خالد')
    const rows = getActiveRows(BRANCH)
    const id = rows[0]!.id
    updateRow(BRANCH, id, { cash: 100, notes: 'ملاحظة' })
    const updated = getRowById(BRANCH, id)
    expect(updated!.cash).toBe(100)
    expect(updated!.notes).toBe('ملاحظة')
  })

  it('deleteRow removes active row', async () => {
    addRow(BRANCH, 'علي')
    const rows = getActiveRows(BRANCH)
    const id = rows[0]!.id
    await deleteRow(BRANCH, id, false)
    expect(getActiveRows(BRANCH).length).toBe(0)
    expect(getRowById(BRANCH, id)).toBeNull()
  })
})
