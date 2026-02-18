export type ClosureStatus = 'active' | 'closed'

export interface ClosureRow {
  id: string
  employeeName: string
  cash: number
  /** مرسل للخزنة: يُضاف مع الكاش في معادلة انحراف الكاش (كاش + مرسل للخزنة + مصروفات - تعويض = رصيد البرنامج) */
  sentToTreasury?: number
  /** تعويض مصروفات: يُخصم من المصروفات في انحراف الكاش (المصروفات الفعلية = expenses - expenseCompensation) */
  expenseCompensation?: number
  expenses: number
  /** عدد بنود المصروفات المرحلة من الشفت السابق (لا يمكن حذفها أو تعديلها) */
  carriedExpenseCount?: number
  /** تفاصيل تصنيف المصروفات: مبلغ + وصف (مثل 10 ريال كتب) */
  expenseItems?: { amount: number; description: string }[]
  mada: number
  visa: number
  mastercard: number
  amex: number
  bankTransfer: number
  programBalanceCash: number
  programBalanceBank: number
  variance: number
  status: ClosureStatus
  notes: string
  closedAt: string | null
  createdAt: string
}

export type FilterPreset = 'today' | 'yesterday' | 'lastWeek'
