import { useState, useEffect, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Edit, Trash2, Plus, GripVertical, ImagePlus, Upload, X, Link2, ExternalLink, Image, LayoutGrid, Store, Globe } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import {
  subscribeToCollection, addDocumentToFirestore,
  updateDocumentInFirestore, deleteDocumentFromFirestore,
  uploadImageToStorage,
} from '@/lib/firebaseService'
import { buildBannerNavigationPayload, getBannerNavigationLabel, inferTapAction } from '@/lib/bannerUtils'
import type { Banner, BannerTapAction, Restaurant } from '@/data/dummy'
import { useToast } from '@/components/ui/Toast'

interface FormState {
  title: string
  type: string
  order: string
  status: 'active' | 'inactive'
  imageUrl: string
  tapAction: BannerTapAction
  restaurantId: string
  webUrl: string
}

const EMPTY_FORM: FormState = {
  title: '', type: 'homepage', order: '1', status: 'active', imageUrl: '',
  tapAction: 'none', restaurantId: '', webUrl: '',
}

const bgGradients = [
  'from-red-400 to-orange-500',
  'from-blue-400 to-purple-500',
  'from-green-400 to-teal-500',
  'from-amber-400 to-yellow-500',
]

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

export function Banners() {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bannersList, setBannersList] = useState<Banner[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [showAdd, setShowAdd]     = useState(false)
  const [editItem, setEditItem]   = useState<Banner | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)

  // Form state
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [dragOver, setDragOver]   = useState(false)

  // Quick stats
  const stats = [
    { label: 'Total Banners', value: bannersList.length, icon: LayoutGrid, color: 'blue' as const },
    { label: 'Active', value: bannersList.filter(b => b.status === 'active').length, icon: Image, color: 'green' as const },
    { label: 'Homepage', value: bannersList.filter(b => b.type === 'homepage').length, icon: LayoutGrid, color: 'amber' as const },
  ]

  // Subscribe to Firestore
  useEffect(() => {
    const unsubs = [
      subscribeToCollection<Banner>('banners', setBannersList),
      subscribeToCollection<Restaurant>('restaurants', setRestaurants),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  const getBannerType = (b: Banner) => b.type || 'homepage'
  const getSortOrder  = (b: Banner) => b.sortOrder ?? b.order ?? 0

  // ── Open modal helpers ────────────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview('')
    setShowAdd(true)
  }

  const openEdit = (b: Banner) => {
    const tapAction = inferTapAction(b)
    setEditItem(b)
    setForm({
      title:    b.title    ?? '',
      type:     getBannerType(b),
      order:    String(getSortOrder(b)),
      status:   b.status   ?? 'active',
      imageUrl: b.imageUrl ?? b.image ?? '',
      tapAction,
      restaurantId: b.restaurantId ?? '',
      webUrl: b.webUrl ?? (tapAction === 'web_url' && b.link?.startsWith('http') ? b.link : ''),
    })
    setImageFile(null)
    setImagePreview(b.imageUrl ?? b.image ?? '')
    setShowAdd(true)
  }

  const closeModal = () => {
    setShowAdd(false)
    setEditItem(null)
    setImageFile(null)
    setImagePreview('')
  }

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileChange = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid File', 'Please select an image file (JPG, PNG, WebP, etc.)')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
    setForm(prev => ({ ...prev, imageUrl: '' }))
  }

  const handleInputFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileChange(e.dataTransfer.files?.[0] ?? null)
  }

  // ── Save (create / update) ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Validation', 'Banner title is required'); return }
    if (form.tapAction === 'restaurant' && !form.restaurantId) {
      toast.error('Validation', 'Select a restaurant for tap navigation'); return
    }
    if (form.tapAction === 'web_url' && !form.webUrl.trim()) {
      toast.error('Validation', 'Enter a web URL for tap navigation'); return
    }
    if (form.tapAction === 'web_url' && form.webUrl.trim() && !/^https?:\/\//i.test(form.webUrl.trim())) {
      toast.error('Validation', 'Web URL must start with http:// or https://'); return
    }
    const hasImage = imageFile || imagePreview || form.imageUrl
    if (!hasImage) { toast.error('Validation', 'Please upload a banner image or paste an image URL'); return }

    setSaving(true)
    try {
      let finalImageUrl = form.imageUrl || imagePreview

      if (imageFile) {
        setUploading(true)
        toast.info('Uploading', 'Uploading banner image to Firebase Storage…')
        finalImageUrl = await uploadImageToStorage(imageFile, 'banners')
        setUploading(false)
      }

      const selectedRestaurant = restaurants.find(r => r.id === form.restaurantId)
      const navigation = buildBannerNavigationPayload({
        tapAction: form.tapAction,
        restaurantId: form.restaurantId,
        restaurantName: selectedRestaurant?.name ?? '',
        webUrl: form.webUrl,
      })

      const payload = {
        title:    form.title.trim(),
        type:     form.type,
        order:    parseInt(form.order) || 1,
        sortOrder: parseInt(form.order) || 1,
        status:   form.status,
        imageUrl: finalImageUrl,
        image:    finalImageUrl,
        ...navigation,
      }

      if (editItem) {
        const result = await updateDocumentInFirestore('banners', editItem.id, payload)
        if (result.success) {
          toast.success('Banner Updated', `"${form.title}" has been updated`)
          closeModal()
        } else {
          toast.error('Update Failed', String(result.error) || 'Could not update banner')
        }
      } else {
        const id = `banner_${Date.now()}`
        const result = await addDocumentToFirestore('banners', { id, ...payload })
        if (result.success) {
          toast.success('Banner Created', `"${form.title}" is now live in Firebase`)
          closeModal()
        } else {
          toast.error('Create Failed', String(result.error) || 'Could not create banner')
        }
      }
    } catch (err) {
      toast.error('Save Failed', String(err) || 'Could not save the banner.')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteDocumentFromFirestore('banners', deleteTarget.id)
      toast.success('Deleted', `Banner "${deleteTarget.title}" removed`)
    } catch {
      toast.error('Delete Failed', 'Could not delete the banner.')
    } finally {
      setDeleteTarget(null)
    }
  }

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const displayPreview = imagePreview || form.imageUrl

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<Banner, unknown>[] = [
    {
      id: 'drag', header: '', size: 40,
      cell: () => <GripVertical size={16} className="text-gray-300 cursor-grab" />,
    },
    {
      id: 'banner', header: 'Banner',
      cell: ({ row: { original: b }, row }) => {
        const img = b.imageUrl || b.image
        return (
          <div className="flex items-center gap-3">
            <div className={`w-16 h-10 rounded-lg overflow-hidden shrink-0 ${!img ? `bg-gradient-to-br ${bgGradients[row.index % bgGradients.length]}` : ''}`}>
              {img
                ? <img src={img} alt={b.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">IMG</div>
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{b.title}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                {inferTapAction(b) === 'restaurant'
                  ? <Store size={10} />
                  : inferTapAction(b) === 'web_url'
                    ? <Globe size={10} />
                    : <Link2 size={10} />}
                {getBannerNavigationLabel(b)}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'navigation', header: 'On Tap',
      cell: ({ row: { original: b } }) => {
        const action = inferTapAction(b)
        return (
          <span className={`text-xs px-2 py-1 rounded-md capitalize ${
            action === 'restaurant' ? 'bg-green-50 text-green-700' :
            action === 'web_url' ? 'bg-blue-50 text-blue-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {action === 'none' ? 'None' : action === 'restaurant' ? 'Restaurant' : 'Web URL'}
          </span>
        )
      },
    },
    {
      id: 'type', header: 'Type',
      cell: ({ row: { original: b } }) => (
        <span className="text-xs bg-gray-100 px-2 py-1 rounded-md capitalize">{getBannerType(b)}</span>
      ),
    },
    {
      id: 'sortOrder', header: 'Order',
      cell: ({ row: { original: b } }) => <span className="text-xs text-gray-500">#{getSortOrder(b)}</span>,
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status ?? 'active'} />,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit size={15} /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Add Banner</Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Preview grid */}
      {bannersList.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {bannersList.map((b, i) => {
            const img = b.imageUrl || b.image
            return (
              <div
                key={b.id}
                onClick={() => openEdit(b)}
                className={`relative rounded-xl overflow-hidden aspect-[2/1] cursor-pointer hover:opacity-90 transition-opacity group ${
                  !img ? `bg-gradient-to-br ${bgGradients[i % bgGradients.length]}` : ''
                }`}
              >
                {img
                  ? <img src={img} alt={b.title} className="w-full h-full object-cover" />
                  : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-white px-4">
                        <p className="text-sm font-bold">{b.title}</p>
                        <p className="text-xs opacity-75 mt-1 capitalize">{getBannerType(b)}</p>
                      </div>
                    </div>
                  )
                }
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Edit size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute top-2 right-2">
                  <StatusBadge status={b.status ?? 'active'} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <DataTable data={bannersList} columns={columns} searchPlaceholder="Search banners…" />
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={showAdd}
        onClose={closeModal}
        title={editItem ? 'Edit Banner' : 'Add Banner'}
        description={editItem ? 'Update banner details and image' : 'Upload a new promotional banner'}
        size="md"
      >
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputFileChange}
          />

          {displayPreview ? (
            <div className="relative rounded-xl overflow-hidden aspect-[3/1] bg-gray-100 group">
              <img src={displayPreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
                >
                  <Upload size={13} /> Replace Image
                </button>
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(''); setField('imageUrl', '') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                >
                  <X size={13} /> Remove
                </button>
              </div>
              {imageFile && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                  📁 {imageFile.name}
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-xl aspect-[3/1] flex flex-col items-center justify-center cursor-pointer transition-all border-2 border-dashed ${
                dragOver
                  ? 'border-[#B32B2C] bg-red-50'
                  : 'border-gray-300 bg-gray-50 hover:border-[#B32B2C] hover:bg-red-50/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${dragOver ? 'bg-red-100' : 'bg-gray-200'}`}>
                <ImagePlus size={22} className={dragOver ? 'text-[#B32B2C]' : 'text-gray-400'} />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {dragOver ? 'Drop image here' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — recommended 1200×400px</p>
            </div>
          )}

          {!imageFile && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or paste image URL</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}
          {!imageFile && (
            <Input
              placeholder="https://example.com/banner.jpg"
              value={form.imageUrl}
              onChange={e => {
                setField('imageUrl', e.target.value)
                setImagePreview(e.target.value)
              }}
              leftIcon={<ExternalLink size={14} />}
            />
          )}

          <Input
            label="Banner Title *"
            placeholder="e.g. Summer Sale 🌞"
            value={form.title}
            onChange={e => setField('title', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Banner Type" value={form.type} onChange={e => setField('type', e.target.value)}>
              <option value="homepage">Homepage</option>
              <option value="offer">Offer</option>
              <option value="festival">Festival</option>
              <option value="carousel">Carousel</option>
            </Select>
            <Input
              label="Sort Order"
              type="number"
              min={1}
              placeholder="1"
              value={form.order}
              onChange={e => setField('order', e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">On Tap Navigation (optional)</p>
            <p className="text-xs text-gray-500">Choose where the customer app goes when this banner is tapped.</p>

            <Select
              label="Tap Action"
              value={form.tapAction}
              onChange={e => setField('tapAction', e.target.value as BannerTapAction)}
            >
              <option value="none">None — no navigation</option>
              <option value="restaurant">Open Restaurant</option>
              <option value="web_url">Open Web URL</option>
            </Select>

            {form.tapAction === 'restaurant' && (
              <Select
                label="Restaurant *"
                value={form.restaurantId}
                onChange={e => setField('restaurantId', e.target.value)}
              >
                <option value="">Select restaurant</option>
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name} · {r.cuisine}</option>
                ))}
              </Select>
            )}

            {form.tapAction === 'web_url' && (
              <Input
                label="Web URL *"
                placeholder="https://example.com/promo"
                value={form.webUrl}
                onChange={e => setField('webUrl', e.target.value)}
                leftIcon={<Globe size={14} />}
              />
            )}
          </div>

          <Select label="Status" value={form.status} onChange={e => setField('status', e.target.value as 'active' | 'inactive')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving || uploading} icon={uploading ? undefined : editItem ? <Edit size={14} /> : <Plus size={14} />}>
              {uploading ? 'Uploading…' : saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Banner'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Banner"
        message={`Permanently delete banner "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete Banner"
        variant="danger"
      />
    </div>
  )
}