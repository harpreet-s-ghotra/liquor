import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ComparisonDelta } from '../../../../../shared/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type ComparisonBarChartProps = {
  deltas: ComparisonDelta[]
}

export function ComparisonBarChart({ deltas }: ComparisonBarChartProps): React.JSX.Element {
  const chartData = {
    labels: deltas.map((d) => d.field),
    datasets: [
      {
        label: 'Period A',
        data: deltas.map((d) => d.period_a_value),
        backgroundColor: '#3d82c6'
      },
      {
        label: 'Period B',
        data: deltas.map((d) => d.period_b_value),
        backgroundColor: '#d4956a'
      }
    ]
  }

  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        animation: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `$${value}`
            }
          }
        }
      }}
    />
  )
}
