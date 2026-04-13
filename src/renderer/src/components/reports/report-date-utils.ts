import type { ReportDateRange } from '../../../../shared/types'

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'this-quarter'
  | 'this-year'
  | 'last-month'
  | 'last-quarter'
  | 'last-year'
  | 'custom'

export function computeRange(preset: DatePreset): ReportDateRange {
  const now = new Date()
  let from: Date
  let to: Date

  switch (preset) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'yesterday':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
      break
    case 'this-week': {
      const day = now.getDay()
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    }
    case 'this-month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'this-quarter': {
      const q = Math.floor(now.getMonth() / 3)
      from = new Date(now.getFullYear(), q * 3, 1)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    }
    case 'this-year':
      from = new Date(now.getFullYear(), 0, 1)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'last-month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      break
    case 'last-quarter': {
      const cq = Math.floor(now.getMonth() / 3)
      from = new Date(now.getFullYear(), (cq - 1) * 3, 1)
      to = new Date(now.getFullYear(), cq * 3, 0, 23, 59, 59)
      break
    }
    case 'last-year':
      from = new Date(now.getFullYear() - 1, 0, 1)
      to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
      break
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  }

  return { from: from.toISOString(), to: to.toISOString(), preset }
}
