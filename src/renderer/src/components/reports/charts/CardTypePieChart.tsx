import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { CardBrandSalesRow } from '../../../../../shared/types'
import { formatCurrency } from '@renderer/utils/currency'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = ['#004b0f', '#005db7', '#c77800', '#8b6dba', '#cb182a']

type CardTypePieChartProps = {
  data: CardBrandSalesRow[]
}

export function CardTypePieChart({ data }: CardTypePieChartProps): React.JSX.Element {
  const total = data.reduce((sum, row) => sum + row.total_amount, 0)
  const pct = (amount: number): string =>
    total > 0 ? `${((amount / total) * 100).toFixed(1)}%` : '0%'

  const chartData = {
    labels: data.map((row) => `${row.card_brand} (${pct(row.total_amount)})`),
    datasets: [
      {
        data: data.map((row) => row.total_amount),
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: 1
      }
    ]
  }

  return (
    <Doughnut
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const amount = ctx.raw as number
                return `${formatCurrency(amount)} (${pct(amount)})`
              }
            }
          }
        }
      }}
    />
  )
}
