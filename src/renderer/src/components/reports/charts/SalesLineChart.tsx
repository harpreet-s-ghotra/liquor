import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { DailySalesRow } from '../../../../../shared/types'
import { formatCurrency } from '@renderer/utils/currency'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

type SalesLineChartProps = {
  data: DailySalesRow[]
}

export function SalesLineChart({ data }: SalesLineChartProps): React.JSX.Element {
  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Gross Sales',
        data: data.map((d) => d.gross_sales),
        borderColor: '#3d82c6',
        backgroundColor: 'rgba(61, 130, 198, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Net Sales',
        data: data.map((d) => d.net_sales),
        borderColor: '#3ea672',
        backgroundColor: 'rgba(62, 166, 114, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  }

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y ?? 0))}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(Number(value))
            }
          }
        }
      }}
    />
  )
}
