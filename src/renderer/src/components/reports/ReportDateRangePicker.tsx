import { AppButton } from '@renderer/components/common/AppButton'
import type { ReportDateRange } from '../../../../shared/types'
import { computeRange } from './report-date-utils'
import type { DatePreset } from './report-date-utils'

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this-week', label: 'This Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'this-quarter', label: 'This Quarter' },
  { key: 'this-year', label: 'This Year' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'last-quarter', label: 'Last Quarter' },
  { key: 'last-year', label: 'Last Year' },
  { key: 'custom', label: 'Custom' }
]

type ReportDateRangePickerProps = {
  value: ReportDateRange
  onChange: (range: ReportDateRange) => void
}

export function ReportDateRangePicker({
  value,
  onChange
}: ReportDateRangePickerProps): React.JSX.Element {
  const activePreset = value.preset ?? 'custom'

  const handlePreset = (preset: DatePreset): void => {
    if (preset === 'custom') {
      onChange({ ...value, preset: 'custom' })
    } else {
      onChange(computeRange(preset))
    }
  }

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const d = new Date(e.target.value)
    if (!isNaN(d.getTime())) {
      onChange({ ...value, from: d.toISOString(), preset: 'custom' })
    }
  }

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const d = new Date(e.target.value + 'T23:59:59')
    if (!isNaN(d.getTime())) {
      onChange({ ...value, to: d.toISOString(), preset: 'custom' })
    }
  }

  const fromDate = value.from.split('T')[0]
  const toDate = value.to.split('T')[0]

  return (
    <div className="report-date-picker">
      <div className="report-date-picker__presets">
        {PRESETS.map(({ key, label }) => (
          <AppButton
            key={key}
            size="sm"
            variant={activePreset === key ? 'default' : 'neutral'}
            onClick={() => handlePreset(key)}
          >
            {label}
          </AppButton>
        ))}
      </div>
      {activePreset === 'custom' && (
        <div className="report-date-picker__custom">
          <label className="report-date-picker__field">
            From
            <input type="date" value={fromDate} onChange={handleFromChange} />
          </label>
          <label className="report-date-picker__field">
            To
            <input type="date" value={toDate} onChange={handleToChange} />
          </label>
        </div>
      )}
    </div>
  )
}
