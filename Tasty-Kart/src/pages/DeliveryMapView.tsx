import { useState, useEffect, useRef } from 'react'
import { GoogleMap, useJsApiLoader, InfoWindow, OverlayView } from '@react-google-maps/api'
import { motion } from 'framer-motion'
import { Bike, MapPin, Star, Navigation, Filter, Loader2, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'
import { subscribeToCollection } from '@/lib/firebaseService'
import { type DeliveryPartner, type Order, type PartnerStatus } from '@/data/dummy'
import { googleMapsLoaderOptions } from '@/lib/googleMaps'

const DEFAULT_CENTER = { lat: 17.385044, lng: 78.486671 } // Hyderabad
const DEFAULT_ZOOM = 12

// Valid hex colors for Google Maps marker fill
const statusMarkerColor: Record<PartnerStatus, string> = {
  online:    '#22c55e',
  offline:   '#9ca3af',
  busy:      '#f59e0b',
  available: '#3b82f6',
  blocked:   '#ef4444',
}

// Tailwind dot classes for list UI
const statusDot: Record<PartnerStatus, string> = {
  online:    'bg-green-500',
  offline:   'bg-gray-400',
  busy:      'bg-amber-500',
  available: 'bg-blue-500',
  blocked:   'bg-red-500',
}

const ACTIVE_DELIVERY = new Set(['accepted', 'preparing', 'ready', 'picked'])

function isOnDuty(status: string) {
  const value = (status || '').toLowerCase()
  return value === 'online' || value === 'available' || value === 'busy'
}

export function DeliveryMapView() {
  const [partnersList, setPartnersList] = useState<DeliveryPartner[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DeliveryPartner | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'busy'>('all')
  const [filterCity, setFilterCity] = useState('')   // empty = all cities
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const mapRef = useRef<google.maps.Map | null>(null)

  const { isLoaded, loadError } = useJsApiLoader(googleMapsLoaderOptions)

  useEffect(() => {
    const unsub = subscribeToCollection<DeliveryPartner>('deliveryPartners', (data) => {
      setPartnersList(data)
      setLoading(false)

      // Auto-center on first partner that has location and is online/available
      const active = data.find(
        p => isOnDuty(p.status) && p.currentLat && p.currentLng
      )
      if (active) {
        setMapCenter({ lat: active.currentLat!, lng: active.currentLng! })
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => subscribeToCollection<Order>('orders', setOrders), [])

  const dutyOf = (partner: DeliveryPartner): 'online' | 'busy' | null => {
    if (!isOnDuty(partner.status)) return null
    const ids = [partner.id, partner.uid].filter(Boolean) as string[]
    const delivering = orders.some(order =>
      ids.includes(order.deliveryPartnerId || '') &&
      ACTIVE_DELIVERY.has(String(order.status || '').toLowerCase())
    )
    return delivering ? 'busy' : 'online'
  }

  const onDutyPartners = partnersList.filter(p => dutyOf(p))

  const filteredPartners = onDutyPartners.filter(p => {
    const duty = dutyOf(p)
    if (filterStatus !== 'all' && duty !== filterStatus) return false
    if (filterCity && p.city !== filterCity) return false
    return true
  })

  // Only partners with valid coords go on the map
  const mappablePartners = filteredPartners.filter(p => p.currentLat && p.currentLng)

  // Unique cities for city filter dropdown
  const uniqueCities = Array.from(
    new Set(onDutyPartners.map(p => p.city).filter(Boolean))
  ).sort()

  const stats = [
    { label: 'Online', value: onDutyPartners.filter(p => dutyOf(p) === 'online').length, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Busy',   value: onDutyPartners.filter(p => dutyOf(p) === 'busy').length,   icon: Clock,       color: 'text-amber-600' },
  ]

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Error loading Google Maps</p>
        <p className="text-sm text-gray-500 mt-2">Please check your API key and try again.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[#B32B2C]" />
        <span className="ml-3 text-gray-600">Loading delivery map...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8 h-screen flex flex-col">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Delivery Partners Map</h1>
          <div className="text-sm text-gray-500">
            {mappablePartners.length} on map · {filteredPartners.length} total
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={16} className={stat.color} />
                <p className="text-xs font-medium text-gray-500">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex gap-3 items-end mt-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              <Filter size={12} className="inline mr-1" />Status
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as 'all' | 'online' | 'busy')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-[#B32B2C] focus:outline-none text-sm"
            >
              <option value="all">Online & Busy</option>
              <option value="online">Online</option>
              <option value="busy">Busy</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              City
            </label>
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-[#B32B2C] focus:outline-none text-sm"
            >
              <option value="">All Cities</option>
              {uniqueCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<Navigation size={14} />}
            onClick={() => {
              const target = selected ?? mappablePartners[0]
              if (target?.currentLat && target?.currentLng) {
                setMapCenter({ lat: target.currentLat, lng: target.currentLng })
                mapRef.current?.setZoom(15)
              }
            }}
          >
            Focus Map
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <Loader2 size={32} className="animate-spin text-[#B32B2C]" />
          </div>
        )}

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          onLoad={map => { mapRef.current = map }}
          options={{
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeControl: false,
          }}
        >
          {/* Map markers — only partners with valid lat/lng */}
          {mappablePartners.map(partner => {
            const duty = dutyOf(partner) || 'online'
            return (
              <OverlayView
                key={partner.id}
                position={{ lat: partner.currentLat!, lng: partner.currentLng! }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height })}
              >
                <button
                  type="button"
                  onClick={() => setSelected(partner)}
                  className="flex flex-col items-center"
                  title={`${partner.name} (${duty})`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                    style={{ background: statusMarkerColor[duty] }}
                  />
                  <span className="mt-0.5 max-w-[140px] truncate rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-900 shadow">
                    {partner.name || 'Delivery partner'}
                  </span>
                </button>
              </OverlayView>
            )
          })}

          {/* Info window for selected partner */}
          {selected?.currentLat && selected?.currentLng && (
            <InfoWindow
              position={{ lat: selected.currentLat, lng: selected.currentLng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="max-w-[220px] p-2">
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={selected.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.name)}&background=B32B2C&color=fff`}
                    alt={selected.name}
                    className="w-9 h-9 rounded-full bg-gray-100 object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{selected.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${statusDot[dutyOf(selected) || 'online']}`} />
                      <span className="text-xs text-gray-500 capitalize">{dutyOf(selected) || 'online'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-gray-50 rounded p-1.5">
                    <p className="text-gray-400">Rating</p>
                    <p className="font-bold">⭐ {selected.rating || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-1.5">
                    <p className="text-gray-400">Trips</p>
                    <p className="font-bold">{selected.completedOrders || 0}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(selected)}
                  className="w-full mt-2 py-1 bg-[#B32B2C] text-white text-xs font-semibold rounded-lg hover:bg-[#8B1F20] transition-colors"
                >
                  View Details
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Left sidebar list */}
        <div className="absolute left-4 top-4 bottom-4 bg-white rounded-xl shadow-lg border border-gray-200 w-72 overflow-hidden flex flex-col z-10">
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="font-semibold text-gray-900 text-sm">
              Partners ({filteredPartners.length})
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {mappablePartners.length} visible on map
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredPartners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <MapPin size={28} className="text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No partners match the current filter</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {filteredPartners.map(partner => {
                  const hasLocation = !!(partner.currentLat && partner.currentLng)
                  const duty = dutyOf(partner) || 'online'
                  return (
                    <button
                      key={partner.id}
                      onClick={() => {
                        setSelected(partner)
                        if (mapRef.current && hasLocation) {
                          mapRef.current.panTo({ lat: partner.currentLat!, lng: partner.currentLng! })
                          mapRef.current.setZoom(16)
                        }
                      }}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                        selected?.id === partner.id
                          ? 'border-[#B32B2C] bg-red-50'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-shrink-0">
                          <img
                            src={partner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name)}&background=e5e7eb&color=374151&size=32`}
                            alt={partner.name}
                            className="w-8 h-8 rounded-full object-cover bg-gray-100"
                          />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDot[duty]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{partner.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-400 capitalize">{duty}</span>
                            {!hasLocation && (
                              <span className="text-[10px] text-amber-500 font-medium">· no GPS</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-[11px] text-gray-500">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          {partner.rating || 0}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer — opens on any partner click, not just those with coords */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Partner Details" width="w-[520px]">
        {selected && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="relative">
                <img
                  src={selected.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.name)}&background=B32B2C&color=fff&size=64`}
                  alt={selected.name}
                  className="w-16 h-16 rounded-2xl bg-gray-100 object-cover"
                />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${statusDot[dutyOf(selected) || 'online']}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500">{selected.phone}</p>
                <p className="text-sm text-gray-500">{selected.email}</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 capitalize ${
                  dutyOf(selected) === 'busy'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${statusDot[dutyOf(selected) || 'online']}`} />
                  {dutyOf(selected) || 'online'}
                </span>
              </div>
            </div>

            {/* Location */}
            {selected.currentLat && selected.currentLng ? (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={15} className="text-blue-600" />
                  <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Current Location</h4>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-500">Latitude</span>
                    <span className="font-mono text-blue-900">{selected.currentLat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-500">Longitude</span>
                    <span className="font-mono text-blue-900">{selected.currentLng.toFixed(6)}</span>
                  </div>
                  {selected.lastLocationUpdate && (
                    <div className="flex justify-between pt-2 border-t border-blue-200 text-xs">
                      <span className="text-blue-400">Last Updated</span>
                      <span className="text-blue-700">{formatDate(selected.lastLocationUpdate)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-sm text-amber-700">
                No GPS location available — partner may be offline or hasn't enabled location.
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Rating',      value: `⭐ ${selected.rating || 0}` },
                { label: 'Trips',       value: String(selected.completedOrders || 0) },
                { label: 'Accept Rate', value: `${selected.acceptRate || 0}%` },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-base font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Vehicle */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Bike size={15} className="text-gray-400" />
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle</h4>
              </div>
              <div className="flex justify-between"><span className="text-gray-400">Type</span><span className="font-medium">{selected.vehicle || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Number</span><span className="font-medium">{selected.vehicleNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">City</span><span className="font-medium">{selected.city || '—'}</span></div>
            </div>

            {/* Actions */}
            {selected.currentLat && selected.currentLng && (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => {
                  mapRef.current?.panTo({ lat: selected.currentLat!, lng: selected.currentLng! })
                  mapRef.current?.setZoom(16)
                  setSelected(null)
                }}>
                  Focus on Map
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() =>
                  window.open(`https://maps.google.com/?q=${selected.currentLat},${selected.currentLng}`, '_blank')
                }>
                  Open in Maps
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
