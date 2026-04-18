import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { PaymentMethodSalesRow } from '../../../../../shared/types'
import { formatCurrency } from '@renderer/utils/currency'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = ['#004b0f', '#005db7', '#6d3aa0', '#c77800', '#cb182a']

type PaymentPieChartProps = {
  data: PaymentMethodSalesRow[]
}

export function PaymentPieChart({ data }: PaymentPieChartProps): React.JSX.Element {
  const total = data.reduce((sum, d) => sum + d.total_amount, 0)
  const pct = (amount: number): string =>
    total > 0 ? `${((amount / total) * 100).toFixed(1)}%` : '0%'

  const chartData = {
    labels: data.map((d) => `${d.payment_method} (${pct(d.total_amount)})`),
    datasets: [
      {
        data: data.map((d) => d.total_amount),
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
