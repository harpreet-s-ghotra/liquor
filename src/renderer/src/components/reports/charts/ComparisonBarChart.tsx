import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatCurrency } from '@renderer/utils/currency'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type ComparisonBarChartProps = {
  points: Array<{
    label: string
    valueA: number
    valueB: number | null
  }>
  labelA: string
  labelB: string
}

export function ComparisonBarChart({
  points,
  labelA,
  labelB
}: ComparisonBarChartProps): React.JSX.Element {
  const chartData = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        label: labelA,
        data: points.map((point) => point.valueA),
        backgroundColor: '#3d82c6'
      },
      {
        label: labelB,
        data: points.map((point) => point.valueB),
        backgroundColor: '#d4956a'
      }
    ]
  }

  return (
    <Bar
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
