import { useState, useEffect } from 'react'
import { Plus, MapPin, Loader2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { type City } from '@/data/dummy'
import { addDocumentToFirestore, updateDocumentInFirestore, deleteDocumentFromFirestore, subscribeToCollection } from '@/lib/firebaseService'

const emptyForm = { name: '', state: '', radius: 20, hours: { open: '06:00', close: '23:00' } }

function firestoreMessage(err: unknown) {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Check that you are signed in as an admin and try again.'
}

export function Cities() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  
  const [cities, setCities] = useState<City[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [edit, setEdit] = useState<City | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<City | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    const unsub = subscribeToCollection<City>('cities', (data) => {
      const sorted = [...data].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setCities(sorted)
      setListLoading(false)
    })
    return () => unsub()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = formData.name.trim()
    if (!name) return

    const duplicate = cities.some(
      c => (c.name || '').trim().toLowerCase() === name.toLowerCase() && c.id !== edit?.id
    )
    if (duplicate) {
      toastError('City already exists', `${name} is already in the list.`)
      return
    }
    
    setLoading(true)
    try {
      const cityData: Record<string, unknown> = {
        name,
        displayName: name,
        state: formData.state.trim(),
        country: 'India',
        latitude: edit?.latitude ?? 0,
        longitude: edit?.longitude ?? 0,
        deliveryRadiusKm: formData.radius,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        currencySymbol: '₹',
        language: 'en',
        isActive: true,
        status: 'ACTIVE',
        operatingHours: { startTime: formData.hours.open, endTime: formData.hours.close },
        restaurantCount: edit?.restaurantCount ?? 0,
        activePartnerCount: edit?.activePartnerCount ?? 0,
        totalOrders: edit?.totalOrders ?? 0,
        totalEarnings: edit?.totalEarnings ?? 0,
        createdAt: edit?.createdAt || new Date().toISOString(),
        createdBy: edit?.createdBy || user?.uid || 'system',
        updatedBy: user?.uid || 'system',
      }

      const res = edit 
        ? await updateDocumentInFirestore('cities', edit.id, cityData)
        : await addDocumentToFirestore('cities', cityData)
      
      if (res.success) {
        success(edit ? 'City updated' : 'City added', `${name} is now available when a delivery partner registers.`)
        setShow(false)
        setEdit(null)
        setFormData(emptyForm)
      } else {
        toastError('Could not save city', firestoreMessage('error' in res ? res.error : undefined))
      }
    } catch (e: unknown) {
      toastError('Could not save city', firestoreMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      const res = await deleteDocumentFromFirestore('cities', deleteTarget.id)
      if (res.success) {
        success('City deleted', deleteTarget.name)
        setDeleteTarget(null)
      } else {
        toastError('Could not delete city', firestoreMessage(res.error))
      }
    } catch (e: unknown) {
      toastError('Could not delete city', firestoreMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Cities"
        description="Add the cities a delivery partner can choose while registering"
      />

      <div className="flex justify-end">
        <Button size="sm" icon={<Plus size={14} />} onClick={() => { setEdit(null); setShow(true); setFormData(emptyForm) }}>
          Add City
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total', value: cities.length, color: 'bg-blue-100' },
          { label: 'Active', value: cities.filter(c => c.isActive).length, color: 'bg-green-100' },
          { label: 'Restaurants', value: cities.reduce((s, c) => s + (c.restaurantCount || 0), 0), color: 'bg-amber-100' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
        {listLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <Loader2 size={20} className="animate-spin text-[#B32B2C]" />
            <span className="text-sm font-medium">Loading cities from Firebase...</span>
          </div>
        ) : cities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MapPin size={28} className="mx-auto mb-2 text-gray-300" />
            No cities yet. Add one so delivery partners can select it during registration.
          </div>
        ) : (
          cities.map(city => (
            <div key={city.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-[#B32B2C]" />
                <div>
                  <p className="font-semibold text-gray-900">{city.name}</p>
                  <p className="text-xs text-gray-500">
                    {city.state ? `${city.state} • ` : ''}{city.deliveryRadiusKm || 0}km radius
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => {setEdit(city); setFormData({name: city.name, state: city.state || '', radius: city.deliveryRadiusKm || 20, hours: {open: city.operatingHours?.startTime || '06:00', close: city.operatingHours?.endTime || '23:00'}}); setShow(true)}}>Edit</Button>
                <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(city)}>Delete</Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={show} onClose={() => setShow(false)} title={edit ? 'Edit City' : 'Add City'} size="sm">
        <form onSubmit={handleSave} className="space-y-3">
          <input type="text" placeholder="City Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
          <input type="text" placeholder="State" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          <input type="number" placeholder="Radius (km)" value={formData.radius} onChange={e => setFormData({...formData, radius: Number(e.target.value)})} min="1" max="100" className="w-full px-3 py-2 border rounded-lg" />
          <div className="flex gap-2">
            <input type="time" value={formData.hours.open} onChange={e => setFormData({...formData, hours: {...formData.hours, open: e.target.value}})} className="flex-1 px-3 py-2 border rounded-lg" />
            <input type="time" value={formData.hours.close} onChange={e => setFormData({...formData, hours: {...formData.hours, close: e.target.value}})} className="flex-1 px-3 py-2 border rounded-lg" />
          </div>
          <p className="text-xs text-gray-500">
            Active cities appear on the delivery partner app when they register and choose a city.
          </p>
          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="secondary" type="button" onClick={() => setShow(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => { if (!loading) setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title="Delete City"
        message={`Delete "${deleteTarget?.name}"? Delivery partners will no longer be able to select this city while registering.`}
        confirmLabel={loading ? 'Deleting...' : 'Delete'}
        variant="danger"
        loading={loading}
      />
    </div>
  )
}
