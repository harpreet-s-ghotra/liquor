import { formatCurrency } from '@renderer/utils/currency'
import { cn } from '@renderer/lib/utils'

type ReportSummaryCardProps = {
  label: string
  value: number
  isCurrency?: boolean
  delta?: number | null
}

export function ReportSummaryCard({
  label,
  value,
  isCurrency = true,
  delta
}: ReportSummaryCardProps): React.JSX.Element {
  return (
    <div className="report-summary-card">
      <div className="report-summary-card__label">{label}</div>
      <div className="report-summary-card__value">
        {isCurrency ? formatCurrency(value) : value.toLocaleString()}
      </div>
      {delta != null && (
        <div
          className={cn(
            'report-summary-card__delta',
            delta > 0 && 'report-summary-card__delta--positive',
            delta < 0 && 'report-summary-card__delta--negative'
          )}
        >
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}%
        </div>
      )}
    </div>
  )
}
