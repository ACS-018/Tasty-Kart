import { useState, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Eye, ShieldOff, Shield, Loader2, Users, DollarSign } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer, ConfirmDialog } from '@/components/ui/Modal'
import { type Customer, type Order } from '@/data/dummy'
import { formatCurrency, formatDate, getCartoonAvatar, getCustomerAvatar } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { subscribeToCollection, subscribeToOrders, setCustomerBlockStatus } from '@/lib/firebaseService'

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function phoneDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Name shown in the table — also what search matches. */
function customerName(c: Customer) {
  const record = c as Customer & Record<string, unknown>
  const named = text(c.name) || text(record.displayName) || text(record.fullName)
  if (named) return named
  const email = text(c.email)
  return email.includes('@') ? email.split('@')[0] : email
}

function cityFromAddress(raw: unknown) {
  if (!raw || typeof raw !== 'object') return ''
  const rec = raw as Record<string, unknown>
  const direct = text(rec.city) || text(rec.addressCity)
  if (direct) return direct
  const full = text(rec.fullAddress) || text(rec.address)
  if (!full) return ''
  const parts = full.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  let last = parts[parts.length - 1]
  if (/^\d{5,6}$/.test(last) && parts.length > 1) last = parts[parts.length - 2]
  return last.length <= 40 ? last : ''
}

function customerCity(c: Customer, orders: Order[]) {
  if (text(c.city)) return text(c.city)
  const record = c as Customer & Record<string, unknown>
  const fromDefault = cityFromAddress(record.defaultAddress)
  if (fromDefault) return fromDefault
  if (Array.isArray(c.addresses)) {
    for (const address of c.addresses) {
      const city = cityFromAddress(address)
      if (city) return city
    }
  }
  for (const order of orders) {
    const record = order as Order & Record<string, unknown>
    const city = text(order.addressCity)
      || cityFromAddress(record.deliveryAddress)
      || cityFromAddress(order)
    if (city) return city
  }
  return ''
}

function addressCount(c: Customer) {
  if (Array.isArray(c.addresses)) return c.addresses.length
  return typeof c.addresses === 'number' ? c.addresses : 0
}

function favoriteLabel(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const rec = value as Record<string, unknown>
  return text(rec.restaurantName) || text(rec.name) || text(rec.restaurantId)
}

function isCancelled(status: string) {
  const value = status.trim().toLowerCase()
  return value === 'cancelled' || value === 'canceled' || value === 'refunded' || value.includes('cancel')
}

function orderAmount(order: Order) {
  const total = Number(order.total) || 0
  if (total > 0) return total
  const items = Array.isArray(order.items) ? order.items : []
  const fromItems = items.reduce((sum, item) => {
    const price = Number(item?.price) || 0
    const qty = Number(item?.qty) || 0
    return sum + price * (qty > 0 ? qty : 1)
  }, 0)
  if (fromItems > 0) return fromItems
  const record = order as Order & Record<string, unknown>
  const computed =
    (Number(record.subtotal) || 0) +
    (Number(record.tax) || 0) +
    (Number(record.deliveryFee) || 0) +
    (Number(record.platformFee) || 0) +
    (Number(record.tip) || 0) -
    (Number(record.discount) || 0)
  return computed > 0 ? computed : 0
}

function orderMatchesCustomer(customer: Customer, order: Order) {
  const ids = [customer.id, customer.uid].filter(Boolean)
  const email = text(customer.email).toLowerCase()
  const phone = phoneDigits(customer.phone)
  const name = customerName(customer).toLowerCase()
  const record = order as Order & Record<string, unknown>
  const orderIds = [order.customerId, record.userId, record.uid].map(value => text(value))
  if (orderIds.some(id => id && ids.includes(id))) return true
  const orderEmail = text(record.customerEmail || record.email).toLowerCase()
  if (email && orderEmail && email === orderEmail) return true
  const orderPhone = phoneDigits(order.customerPhone || record.phone)
  if (phone.length >= 10 && orderPhone.length >= 10 && orderPhone.endsWith(phone.slice(-10))) return true
  const orderName = text(order.customerName).toLowerCase()
  return Boolean(name && orderName && name === orderName && orderName !== 'guest user')
}

