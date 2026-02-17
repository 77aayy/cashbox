import { describe, it, expect, beforeEach, vi } from 'vitest'

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

describe('storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage)
    store['cashbox_rows'] = undefined as unknown as string
    delete store['cashbox_rows']
  })

  beforeEach(async () => {
    const { getRows, addRow, closeRow, deleteRow, deleteAllClosedRows, getRowById, updateRow, getClosedForPrint } = await import('./storage')
    ;(globalThis as unknown as { __storage: typeof import('./storage') }).__storage = {
      getRows,
      addRow,
      closeRow,
      deleteRow,
      deleteAllClosedRows,
      getRowById,
      updateRow,
      getClosedForPrint,
    }
  })

  it('getRows returns empty array when no data', () => {
    expect(getRows()).toEqual([])
  })

  it('addRow adds a row and getRows returns it', () => {
    addRow('أحمد')
    const rows = getRows()
    expect(rows.length).toBe(1)
    expect(rows[0]!.employeeName).toBe('أحمد')
    expect(rows[0]!.status).toBe('active')
    expect(rows[0]!.id).toBeDefined()
  })

  it('getRowById returns row by id', () => {
    addRow('محمد')
    const rows = getRows()
    const id = rows[0]!.id
    expect(getRowById(id)?.employeeName).toBe('محمد')
    expect(getRowById('invalid')).toBeNull()
  })

  it('updateRow patches row', () => {
    addRow('خالد')
    const rows = getRows()
    const id = rows[0]!.id
    updateRow(id, { cash: 100, notes: 'ملاحظة' })
    const updated = getRowById(id)
    expect(updated!.cash).toBe(100)
    expect(updated!.notes).toBe('ملاحظة')
  })

  it('closeRow marks row as closed', () => {
    addRow('سارة')
    const rows = getRows()
    const row = rows[0]!
    closeRow(row.id, { ...row, cash: 50 })
    const closed = getRowById(row.id)
    expect(closed!.status).toBe('closed')
    expect(closed!.closedAt).toBeTruthy()
  })

  it('deleteRow removes row', () => {
    addRow('علي')
    const rows = getRows()
    const id = rows[0]!.id
    deleteRow(id)
    expect(getRows().length).toBe(0)
    expect(getRowById(id)).toBeNull()
  })

  it('deleteAllClosedRows keeps only active', () => {
    addRow('أ')
    const rows = getRows()
    const row = rows[0]!
    closeRow(row.id, { ...row, cash: 0 })
    addRow('ب')
    expect(getRows().length).toBe(2)
    deleteAllClosedRows()
    expect(getRows().length).toBe(1)
    expect(getRows()[0]!.employeeName).toBe('ب')
  })

  it('getClosedForPrint returns closed rows limited', () => {
    addRow('ص1')
    const r1 = getRows()[0]!
    closeRow(r1.id, { ...r1, cash: 0 })
    addRow('ص2')
    const r2 = getRows()[0]!
    closeRow(r2.id, { ...r2, cash: 0 })
    const closed = getClosedForPrint(1)
    expect(closed.length).toBe(1)
  })
})
