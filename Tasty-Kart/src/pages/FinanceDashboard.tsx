import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, DollarSign, Users,
  Calendar, BarChart3, LineChart as LineChartIcon, ArrowUpRight, ArrowDownLeft
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { ProtectedAction } from '@/components/shared/ProtectedAction'

/**
 * FINANCE DASHBOARD - Real-time finance metrics for admin
 * 
 * Key Metrics:
 * - Total Earnings (cumulative)
 * - Total Payouts (completed)
 * - Pending Payouts (awaiting approval)
 * - Wallet Balance (active balance)
 * - Incentive Distributions
 * - Partner Performance (top earners)
 */

interface FinanceMetric {
  label: string
  value: number
  change: number
  icon: typeof TrendingUp
  color: string
  trend: 'up' | 'down'
  format: 'currency' | 'number'
}

interface EarningsByDay {
  date: string
  earnings: number
  payouts: number
  incentives: number
}

interface TopEarner {
  partnerId: string
  name: string
  totalEarnings: number
  completedOrders: number
  level: string
}

interface PayoutStatus {
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
  count: number
  amount: number
}

export function FinanceDashboard() {
  const { user } = useAuth()
  const [dateRange, setDateRange] = useState('month') // 'week', 'month', 'year'
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalPayouts, setTotalPayouts] = useState(0)
  const [pendingPayouts, setPendingPayouts] = useState(0)
  const [walletBalance, setWalletBalance] = useState(0)
  const [incentivesPaid, setIncentivesPaid] = useState(0)
  const [topEarners, setTopEarners] = useState<TopEarner[]>([])
  const [earningsTrend, setEarningsTrend] = useState<EarningsByDay[]>([])
  const [payoutBreakdown, setPayoutBreakdown] = useState<PayoutStatus[]>([])

  useEffect(() => {
    // Placeholder - connect to Firestore listeners
    setTotalEarnings(245680)
    setTotalPayouts(189340)
    setPendingPayouts(28950)
    setWalletBalance(65340)
    setIncentivesPaid(12450)

    // Sample data
    setTopEarners([
      { partnerId: 'dp-001', name: 'Rajesh Kumar', totalEarnings: 45600, completedOrders: 312, level: 'GOLD' },
      { partnerId: 'dp-002', name: 'Priya Singh', totalEarnings: 42100, completedOrders: 298, level: 'GOLD' },
      { partnerId: 'dp-003', name: 'Amit Patel', totalEarnings: 38900, completedOrders: 245, level: 'SILVER' },
      { partnerId: 'dp-004', name: 'Neha Gupta', totalEarnings: 35400, completedOrders: 218, level: 'SILVER' },
      { partnerId: 'dp-005', name: 'Vikram Sinha', totalEarnings: 32100, completedOrders: 198, level: 'SILVER' },
    ])

    setEarningsTrend([
      { date: 'Sep 5', earnings: 8234, payouts: 6100, incentives: 450 },
      { date: 'Sep 6', earnings: 9156, payouts: 7200, incentives: 520 },
      { date: 'Sep 7', earnings: 8945, payouts: 6800, incentives: 480 },
      { date: 'Sep 8', earnings: 10234, payouts: 8100, incentives: 650 },
      { date: 'Sep 9', earnings: 9876, payouts: 7500, incentives: 580 },
      { date: 'Sep 10', earnings: 11234, payouts: 8900, incentives: 720 },
      { date: 'Sep 11', earnings: 10456, payouts: 8200, incentives: 640 },
    ])

    setPayoutBreakdown([
      { status: 'PENDING', count: 23, amount: 28950 },
      { status: 'APPROVED', count: 8, amount: 12340 },
      { status: 'COMPLETED', count: 145, amount: 189340 },
      { status: 'REJECTED', count: 3, amount: 2100 },
    ])
  }, [dateRange])

  const metrics: FinanceMetric[] = [
    {
      label: 'Total Earnings',
      value: totalEarnings,
      change: 12.5,
      icon: TrendingUp,
      color: 'bg-green-100',
      trend: 'up',
      format: 'currency',
    },
    {
      label: 'Total Payouts',
      value: totalPayouts,
      change: 8.3,
      icon: CreditCard,
      color: 'bg-blue-100',
      trend: 'up',
      format: 'currency',
    },
    {
      label: 'Pending Payouts',
      value: pendingPayouts,
      change: -3.2,
      icon: Clock,
      color: 'bg-amber-100',
      trend: 'down',
      format: 'currency',
    },
    {
      label: 'Active Wallet Balance',
      value: walletBalance,
      change: 15.8,
      icon: Wallet,
      color: 'bg-purple-100',
      trend: 'up',
      format: 'currency',
    },
    {
      label: 'Incentives Distributed',
      value: incentivesPaid,
      change: 5.2,
      icon: Gift,
      color: 'bg-pink-100',
      trend: 'up',
      format: 'currency',
    },
  ]

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <PageHeader title="Finance Dashboard" description="Real-time earnings, payouts, and wallet metrics" />
        <div className="flex gap-2">
          {['week', 'month', 'year'].map((range) => (
            <Button
              key={range}
              size="sm"
              variant={dateRange === range ? 'primary' : 'secondary'}
              onClick={() => setDateRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${metric.color} rounded-xl p-4 border-l-4 border-gray-200`}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-gray-600 font-semibold">{metric.label}</p>
                <Icon size={18} className="text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {metric.format === 'currency' ? `₹${(metric.value / 1000).toFixed(1)}k` : metric.value.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                {metric.trend === 'up' ? (
                  <>
                    <ArrowUpRight size={14} className="text-green-600" />
                    <span className="text-xs font-semibold text-green-600">{metric.change}% up</span>
                  </>
                ) : (
                  <>
                    <ArrowDownLeft size={14} className="text-red-600" />
                    <span className="text-xs font-semibold text-red-600">{Math.abs(metric.change)}% down</span>
                  </>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Earnings Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Earnings Trend</h3>
              <p className="text-xs text-gray-500 mt-1">Last 7 days breakdown</p>
            </div>
            <LineChartIcon size={20} className="text-gray-400" />
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={earningsTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="earnings"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 4 }}
                name="Earnings"
              />
              <Line
                type="monotone"
                dataKey="payouts"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Payouts"
              />
              <Line
                type="monotone"
                dataKey="incentives"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 4 }}
                name="Incentives"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payout Status Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Payout Status</h3>
              <p className="text-xs text-gray-500 mt-1">Distribution breakdown</p>
            </div>
            <BarChart3 size={20} className="text-gray-400" />
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={payoutBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ index }) => {
                  const item = payoutBreakdown[index]
                  return `${item.status.slice(0, 3)}: ${item.count}`
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {payoutBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => value?.toLocaleString?.() || value}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-2">
            {payoutBreakdown.map((item, idx) => (
              <div key={item.status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-gray-600">{item.status}</span>
                </div>
                <span className="font-semibold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Earners Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Top Earning Partners</h3>
          <p className="text-xs text-gray-500 mt-1">This month's highest performers</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Partner</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Total Earnings</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Orders</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Level</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Avg / Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topEarners.map((partner, idx) => (
                <tr key={partner.partnerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{partner.name}</p>
                        <p className="text-xs text-gray-500">{partner.partnerId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-gray-900">₹{partner.totalEarnings.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-semibold text-gray-900">{partner.completedOrders}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        partner.level === 'GOLD'
                          ? 'bg-yellow-100 text-yellow-700'
                          : partner.level === 'PLATINUM'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {partner.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      ₹{(partner.totalEarnings / partner.completedOrders).toFixed(0)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Section */}
      <div className="flex gap-2 justify-end">
        <ProtectedAction permission="APPROVE_PAYOUT">
          <Button size="sm" variant="secondary">Download Report</Button>
        </ProtectedAction>
      </div>
    </div>
  )
}

// Import missing icons
import { Clock, Gift } from 'lucide-react'
