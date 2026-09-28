import { useState, useEffect } from 'react'
import { Loader2, ShoppingBag, MapPin, Clock, XCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  subscribeToOrders,
  cancelOrderByDeliveryPartner,
  reassignOrderToNextPartner,
  subscribeToCollection,
} from '@/lib/firebaseService'
import { type Order, type DeliveryPartner } from '@/data/dummy'

interface DeliveryBoyOrdersModalProps {
  open: boolean
  onClose: () => void
  partner: DeliveryPartner | null
}

export function DeliveryBoyOrdersModal({
  open,
  onClose,
  partner,
}: DeliveryBoyOrdersModalProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [allPartners, setAllPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const { success, error: showError } = useToast()

  // Subscribe to orders
  useEffect(() => {
    if (open) {
      const unsub = subscribeToOrders((data) => {
        // Filter orders assigned to this partner and not yet delivered/cancelled
        const partnerOrders = data.filter(
          (o) =>
            o.deliveryPartnerId === partner?.id &&
            !['delivered', 'cancelled', 'refunded'].includes(o.status)
        )
        setOrders(partnerOrders)
        setLoading(false)
      })
      return () => unsub()
    }
  }, [open, partner?.id])

  // Subscribe to all delivery partners for reassignment
  useEffect(() => {
    if (open) {
      const unsub = subscribeToCollection<DeliveryPartner>(
        'deliveryPartners',
        (data) => {
          setAllPartners(data)
        }
      )
      return () => unsub()
    }
  }, [open])

  const handleCancelOrder = async () => {
    if (!selectedOrder || !partner || !cancelReason.trim()) {
      showError('Error', 'Please provide a cancellation reason')
      return
    }

    setIsCancelling(true)
    try {
      // Cancel order by delivery partner
      const cancelResult = await cancelOrderByDeliveryPartner(
        selectedOrder.id,
        partner.id,
        cancelReason
      )

      if (!cancelResult.success) {
        showError('Cancellation Failed', cancelResult.error)
        setIsCancelling(false)
        return
      }

      // Get restaurant location for reassignment
      if (selectedOrder.restaurantLat && selectedOrder.restaurantLng) {
        const restaurantLocation = {
          latitude: selectedOrder.restaurantLat,
          longitude: selectedOrder.restaurantLng,
        }

        // Try to reassign to next nearest partner
        const reassignResult = await reassignOrderToNextPartner(
          selectedOrder.id,
          restaurantLocation,
          selectedOrder.deniedPartnerIds || [partner.id],
          allPartners
        )

        if (reassignResult.success) {
          success(
            'Order Cancelled & Reassigned',
            `Order cancelled and reassigned to another partner`
          )
        } else {
          success(
            'Order Cancelled',
            'Order cancelled but no nearby partners available for reassignment'
          )
        }
      } else {
        success('Order Cancelled', 'Order has been cancelled')
      }

      setShowCancelConfirm(false)
      setSelectedOrder(null)
      setCancelReason('')
    } catch (err: any) {
      showError('Error', err?.message || 'Failed to cancel order')
    } finally {
      setIsCancelling(false)
    }
  }

  if (!partner) return null

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`${partner.name}'s Assigned Orders`}
        size="lg"
      >
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#B32B2C]" />
              <span className="ml-2 text-gray-600">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag size={32} className="text-gray-300 mb-2" />
              <p className="text-gray-500">No active orders assigned</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedOrder?.id === order.id
                      ? 'border-[#B32B2C] bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">{order.customerName}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : order.status === 'accepted'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'preparing'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      {order.restaurantName}
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <span className="font-semibold">{formatCurrency(order.total)}</span>
                    </div>
                  </div>

                  {selectedOrder?.id === order.id && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Restaurant:</span>
                          <span className="font-medium">{order.restaurantName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Customer:</span>
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Delivery Address:</span>
                          <span className="font-medium text-right">{order.address}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Cancellation Reason *
                        </label>
                        <Textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Why are you cancelling this order?"
                          rows={3}
                        />
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<XCircle size={14} />}
                          className="flex-1"
                          onClick={() => setShowCancelConfirm(true)}
                          disabled={!cancelReason.trim() || isCancelling}
                        >
                          {isCancelling ? 'Cancelling...' : 'Cancel & Reassign'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(null)
                            setCancelReason('')
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelOrder}
        title="Cancel Order"
        message={`Are you sure you want to cancel ${selectedOrder?.orderNumber}? The system will attempt to reassign it to another nearby delivery partner.`}
        confirmLabel="Cancel & Reassign"
        variant="danger"
      />
    </>
  )
}
