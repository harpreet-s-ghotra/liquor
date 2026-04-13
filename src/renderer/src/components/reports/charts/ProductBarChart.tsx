import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ProductSalesRow } from '../../../../../shared/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type ProductBarChartProps = {
  data: ProductSalesRow[]
}

export function ProductBarChart({ data }: ProductBarChartProps): React.JSX.Element {
  const chartData = {
    labels: data.map((d) =>
      d.product_name.length > 25 ? d.product_name.slice(0, 22) + '...' : d.product_name
    ),
    datasets: [
      {
        label: 'Revenue',
        data: data.map((d) => d.revenue),
        backgroundColor: '#3d82c6'
      }
    ]
  }

  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        animation: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
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
