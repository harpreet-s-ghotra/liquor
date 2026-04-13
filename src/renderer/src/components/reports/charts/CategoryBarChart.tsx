import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { CategorySalesRow } from '../../../../../shared/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type CategoryBarChartProps = {
  data: CategorySalesRow[]
}

export function CategoryBarChart({ data }: CategoryBarChartProps): React.JSX.Element {
  const chartData = {
    labels: data.map((d) => d.item_type),
    datasets: [
      {
        label: 'Revenue',
        data: data.map((d) => d.revenue),
        backgroundColor: '#3ea672'
      },
      {
        label: 'Profit',
        data: data.map((d) => d.profit),
        backgroundColor: '#8b6dba'
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
