import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { PaymentMethodSalesRow } from '../../../../../shared/types'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = ['#004b0f', '#005db7', '#6d3aa0', '#c77800', '#cb182a']

type PaymentPieChartProps = {
  data: PaymentMethodSalesRow[]
}

export function PaymentPieChart({ data }: PaymentPieChartProps): React.JSX.Element {
  const chartData = {
    labels: data.map((d) => d.payment_method),
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
        animation: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: $${(ctx.raw as number).toFixed(2)}`
            }
          }
        }
      }}
    />
  )
}
