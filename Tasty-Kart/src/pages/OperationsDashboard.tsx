import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Map, Users, Truck, Clock, CheckCircle2, AlertCircle,
  TrendingUp, Activity, Zap, MapPin, Calendar, BarChart3
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { ProtectedAction } from '@/components/shared/ProtectedAction'

/**
 * OPERATIONS DASHBOARD - Delivery fleet performance metrics
 * 
 * Key Metrics:
 * - Active Partners (online now)
 * - Available Slots (booking capacity)
 * - Average Delivery Time
 * - Partner Availability Rate
 * - Order Completion Rate
 * - Zone Performance
 */

interface OperationMetric {
  label: string
  value: number
  change: number
  icon: typeof Users
  color: string
  format: 'number' | 'time' | 'percentage'
}

interface PartnerStatus {
  status: 'ONLINE' | 'OFFLINE' | 'ON_BREAK'
  count: number
  percentage: number
}

interface ZonePerformance {
  zone: string
  city: string
  activePartners: number
  availableSlots: number
  avgDeliveryTime: number
  completionRate: number
}

interface HourlyMetrics {
  hour: string
  orders: number
  completed: number
  avgTime: number
}

export function OperationsDashboard() {
  const { user } = useAuth()
  const [selectedCity, setSelectedCity] = useState('all')
  const [activePartners, setActivePartners] = useState(0)
  const [availableSlots, setAvailableSlots] = useState(0)
  const [avgDeliveryTime, setAvgDeliveryTime] = useState(0)
  const [completionRate, setCompletionRate] = useState(0)
  const [partnerStatuses, setPartnerStatuses] = useState<PartnerStatus[]>([])
  const [zoneMetrics, setZoneMetrics] = useState<ZonePerformance[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyMetrics[]>([])

  useEffect(() => {
    // Placeholder - connect to Firestore listeners
    setActivePartners(87)
    setAvailableSlots(234)
    setAvgDeliveryTime(28)
    setCompletionRate(94.7)

    setPartnerStatuses([
      { status: 'ONLINE', count: 87, percentage: 72 },
      { status: 'OFFLINE', count: 28, percentage: 23 },
      { status: 'ON_BREAK', count: 6, percentage: 5 },
    ])

    setZoneMetrics([
      { zone: 'Downtown', city: 'Mumbai', activePartners: 34, availableSlots: 89, avgDeliveryTime: 22, completionRate: 96.2 },
      { zone: 'Suburbs', city: 'Mumbai', activePartners: 28, availableSlots: 76, avgDeliveryTime: 32, completionRate: 93.1 },
      { zone: 'Business District', city: 'Mumbai', activePartners: 25, availableSlots: 69, avgDeliveryTime: 19, completionRate: 97.5 },
    ])

    setHourlyData([
      { hour: '9 AM', orders: 145, completed: 138, avgTime: 28 },
      { hour: '10 AM', orders: 178, completed: 171, avgTime: 26 },
      { hour: '11 AM', orders: 203, completed: 198, avgTime: 25 },
      { hour: '12 PM', orders: 289, completed: 278, avgTime: 29 },
      { hour: '1 PM', orders: 267, completed: 253, avgTime: 31 },
      { hour: '2 PM', orders: 156, completed: 148, avgTime: 27 },
      { hour: '3 PM', orders: 134, completed: 129, avgTime: 28 },
    ])
  }, [selectedCity])

  const metrics: OperationMetric[] = [
    {
      label: 'Active Partners',
      value: activePartners,
      change: 5.2,
      icon: Truck,
      color: 'bg-blue-100',
      format: 'number',
    },
    {
      label: 'Available Slots',
      value: availableSlots,
      change: 12.3,
      icon: MapPin,
      color: 'bg-green-100',
      format: 'number',
    },
    {
      label: 'Avg Delivery Time',
      value: avgDeliveryTime,
      change: -3.1,
      icon: Clock,
      color: 'bg-amber-100',
      format: 'time',
    },
    {
      label: 'Completion Rate',
      value: completionRate,
      change: 2.4,
      icon: CheckCircle2,
      color: 'bg-green-100',
      format: 'percentage',
    },
  ]

  const COLORS = ['#3b82f6', '#9ca3af', '#fbbf24']

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <PageHeader title="Operations Dashboard" description="Real-time delivery fleet performance" />
        <div className="flex gap-2">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm font-medium"
          >
            <option value="all">All Cities</option>
            <option value="mumbai">Mumbai</option>
            <option value="bangalore">Bangalore</option>
            <option value="delhi">Delhi</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {metric.format === 'time'
                  ? `${metric.value} min`
                  : metric.format === 'percentage'
                    ? `${metric.value}%`
                    : metric.value}
              </p>
              <div className="flex items-center gap-1">
                {metric.change >= 0 ? (
                  <>
                    <TrendingUp size={14} className="text-green-600" />
                    <span className="text-xs font-semibold text-green-600">{metric.change}% up</span>
                  </>
                ) : (
                  <>
                    <TrendingUp size={14} className="text-green-600" style={{ transform: 'scaleY(-1)' }} />
                    <span className="text-xs font-semibold text-green-600">{Math.abs(metric.change)}% down</span>
                  </>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hourly Performance</h3>
              <p className="text-xs text-gray-500 mt-1">Orders & completion rate by hour</p>
            </div>
            <Activity size={20} className="text-gray-400" />
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hour" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="orders" fill="#3b82f6" name="Orders Received" />
              <Bar dataKey="completed" fill="#22c55e" name="Orders Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Partner Status Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Partner Status</h3>
              <p className="text-xs text-gray-500 mt-1">Real-time distribution</p>
            </div>
            <Users size={20} className="text-gray-400" />
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={partnerStatuses}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ index }) => {
                  const item = partnerStatuses[index]
                  return `${item.status}: ${item.count}`
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {partnerStatuses.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => value?.toLocaleString?.() || value}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-2">
            {partnerStatuses.map((item, idx) => (
              <div key={item.status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-gray-600">{item.status}</span>
                </div>
                <span className="font-semibold text-gray-900">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Zone Performance</h3>
          <p className="text-xs text-gray-500 mt-1">Metrics by delivery zone</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Zone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">City</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Active Partners</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Available Slots</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Avg Delivery</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Completion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {zoneMetrics.map((zone) => (
                <tr key={zone.zone} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900">{zone.zone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600">{zone.city}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      <Truck size={12} />
                      {zone.activePartners}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-semibold text-gray-900">{zone.availableSlots}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-semibold text-gray-900">{zone.avgDeliveryTime} min</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-xs">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${zone.completionRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 min-w-[50px]">
                        {zone.completionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <ProtectedAction permission="VIEW_DELIVERY_PARTNERS">
          <Button size="sm" variant="secondary">Download Report</Button>
        </ProtectedAction>
        <ProtectedAction permission="VIEW_ZONES">
          <Button size="sm" variant="primary">Manage Zones</Button>
        </ProtectedAction>
      </div>
    </div>
  )
}
