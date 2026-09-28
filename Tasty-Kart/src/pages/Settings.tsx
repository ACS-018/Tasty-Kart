import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Globe, DollarSign, Truck, Percent, FileText, Shield, Info, Settings as SettingsIcon, Loader2, Plus, Trash2, Video } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import {
  DEFAULT_ADMIN_SETTINGS,
  subscribeToAdminSettings,
  saveAdminSettings,
  uploadMediaToStorage,
  type AdminSettings,
} from '@/lib/firebaseService'

const tabs = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'charges', label: 'Charges & Fees', icon: DollarSign },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'deliveryPartner', label: 'Delivery Partners', icon: SettingsIcon },
  { id: 'tax', label: 'Tax Settings', icon: Percent },
  { id: 'legal', label: 'Legal', icon: FileText },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'about', label: 'About', icon: Info },
]

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
}

export function Settings() {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null)
  const { success, error: toastError } = useToast()

  useEffect(() => {
    const unsub = subscribeToAdminSettings((data) => {
      setSettings(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const res = await saveAdminSettings(settings)
    setSaving(false)
    if (res.success) {
      success('Settings saved', 'Admin settings synced to Firestore')
    } else {
      toastError('Save failed', res.error || 'Could not save settings')
    }
  }

  const stats = [
    { label: 'App Name', value: settings.general.appName || 'TastyKart', icon: Globe, color: 'blue' as const },
    { label: 'Version', value: settings.about.version || '1.0.0', icon: SettingsIcon, color: 'green' as const },
    { label: 'Currency', value: settings.general.currency === 'USD' ? 'USD ($)' : 'INR (₹)', icon: DollarSign, color: 'purple' as const },
  ]

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-[#B32B2C]" size={32} />
        <p className="text-sm text-gray-500 font-medium">Loading settings from Firestore...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">

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
              <p className="text-xl font-black text-gray-900">{stat.value}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        <div className="lg:w-52 shrink-0">
          <nav className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn('flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors text-left',
                    activeTab === tab.id
                      ? 'bg-red-50 text-[#B32B2C] border-l-2 border-[#B32B2C]'
                      : 'text-gray-600 hover:bg-gray-50 border-l-2 border-transparent'
                  )}>
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'general' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">General Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="App Name" value={settings.general.appName}
                  onChange={e => setSettings(s => ({ ...s, general: { ...s.general, appName: e.target.value } }))} />
                <Input label="Tagline" value={settings.general.tagline}
                  onChange={e => setSettings(s => ({ ...s, general: { ...s.general, tagline: e.target.value } }))} />
                <Input label="Support Email" type="email" value={settings.general.supportEmail}
                  onChange={e => setSettings(s => ({ ...s, general: { ...s.general, supportEmail: e.target.value } }))} />
                <Input label="Support Phone" value={settings.general.supportPhone}
                  onChange={e => setSettings(s => ({ ...s, general: { ...s.general, supportPhone: e.target.value } }))} />
                <Select label="Currency" value={settings.general.currency}
                  onChange={e => setSettings(s => ({ ...s, general: { ...s.general, currency: e.target.value } }))}>
                  <option value="INR">Indian Rupee (₹)</option>
                  <option value="USD">US Dollar ($)</option>
                </Select>
                <Select label="Language" value={settings.general.language}
                  onChange={e => setSettings(s => ({ ...s, general: { ...s.general, language: e.target.value } }))}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </Select>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">App Logo</p>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#B32B2C] transition-colors">
                  <p className="text-sm text-gray-400">Click to upload logo</p>
                  <p className="text-xs text-gray-300 mt-1">PNG, SVG · Max 2MB</p>
                </div>
              </div>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'charges' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Charges & Platform Fees</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Base Delivery Fee (₹)" type="number" value={settings.charges.baseDeliveryFee}
                  onChange={e => setSettings(s => ({ ...s, charges: { ...s.charges, baseDeliveryFee: Number(e.target.value) || 0 } }))} />
                <Input label="Max Delivery Fee (₹)" type="number" value={settings.charges.maxDeliveryFee}
                  onChange={e => setSettings(s => ({ ...s, charges: { ...s.charges, maxDeliveryFee: Number(e.target.value) || 0 } }))} />
              </div>

              <div className="mt-4">
                <Input label="Delivery Fee Per Km (₹/km)" type="number" step="0.01" value={settings.charges.deliveryFeePerKm}
                  onChange={e => setSettings(s => ({ ...s, charges: { ...s.charges, deliveryFeePerKm: Number(e.target.value) || 0 } }))} />
                <p className="mt-1.5 text-xs text-gray-500">
                  Distance-based fee added to the Base Delivery Fee. Total = Base + (Distance × Per Km), capped at Max Delivery Fee.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Input label="Platform Fee (₹)" type="number" value={settings.charges.platformFee}
                  onChange={e => setSettings(s => ({ ...s, charges: { ...s.charges, platformFee: Number(e.target.value) || 0 } }))} />
                <Input label="Free Delivery Threshold (₹)" type="number" value={settings.charges.freeDeliveryThreshold}
                  onChange={e => setSettings(s => ({ ...s, charges: { ...s.charges, freeDeliveryThreshold: Number(e.target.value) || 0 } }))} />
                <Input label="Min Order Value (₹)" type="number" value={settings.charges.minOrderValue}
                  onChange={e => setSettings(s => ({ ...s, charges: { ...s.charges, minOrderValue: Number(e.target.value) || 0 } }))} />
              </div>
              <p className="mt-4 text-xs text-gray-500">
                City surge is approved under Surge Requests. A delivery partner uploads a photo, then you set a rupee amount and how many hours it stays active for that city.
              </p>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'delivery' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Delivery Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Max Delivery Radius (km)" type="number" value={settings.delivery.maxRadiusKm}
                  onChange={e => setSettings(s => ({ ...s, delivery: { ...s.delivery, maxRadiusKm: Number(e.target.value) || 0 } }))} />
                <Input label="Avg Delivery Time (min)" type="number" value={settings.delivery.avgDeliveryTimeMin}
                  onChange={e => setSettings(s => ({ ...s, delivery: { ...s.delivery, avgDeliveryTimeMin: Number(e.target.value) || 0 } }))} />
                <Input label="Delivery Partner Commission (%)" type="number" value={settings.delivery.partnerCommissionPercent}
                  onChange={e => setSettings(s => ({ ...s, delivery: { ...s.delivery, partnerCommissionPercent: Number(e.target.value) || 0 } }))} />
                <div>
                  <Input
                    label="Partner Wait Time at Restaurant (min)"
                    type="number"
                    value={(settings.delivery as any).partnerWaitMinutes ?? 10}
                    onChange={e => setSettings(s => ({ ...s, delivery: { ...s.delivery, partnerWaitMinutes: Number(e.target.value) || 5 } } as any))}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    After prep timer hits 00:00, the delivery partner waits this many minutes before seeing the "Transfer Order" option.
                  </p>
                </div>
              </div>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'deliveryPartner' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Delivery Partner Settings</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Earnings & Fees</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Base Fee (₹)" type="number" value={settings.deliveryPartner.baseFee}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, baseFee: Number(e.target.value) || 0 } }))} />
                    <Input label="Per KM Rate (₹)" type="number" value={settings.deliveryPartner.perKmRate}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, perKmRate: Number(e.target.value) || 0 } }))} />
                    <Input label="Min Distance (km)" type="number" value={settings.deliveryPartner.minDistance}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, minDistance: Number(e.target.value) || 0 } }))} />
                    <Input label="Max Distance (km)" type="number" value={settings.deliveryPartner.maxDistance}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, maxDistance: Number(e.target.value) || 0 } }))} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Payments & Withdrawals</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Default Cash Limit (₹)" type="number" value={settings.deliveryPartner.cashLimitDefault}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, cashLimitDefault: Number(e.target.value) || 0 } }))} />
                    <Input label="Min Withdrawal Amount (₹)" type="number" value={settings.deliveryPartner.withdrawalMinAmount}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, withdrawalMinAmount: Number(e.target.value) || 0 } }))} />
                    <Input label="Max Withdrawal Amount (₹)" type="number" value={settings.deliveryPartner.withdrawalMaxAmount}
                      onChange={e => setSettings(s => ({ ...s, deliveryPartner: { ...s.deliveryPartner, withdrawalMaxAmount: Number(e.target.value) || 0 } }))} />
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Cash limit is the most COD a partner may hold. Collecting more is allowed, then they go offline until they pay the extra amount.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Required Documents for KYC</h4>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex flex-wrap gap-2">
                      {settings.deliveryPartner.requiredDocuments.map(doc => (
                        <span key={doc} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                          {doc.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Documents marked as required must be uploaded by delivery partners during onboarding.
                    </p>
                  </div>
                </div>

                {/* ── Daily Incentives ─────────────────────────────── */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Daily Incentives</h4>

                  {/* Daily earnings target */}
                  <div className="mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Input
                          label="Daily Earnings Target (₹)"
                          type="number"
                          value={settings.deliveryPartner.dailyTarget}
                          onChange={e =>
                            setSettings(s => ({
                              ...s,
                              deliveryPartner: {
                                ...s.deliveryPartner,
                                dailyTarget: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          The progress bar on the delivery partner home screen targets this amount.
                        </p>
                      </div>
                      <div>
                        <Input
                          label="Daily Target Completion Bonus (₹)"
                          type="number"
                          value={settings.deliveryPartner.dailyTargetBonus}
                          onChange={e =>
                            setSettings(s => ({
                              ...s,
                              deliveryPartner: {
                                ...s.deliveryPartner,
                                dailyTargetBonus: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Added to the partner wallet once when today’s earnings reach the target. Paid once per day.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Incentive slot table */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Trip Bonus Tiers
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings(s => ({
                            ...s,
                            deliveryPartner: {
                              ...s.deliveryPartner,
                              incentiveSlots: [
                                ...s.deliveryPartner.incentiveSlots,
                                { trips: 0, amount: 0 },
                              ],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#B32B2C] hover:text-[#8B1F20] transition-colors"
                      >
                        <Plus size={13} /> Add Tier
                      </button>
                    </div>

                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-semibold text-gray-500 px-1">
                      <span>Min Trips / Day</span>
                      <span>Bonus Amount (₹)</span>
                      <span className="w-6" />
                    </div>

                    {(settings.deliveryPartner.incentiveSlots ?? []).map((slot, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
                        <input
                          type="number"
                          min={0}
                          value={slot.trips}
                          onChange={e => {
                            const updated = [...settings.deliveryPartner.incentiveSlots]
                            updated[i] = { ...updated[i], trips: Number(e.target.value) || 0 }
                            setSettings(s => ({
                              ...s,
                              deliveryPartner: { ...s.deliveryPartner, incentiveSlots: updated },
                            }))
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]"
                          placeholder="e.g. 15"
                        />
                        <input
                          type="number"
                          min={0}
                          value={slot.amount}
                          onChange={e => {
                            const updated = [...settings.deliveryPartner.incentiveSlots]
                            updated[i] = { ...updated[i], amount: Number(e.target.value) || 0 }
                            setSettings(s => ({
                              ...s,
                              deliveryPartner: { ...s.deliveryPartner, incentiveSlots: updated },
                            }))
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]"
                          placeholder="e.g. 110"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = settings.deliveryPartner.incentiveSlots.filter(
                              (_, idx) => idx !== i
                            )
                            setSettings(s => ({
                              ...s,
                              deliveryPartner: { ...s.deliveryPartner, incentiveSlots: updated },
                            }))
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {(settings.deliveryPartner.incentiveSlots ?? []).length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-2">
                        No tiers configured. Click "Add Tier" to create one.
                      </p>
                    )}

                    <p className="text-xs text-gray-400 pt-1">
                      Partners earn the bonus for the highest tier they qualify for based on deliveries in a day.
                    </p>
                  </div>
                </div>

                {/* ── Training Modules ─────────────────────────────── */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Online Training Modules</h4>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Modules shown to delivery partners during onboarding
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings(s => ({
                            ...s,
                            deliveryPartner: {
                              ...s.deliveryPartner,
                              trainingModules: [
                                ...(s.deliveryPartner.trainingModules ?? []),
                                { id: `module_${Date.now()}`, title: '', body: '', videoUrl: '' },
                              ],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#B32B2C] hover:text-[#8B1F20] transition-colors"
                      >
                        <Plus size={13} /> Add Module
                      </button>
                    </div>

                    {(settings.deliveryPartner.trainingModules ?? []).length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-2">
                        No modules configured. Click "Add Module" to create one.
                      </p>
                    )}

                    {(settings.deliveryPartner.trainingModules ?? []).map((mod, i) => (
                      <div key={mod.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Module Title</label>
                            <input
                              type="text"
                              value={mod.title}
                              onChange={e => {
                                const updated = [...(settings.deliveryPartner.trainingModules ?? [])]
                                updated[i] = { ...updated[i], title: e.target.value }
                                setSettings(s => ({
                                  ...s,
                                  deliveryPartner: { ...s.deliveryPartner, trainingModules: updated },
                                }))
                              }}
                              placeholder="e.g. Safety Guidelines"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (settings.deliveryPartner.trainingModules ?? []).filter((_, idx) => idx !== i)
                              setSettings(s => ({
                                ...s,
                                deliveryPartner: { ...s.deliveryPartner, trainingModules: updated },
                              }))
                            }}
                            className="mt-5 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">Module Content</label>
                          <textarea
                            rows={3}
                            value={mod.body}
                            onChange={e => {
                              const updated = [...(settings.deliveryPartner.trainingModules ?? [])]
                              updated[i] = { ...updated[i], body: e.target.value }
                              setSettings(s => ({
                                ...s,
                                deliveryPartner: { ...s.deliveryPartner, trainingModules: updated },
                              }))
                            }}
                            placeholder="Explain what the partner should do in this module..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C] resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">Training video</label>
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 cursor-pointer hover:border-[#B32B2C] hover:text-[#B32B2C]">
                              {uploadingVideoId === mod.id ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                              {mod.videoUrl ? 'Replace video' : 'Upload video'}
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                disabled={uploadingVideoId === mod.id}
                                onChange={async e => {
                                  const file = e.target.files?.[0]
                                  e.target.value = ''
                                  if (!file) return
                                  setUploadingVideoId(mod.id)
                                  try {
                                    const url = await uploadMediaToStorage(file, 'training-videos')
                                    const updated = [...(settings.deliveryPartner.trainingModules ?? [])]
                                    updated[i] = { ...updated[i], videoUrl: url }
                                    setSettings(s => ({
                                      ...s,
                                      deliveryPartner: { ...s.deliveryPartner, trainingModules: updated },
                                    }))
                                    success('Training video uploaded. Save changes to publish it.')
                                  } catch {
                                    toastError('Video upload failed')
                                  } finally {
                                    setUploadingVideoId(null)
                                  }
                                }}
                              />
                            </label>
                            {mod.videoUrl && (
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-600"
                                onClick={() => {
                                  const updated = [...(settings.deliveryPartner.trainingModules ?? [])]
                                  updated[i] = { ...updated[i], videoUrl: '' }
                                  setSettings(s => ({
                                    ...s,
                                    deliveryPartner: { ...s.deliveryPartner, trainingModules: updated },
                                  }))
                                }}
                              >
                                Remove video
                              </button>
                            )}
                          </div>
                          {mod.videoUrl && <p className="text-xs text-green-700 mt-2">Video attached. Delivery partners will watch it in this module.</p>}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400">
                      These modules are what delivery partners see on Online Training. Upload a video on a module, then save. If this list is empty, the delivery app shows its built-in text modules.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'tax' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Tax Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="GST Rate (%)" type="number" value={settings.tax.gstRate}
                  onChange={e => setSettings(s => ({ ...s, tax: { ...s.tax, gstRate: Number(e.target.value) || 0 } }))} />
                <Input label="GST Number" value={settings.tax.gstNumber}
                  onChange={e => setSettings(s => ({ ...s, tax: { ...s.tax, gstNumber: e.target.value } }))} />
                <Select label="Tax Applied On" value={settings.tax.taxAppliedOn}
                  onChange={e => setSettings(s => ({ ...s, tax: { ...s.tax, taxAppliedOn: e.target.value } }))}>
                  <option>Food Total</option>
                  <option>Order Total</option>
                </Select>
                <Select label="Tax Display" value={settings.tax.taxDisplay}
                  onChange={e => setSettings(s => ({ ...s, tax: { ...s.tax, taxDisplay: e.target.value } }))}>
                  <option>Inclusive</option>
                  <option>Exclusive</option>
                </Select>
              </div>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'legal' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Legal Documents</h3>
              <div className="space-y-4">
                <Textarea label="Terms & Conditions" rows={5} value={settings.legal.terms}
                  onChange={e => setSettings(s => ({ ...s, legal: { ...s.legal, terms: e.target.value } }))} />
                <Textarea label="Privacy Policy" rows={5} value={settings.legal.privacy}
                  onChange={e => setSettings(s => ({ ...s, legal: { ...s.legal, privacy: e.target.value } }))} />
                <Textarea label="Refund Policy" rows={4} value={settings.legal.refund}
                  onChange={e => setSettings(s => ({ ...s, legal: { ...s.legal, refund: e.target.value } }))} />
              </div>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Documents'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Security Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                    <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security to your account</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.security.twoFactorEnabled}
                      onChange={e => setSettings(s => ({ ...s, security: { ...s.security, twoFactorEnabled: e.target.checked } }))} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#B32B2C]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B32B2C]"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Login Notifications</p>
                    <p className="text-xs text-gray-500 mt-0.5">Get notified of new logins to your account</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.security.loginNotifications}
                      onChange={e => setSettings(s => ({ ...s, security: { ...s.security, loginNotifications: e.target.checked } }))} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B32B2C]"></div>
                  </label>
                </div>
                <Input label="Session Timeout (minutes)" type="number" value={settings.security.sessionTimeoutMin}
                  onChange={e => setSettings(s => ({ ...s, security: { ...s.security, sessionTimeoutMin: Number(e.target.value) || 0 } }))} />
              </div>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'about' && (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-5">About TastyKart</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl">
                  <div className="w-14 h-14 bg-[#B32B2C] rounded-2xl flex items-center justify-center text-white text-2xl shadow-md">🍽️</div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">TastyKart Admin</h2>
                    <p className="text-sm text-gray-500">Version {settings.about.version} · Synced with Firestore</p>
                  </div>
                </div>
                <Textarea label="About Us" rows={4} value={settings.about.aboutUs}
                  onChange={e => setSettings(s => ({ ...s, about: { ...s.about, aboutUs: e.target.value } }))} />
                <Input label="Website" value={settings.about.website}
                  onChange={e => setSettings(s => ({ ...s, about: { ...s.about, website: e.target.value } }))} />
                <Input label="Contact Email" type="email" value={settings.about.contactEmail}
                  onChange={e => setSettings(s => ({ ...s, about: { ...s.about, contactEmail: e.target.value } }))} />
              </div>
              <div className="flex justify-end mt-5">
                <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