function ordersForCustomer(customer: Customer, orders: Order[]) {
  return orders.filter(order => orderMatchesCustomer(customer, order))
}

function joinedLabel(c: Customer) {
  const record = c as Customer & Record<string, unknown>
  return c.joinedDate || record.createdAt
}

export function Customers() {
  const [customersList, setCustomersList] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [blockTarget, setBlockTarget] = useState<Customer | null>(null)
  const [blockSaving, setBlockSaving] = useState(false)
  const { success, error: toastError } = useToast()

  const customers = useMemo(() => {
    return customersList.map(customer => {
      const mine = ordersForCustomer(customer, orders)
      const spend = mine.reduce((sum, order) => {
        if (isCancelled(String(order.status || ''))) return sum
        return sum + orderAmount(order)
      }, 0)
      return {
        ...customer,
        name: customerName(customer),
        city: customerCity(customer, mine),
        totalOrders: mine.length,
        totalSpend: spend,
        addresses: addressCount(customer),
      }
    })
  }, [customersList, orders])

  const selected = customers.find(customer => customer.id === selectedId) ?? null
  const favoriteNames = (Array.isArray(selected?.favorites) ? selected.favorites : [])
    .map(favoriteLabel)
    .filter(Boolean)

  const stats = [
    { label: 'Total Customers', value: customers.length, icon: Users, color: 'blue' as const },
    { label: 'Active Users', value: customers.filter(c => c.status !== 'blocked').length, icon: Users, color: 'green' as const },
    { label: 'Blocked', value: customers.filter(c => c.status === 'blocked').length, icon: ShieldOff, color: 'red' as const },
    { label: 'Total Spend', value: formatCurrency(customers.reduce((s, c) => s + (c.totalSpend || 0), 0)), icon: DollarSign, color: 'purple' as const },
  ]

  useEffect(() => {
    const unsub = subscribeToCollection<Customer>('customers', (data) => {
      setCustomersList(data)
      setLoading(false)
    })
    const unsubOrders = subscribeToOrders(setOrders)
    return () => {
      unsub()
      unsubOrders()
    }
  }, [])

  const handleToggleBlock = async () => {
    if (!blockTarget) return
    const willBlock = blockTarget.status !== 'blocked'
    setBlockSaving(true)
    try {
      const res = await setCustomerBlockStatus(blockTarget.id, willBlock)
      if (res.success) {
        success(
          willBlock ? 'Customer Blocked' : 'Customer Unblocked',
          willBlock
            ? `"${blockTarget.name}" cannot login or place orders in the user app.`
            : `"${blockTarget.name}" can use the app again.`
        )
        setBlockTarget(null)
      } else {
        toastError('Update Failed', String(res.error) || 'Could not update customer status in Firebase')
      }
    } catch (err) {
      toastError('Update Failed', String(err))
    } finally {
      setBlockSaving(false)
    }
  }

  const columns: ColumnDef<Customer, unknown>[] = [
    {
      id: 'customer',
      header: 'Customer',
      accessorFn: (row) => `${customerName(row)} ${row.email ?? ''} ${row.phone ?? ''}`.trim(),
      cell: ({ row: { original: c } }) => (
        <div className="flex items-center gap-3">
          <img
            src={getCustomerAvatar(c.avatar, c.name || c.email || c.id)}
            alt={c.name || 'Customer'}
            className="w-9 h-9 rounded-full bg-gray-100 object-cover"
            onError={e => {
              e.currentTarget.onerror = null
              e.currentTarget.src = getCartoonAvatar(c.name || c.email || c.id)
            }}
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{customerName(c)}</p>
            <p className="text-xs text-gray-400">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-sm">{row.original.phone || '—'}</span>,
    },
    {
      accessorKey: 'city',
      header: 'City',
      cell: ({ row }) => <span className="text-sm text-gray-600">{row.original.city || '—'}</span>,
    },
    {
      accessorKey: 'totalOrders',
      header: 'Orders',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.totalOrders ?? 0}</span>,
    },
    {
      accessorKey: 'totalSpend',
      header: 'Total Spend',
      cell: ({ row }) => <span className="text-sm font-semibold">{formatCurrency(row.original.totalSpend)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const c = row.original
        const isBlocked = c.status === 'blocked'
        return (
          <div className="flex gap-1">
            <button
              title="View profile"
              onClick={e => { e.stopPropagation(); setSelectedId(c.id) }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Eye size={15} />
            </button>
            <button
              title={isBlocked ? 'Unblock customer' : 'Block customer'}
              onClick={e => { e.stopPropagation(); setBlockTarget(c) }}
              className={`p-1.5 rounded-lg transition-colors ${
                isBlocked
                  ? 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              {isBlocked ? <Shield size={15} /> : <ShieldOff size={15} />}
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 pb-8">
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

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
          <span className="text-sm font-medium">Loading customers from Firebase...</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable data={customers} columns={columns} searchPlaceholder="Search customers..." onRowClick={c => setSelectedId(c.id)} />
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelectedId(null)} title="Customer Profile" width="w-[480px]">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <img
                src={getCustomerAvatar(selected.avatar, selected.name || selected.email || selected.id)}
                alt={selected.name || 'Customer'}
                className="w-16 h-16 rounded-2xl bg-gray-100 object-cover"
                onError={e => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = getCartoonAvatar(selected.name || selected.email || selected.id)
                }}
              />
              <div>
                <h2 className="text-lg font-bold text-gray-900">{customerName(selected)}</h2>
                <p className="text-sm text-gray-500">{selected.email}</p>
                <p className="text-sm text-gray-500">{selected.phone}</p>
                <div className="mt-1"><StatusBadge status={selected.status || 'active'} /></div>
              </div>
            </div>

            {selected.status === 'blocked' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                This customer is blocked and cannot login or place orders in the user app.
                {selected.blockedReason && (
                  <p className="text-xs mt-1 opacity-80">Reason: {selected.blockedReason}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Orders', value: String(selected.totalOrders ?? 0) },
                { label: 'Total Spend', value: formatCurrency(selected.totalSpend) },
                { label: 'Wallet Balance', value: (selected.walletBalance ?? 0) > 0 ? `₹${selected.walletBalance}` : '₹0' },
                { label: 'Addresses', value: String(addressCount(selected)) },
                { label: 'City', value: selected.city || '—' },
                { label: 'Joined', value: formatDate(joinedLabel(selected) as string) },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Favourite Restaurants</h4>
              <div className="flex flex-wrap gap-2">
                {favoriteNames.length === 0 && (
                  <span className="text-xs text-gray-400">No favourites</span>
                )}
                {favoriteNames.map((name, index) => (
                  <span key={`${name}-${index}`} className="text-xs bg-red-50 text-[#B32B2C] px-3 py-1 rounded-full font-medium">{name}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {selected.status === 'blocked' ? (
                <Button
                  variant="success"
                  size="sm"
                  icon={<Shield size={14} />}
                  className="flex-1"
                  onClick={() => setBlockTarget(selected)}
                >
                  Unblock Customer
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<ShieldOff size={14} />}
                  className="flex-1"
                  onClick={() => setBlockTarget(selected)}
                >
                  Block Customer
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!blockTarget}
        onClose={() => !blockSaving && setBlockTarget(null)}
        onConfirm={handleToggleBlock}
        loading={blockSaving}
        title={blockTarget?.status === 'blocked' ? 'Unblock Customer' : 'Block Customer'}
        message={
          blockTarget?.status === 'blocked'
            ? `Unblock "${blockTarget?.name}"? They will be able to login and place orders again.`
            : `Block "${blockTarget?.name}" in Firebase? They will be restricted from logging in and placing orders in the user app.`
        }
        confirmLabel={blockTarget?.status === 'blocked' ? 'Unblock' : 'Block'}
        variant={blockTarget?.status === 'blocked' ? 'default' : 'danger'}
      />
    </div>
  )
}
