import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, Eye, Loader2, Gift, Bike, TrendingUp, Calendar, MapPin, CheckCircle, XCircle } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { Drawer, Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  subscribeToCollection,
  subscribeToDeliveryIncentives,
  createDeliveryIncentive,
  updateDeliveryIncentive,
  deleteDeliveryIncentive,
} from '@/lib/firebaseService'
import { type DeliveryPartner, type DeliveryIncentive } from '@/data/dummy'

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

/** Returns the Monday (YYYY-MM-DD) of the week that contains `date`. */
function getWeekMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day  // shift to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

/** Returns a human-readable week label, e.g. "Sep 22 – Sep 28, 2026". */
function formatWeekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`
}

export function DeliveryIncentives() {
  const [incentivesList, setIncentivesList] = useState<DeliveryIncentive[]>([])
  const [partnersList, setPartnersList] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DeliveryIncentive | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<DeliveryIncentive | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryIncentive | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterWeek, setFilterWeek] = useState(getWeekMonday(new Date()))
  const [filterCity, setFilterCity] = useState('')
  const { success, error: showError } = useToast()

  // Form State
  const [formData, setFormData] = useState({
    partnerId: '',
    partnerName: '',
    weekOf: getWeekMonday(new Date()),
    city: 'Bangalore',
    completedTrips: 0,
    cancelledTrips: 0,
    baseEarnings: 0,
    incentiveBonus: 0,
    status: 'active' as 'active' | 'completed' | 'cancelled',
    notes: '',
  })

  const [tripThresholds, setTripThresholds] = useState([
    { minTrips: 5, maxTrips: 10, bonusAmount: 500, description: '₹500 for 5-10 trips' },
    { minTrips: 11, maxTrips: 15, bonusAmount: 1000, description: '₹1000 for 11-15 trips' },
    { minTrips: 16, maxTrips: undefined, bonusAmount: 1500, description: '₹1500 for 16+ trips' },
  ])

  // Real-time Firestore Sync
  useEffect(() => {
    const unsub = subscribeToDeliveryIncentives((data) => {
      setIncentivesList(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Load delivery partners
  useEffect(() => {
    const unsub = subscribeToCollection<DeliveryPartner>('deliveryPartners', (data) => {
      setPartnersList(data.filter(p => p.approved))
    })
    return () => unsub()
  }, [])

  // Calculate incentive bonus based on trips
  const calculateIncentiveBonus = (trips: number) => {
    for (const threshold of tripThresholds) {
      if (trips >= threshold.minTrips && (!threshold.maxTrips || trips <= threshold.maxTrips)) {
        return threshold.bonusAmount
      }
    }
    return 0
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.partnerId) {
      showError('Validation Error', 'Please select a delivery partner')
      return
    }

    setIsSubmitting(true)
    try {
      const incentiveBonus = calculateIncentiveBonus(formData.completedTrips)
      const totalEarnings = formData.baseEarnings + incentiveBonus

      const newIncentive: DeliveryIncentive = {
        id: `inc_${Date.now()}`,
        partnerId: formData.partnerId,
        partnerName: formData.partnerName,
        weekOf: formData.weekOf,
        date: formData.weekOf,
        city: formData.city,
        completedTrips: formData.completedTrips,
        cancelledTrips: formData.cancelledTrips || 0,
        baseEarnings: formData.baseEarnings,
        incentiveBonus,
        totalEarnings,
        tripThresholds,
        status: formData.status,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
      }

      const res = await createDeliveryIncentive(newIncentive)
      setIsSubmitting(false)

      if (res.success) {
        success('Incentive Created', `Incentive for ${formData.partnerName} created successfully`)
        setShowAdd(false)
        setFormData({
          partnerId: '',
          partnerName: '',
          weekOf: getWeekMonday(new Date()),
          city: 'Bangalore',
          completedTrips: 0,
          cancelledTrips: 0,
          baseEarnings: 0,
          incentiveBonus: 0,
          status: 'active',
          notes: '',
        })
      } else {
        showError('Failed to Create', res.error || 'Could not create incentive')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      showError('Error', err?.message || 'Failed to create incentive')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return

    setIsSubmitting(true)
    try {
      const incentiveBonus = calculateIncentiveBonus(formData.completedTrips)
      const totalEarnings = formData.baseEarnings + incentiveBonus

      const updatedData = {
        completedTrips: formData.completedTrips,
        cancelledTrips: formData.cancelledTrips || 0,
        baseEarnings: formData.baseEarnings,
        incentiveBonus,
        totalEarnings,
        tripThresholds,
        status: formData.status,
        notes: formData.notes,
      }

      const res = await updateDeliveryIncentive(editTarget.id, updatedData)
      setIsSubmitting(false)

      if (res.success) {
        success('Incentive Updated', 'Incentive updated successfully')
        setEditTarget(null)
        setFormData({
          partnerId: '',
          partnerName: '',
          weekOf: getWeekMonday(new Date()),
          city: 'Bangalore',
          completedTrips: 0,
          cancelledTrips: 0,
          baseEarnings: 0,
          incentiveBonus: 0,
          status: 'active',
          notes: '',
        })
      } else {
        showError('Failed to Update', res.error || 'Could not update incentive')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      showError('Error', err?.message || 'Failed to update incentive')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const res = await deleteDeliveryIncentive(deleteTarget.id)
    if (res.success) {
      success('Incentive Deleted', 'Incentive removed successfully')
    }
    setDeleteTarget(null)
  }

  // Quick stats
  const stats = [
    {
      label: 'Active Incentives',
      value: incentivesList.filter(i => i.status === 'active').length,
      icon: Gift,
      color: 'blue' as const,
    },
    {
      label: 'Total Bonus Offered',
      value: formatCurrency(incentivesList.reduce((s, i) => s + (i.incentiveBonus || 0), 0)),
      icon: TrendingUp,
      color: 'green' as const,
    },
    {
      label: 'Partners Incentivized',
      value: new Set(incentivesList.map(i => i.partnerId)).size,
      icon: Bike,
      color: 'amber' as const,
    },
    {
      label: 'Total Paid',
      value: formatCurrency(incentivesList.reduce((s, i) => s + (i.totalEarnings || 0), 0)),
      icon: CheckCircle,
      color: 'green' as const,
    },
  ]

  const filteredIncentives = incentivesList.filter(inc => {
    if (filterWeek && inc.weekOf !== filterWeek) return false
    if (filterCity && inc.city !== filterCity) return false
    return true
  })

  const columns: ColumnDef<DeliveryIncentive, unknown>[] = [
    {
      id: 'partner',
      header: 'Delivery Partner',
      cell: ({ row: { original: inc } }) => (
        <div>
          <p className="text-sm font-semibold text-gray-900">{inc.partnerName}</p>
          <p className="text-xs text-gray-400">{inc.partnerPhone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'weekOf',
      header: 'Week',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Calendar size={12} />
          {row.original.weekOf ? formatWeekLabel(row.original.weekOf) : '—'}
        </div>
      ),
    },
    {
      accessorKey: 'completedTrips',
      header: 'Trips',
      cell: ({ row }) => (
        <div className="text-sm font-semibold text-gray-900">
          {row.original.completedTrips}
          {row.original.cancelledTrips ? (
            <span className="text-xs text-red-600 ml-1">({row.original.cancelledTrips} cancelled)</span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'baseEarnings',
      header: 'Base Earnings',
      cell: ({ row }) => <span className="text-sm font-semibold">{formatCurrency(row.original.baseEarnings)}</span>,
    },
    {
      accessorKey: 'incentiveBonus',
      header: 'Bonus',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-green-600">
          +{formatCurrency(row.original.incentiveBonus || 0)}
        </span>
      ),
    },
    {
      accessorKey: 'totalEarnings',
      header: 'Total',
      cell: ({ row }) => <span className="text-sm font-bold text-gray-900">{formatCurrency(row.original.totalEarnings)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.original.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : row.original.status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
          }`}
        >
          {row.original.status === 'completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelected(row.original)
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditTarget(row.original)
              setFormData({
                partnerId: row.original.partnerId,
                partnerName: row.original.partnerName,
                weekOf: row.original.weekOf || getWeekMonday(new Date()),
                city: row.original.city,
                completedTrips: row.original.completedTrips,
                cancelledTrips: row.original.cancelledTrips || 0,
                baseEarnings: row.original.baseEarnings,
                incentiveBonus: row.original.incentiveBonus || 0,
                status: row.original.status,
                notes: row.original.notes || '',
              })
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Edit size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget(row.original)
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Incentives</h1>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>
          Create Incentive
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const colors = colorMap[stat.color]
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            >
              <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                <stat.icon size={20} className={colors.icon} />
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Filter by Week
          </label>
          <input
            type="date"
            value={filterWeek}
            onChange={(e) => setFilterWeek(getWeekMonday(new Date(e.target.value)))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#B32B2C] focus:outline-none text-sm"
          />
          {filterWeek && (
            <p className="text-xs text-gray-400 mt-1">{formatWeekLabel(filterWeek)}</p>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Filter by City
          </label>
          <Select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
          >
            <option value="">All Cities</option>
            <option value="Bangalore">Bangalore</option>
            <option value="Mysore">Mysore</option>
            <option value="Mangalore">Mangalore</option>
            <option value="Hubli">Hubli</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
          <span className="text-sm font-medium">Loading incentives...</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            data={filteredIncentives}
            columns={columns}
            searchPlaceholder="Search incentives by partner name..."
            onRowClick={setSelected}
          />
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Incentive Details" width="w-[560px]">
        {selected && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <h2 className="text-xl font-bold text-gray-900">{selected.partnerName}</h2>
              <p className="text-sm text-gray-600 mt-1">{selected.partnerPhone}</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Week</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selected.weekOf ? formatWeekLabel(selected.weekOf) : '—'}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">City</p>
                  <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                    <MapPin size={16} /> {selected.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Completed Trips', value: selected.completedTrips },
                { label: 'Cancelled', value: selected.cancelledTrips || 0 },
                { label: 'Total Distance', value: selected.totalDistance ? `${selected.totalDistance}km` : 'N/A' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Earnings Breakdown */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-2">
              <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-3">Earnings Breakdown</h4>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Base Earnings</span>
                <span className="font-semibold text-gray-900">{formatCurrency(selected.baseEarnings)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Incentive Bonus</span>
                <span className="font-bold text-green-600">+{formatCurrency(selected.incentiveBonus || 0)}</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between items-center text-sm font-bold">
                <span className="text-gray-900">Total Earnings</span>
                <span className="text-lg text-blue-600">{formatCurrency(selected.totalEarnings)}</span>
              </div>
            </div>

            {/* Trip Thresholds */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Trip Bonuses</h4>
              <div className="space-y-2">
                {selected.tripThresholds?.map((threshold, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg text-sm">
                    <span className="text-gray-600">{threshold.description}</span>
                    <span className="font-bold text-green-600">{formatCurrency(threshold.bonusAmount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status & Notes */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</p>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                    selected.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : selected.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {selected.status === 'completed' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {selected.status}
                </span>
              </div>
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Edit size={14} />}
                className="flex-1"
                onClick={() => {
                  setEditTarget(selected)
                  setFormData({
                    partnerId: selected.partnerId,
                    partnerName: selected.partnerName,
                    weekOf: selected.weekOf || getWeekMonday(new Date()),
                    city: selected.city,
                    completedTrips: selected.completedTrips,
                    cancelledTrips: selected.cancelledTrips || 0,
                    baseEarnings: selected.baseEarnings,
                    incentiveBonus: selected.incentiveBonus || 0,
                    status: selected.status,
                    notes: selected.notes || '',
                  })
                  setSelected(null)
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={14} />}
                className="flex-1"
                onClick={() => {
                  setDeleteTarget(selected)
                  setSelected(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add/Edit Modal */}
      <Modal
        open={showAdd || !!editTarget}
        onClose={() => {
          setShowAdd(false)
          setEditTarget(null)
          setFormData({
            partnerId: '',
            partnerName: '',
            weekOf: getWeekMonday(new Date()),
            city: 'Bangalore',
            completedTrips: 0,
            cancelledTrips: 0,
            baseEarnings: 0,
            incentiveBonus: 0,
            status: 'active',
            notes: '',
          })
        }}
        title={editTarget ? 'Edit Incentive' : 'Create New Incentive'}
        size="lg"
      >
        <form onSubmit={editTarget ? handleEditSubmit : handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!editTarget && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Delivery Partner *
                  </label>
                  <Select
                    value={formData.partnerId}
                    onChange={(e) => {
                      const partner = partnersList.find(p => p.id === e.target.value)
                      setFormData({
                        ...formData,
                        partnerId: e.target.value,
                        partnerName: partner?.name || '',
                      })
                    }}
                    required
                  >
                    <option value="">Select Partner</option>
                    {partnersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.city})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Week Starting (Monday) *
                  </label>
                  <input
                    type="date"
                    value={formData.weekOf}
                    onChange={(e) =>
                      setFormData({ ...formData, weekOf: getWeekMonday(new Date(e.target.value)) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#B32B2C] focus:outline-none text-sm"
                    required
                  />
                  {formData.weekOf && (
                    <p className="text-xs text-gray-500 mt-1">{formatWeekLabel(formData.weekOf)}</p>
                  )}
                </div>
              </>
            )}

            <Input
              label="Completed Trips"
              type="number"
              value={formData.completedTrips}
              onChange={(e) => {
                const trips = parseInt(e.target.value) || 0
                const bonus = calculateIncentiveBonus(trips)
                setFormData({
                  ...formData,
                  completedTrips: trips,
                  incentiveBonus: bonus,
                })
              }}
              placeholder="Number of completed trips"
              required
            />

            <Input
              label="Cancelled Trips"
              type="number"
              value={formData.cancelledTrips}
              onChange={(e) => setFormData({ ...formData, cancelledTrips: parseInt(e.target.value) || 0 })}
              placeholder="Number of cancelled trips"
            />

            <Input
              label="Base Earnings (₹)"
              type="number"
              value={formData.baseEarnings}
              onChange={(e) => setFormData({ ...formData, baseEarnings: parseInt(e.target.value) || 0 })}
              placeholder="Earnings from deliveries"
              required
            />

            <Input
              label="Incentive Bonus (₹)"
              type="number"
              value={formData.incentiveBonus}
              disabled
              placeholder="Auto-calculated based on trips"
            />

            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any notes about this incentive..."
            rows={3}
          />

          {/* Trip Threshold Configuration */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Trip Thresholds</h4>
            <div className="space-y-2">
              {tripThresholds.map((threshold, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <Input
                    label={idx === 0 ? 'Min Trips' : ''}
                    type="number"
                    value={threshold.minTrips}
                    onChange={(e) => {
                      const updated = [...tripThresholds]
                      updated[idx].minTrips = parseInt(e.target.value) || 0
                      setTripThresholds(updated)
                    }}
                    placeholder="Min"
                    className="flex-1"
                  />
                  <Input
                    label={idx === 0 ? 'Max Trips' : ''}
                    type="number"
                    value={threshold.maxTrips || ''}
                    onChange={(e) => {
                      const updated = [...tripThresholds]
                      updated[idx].maxTrips = e.target.value ? parseInt(e.target.value) : undefined
                      setTripThresholds(updated)
                    }}
                    placeholder="Max (optional)"
                    className="flex-1"
                  />
                  <Input
                    label={idx === 0 ? 'Bonus Amount' : ''}
                    type="number"
                    value={threshold.bonusAmount}
                    onChange={(e) => {
                      const updated = [...tripThresholds]
                      updated[idx].bonusAmount = parseInt(e.target.value) || 0
                      setTripThresholds(updated)
                    }}
                    placeholder="Bonus"
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowAdd(false)
                setEditTarget(null)
                setFormData({
                  partnerId: '',
                  partnerName: '',
                  weekOf: getWeekMonday(new Date()),
                  city: 'Bangalore',
                  completedTrips: 0,
                  cancelledTrips: 0,
                  baseEarnings: 0,
                  incentiveBonus: 0,
                  status: 'active',
                  notes: '',
                })
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Saving...
                </span>
              ) : (
                editTarget ? 'Update Incentive' : 'Create Incentive'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Incentive"
        message={`Are you sure you want to delete the incentive for ${deleteTarget?.partnerName} for week of ${deleteTarget?.weekOf ? formatWeekLabel(deleteTarget.weekOf) : ''}?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
