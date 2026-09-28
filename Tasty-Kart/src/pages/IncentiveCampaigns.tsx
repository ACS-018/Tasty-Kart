import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, Gift, Loader2, BarChart2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { ProtectedAction } from '@/components/shared/ProtectedAction'
import { type IncentiveCampaign } from '@/data/dummy'
import { addDocumentToFirestore, updateDocumentInFirestore, deleteDocumentFromFirestore } from '@/lib/firebaseService'

export function IncentiveCampaigns() {
  const { user } = useAuth()
  const { success } = useToast()
  
  const [campaigns, setCampaigns] = useState<IncentiveCampaign[]>([])
  const [show, setShow] = useState(false)
  const [edit, setEdit] = useState<IncentiveCampaign | null>(null)
  const [selected, setSelected] = useState<IncentiveCampaign | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'TRIP_BASED',
    startAt: '',
    endAt: '',
    maxReward: 50000,
    status: 'DRAFT',
  })

  useEffect(() => {
    // Placeholder - would connect to Firestore listener
    setCampaigns([])
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.startAt) return
    
    setLoading(true)
    try {
      const campaignData: any = {
        id: edit?.id || `campaign_${Date.now()}`,
        name: form.name,
        description: form.description || 'No description',
        type: form.type,
        startAt: form.startAt,
        endAt: form.endAt || form.startAt,
        stackable: true,
        maxRewardPerPartner: form.maxReward,
        minDeliveriesToQualify: 10,
        status: form.status,
        isActive: form.status === 'ACTIVE',
        totalRewardsPaid: 0,
        partnersEnrolled: 0,
        successRate: 0,
        createdAt: edit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: edit?.createdBy || user?.uid || 'system',
        updatedBy: user?.uid || 'system',
      }

      const res = edit
        ? await updateDocumentInFirestore('incentiveCampaigns', edit.id, campaignData)
        : await addDocumentToFirestore('incentiveCampaigns', campaignData)
      
      if (res.success) {
        success(edit ? 'Updated!' : 'Created!', form.name)
        setShow(false)
        setEdit(null)
        setForm({ name: '', description: '', type: 'TRIP_BASED', startAt: '', endAt: '', maxReward: 50000, status: 'DRAFT' })
        setCampaigns([...campaigns, campaignData])
      }
    } catch (e: any) {
      success('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await deleteDocumentFromFirestore('incentiveCampaigns', id)
      if (res.success) {
        success('Deleted!', name)
        setCampaigns(campaigns.filter(c => c.id !== id))
      }
    } catch (e: any) {
      success('Error', e.message)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Incentive Campaigns" description="Manage partner incentive programs and rewards" />

      <div className="flex justify-end gap-2">
        <ProtectedAction permission="CREATE_INCENTIVE_CAMPAIGN">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => { setEdit(null); setShow(true); setForm({ name: '', description: '', type: 'TRIP_BASED', startAt: '', endAt: '', maxReward: 50000, status: 'DRAFT' }) }}>
            New Campaign
          </Button>
        </ProtectedAction>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: campaigns.length, color: 'bg-blue-100' },
          { label: 'Active', value: campaigns.filter(c => c.isActive).length, color: 'bg-green-100' },
          { label: 'Total Rewards', value: `₹${campaigns.reduce((s, c) => s + c.totalRewardsPaid, 0).toLocaleString()}`, color: 'bg-amber-100' },
          { label: 'Partners Enrolled', value: campaigns.reduce((s, c) => s + c.partnersEnrolled, 0), color: 'bg-purple-100' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No campaigns yet</div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign.id} className="p-4 space-y-3 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Gift size={20} className="text-[#B32B2C]" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-gray-500">{campaign.type} • {new Date(campaign.startAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {campaign.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-600">Rewards Used</span>
                    <span className="text-xs font-semibold text-gray-900">{campaign.partnersEnrolled} partners</span>
                  </div>
                  <p className="text-xs text-gray-500">₹{campaign.totalRewardsPaid.toLocaleString()} paid</p>
                </div>
              </div>

              <div className="flex gap-2">
                <ProtectedAction permission="VIEW_INCENTIVE_CAMPAIGNS">
                  <Button size="sm" variant="secondary" onClick={() => setSelected(campaign)}>View</Button>
                </ProtectedAction>
                <ProtectedAction permission="EDIT_INCENTIVE_CAMPAIGN">
                  <Button size="sm" variant="secondary" icon={<Edit size={14} />} onClick={() => {setEdit(campaign); setForm({name: campaign.name, description: campaign.description, type: campaign.type, startAt: campaign.startAt, endAt: campaign.endAt, maxReward: campaign.maxRewardPerPartner || 50000, status: campaign.status}); setShow(true)}}>Edit</Button>
                </ProtectedAction>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={show} onClose={() => setShow(false)} title={edit ? 'Edit Campaign' : 'New Campaign'} size="md">
        <form onSubmit={handleSave} className="space-y-3">
          <input type="text" placeholder="Campaign Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Campaign Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
                <option value="TRIP_BASED">Trip Based</option>
                <option value="EARNINGS_BASED">Earnings Based</option>
                <option value="RATING_BASED">Rating Based</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={form.startAt} onChange={e => setForm({...form, startAt: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" required />
            <input type="date" value={form.endAt} onChange={e => setForm({...form, endAt: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" />
            <input type="number" placeholder="Max Reward" value={form.maxReward} onChange={e => setForm({...form, maxReward: Number(e.target.value)})} min="1000" step="1000" className="px-3 py-2 border rounded-lg text-sm" />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="secondary" type="button" onClick={() => setShow(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Campaign Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="bg-purple-50 rounded-xl p-4">
              <h3 className="text-xl font-bold text-gray-900">{selected.name}</h3>
              <p className="text-sm text-gray-600 mt-2">{selected.description}</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Type', value: selected.type },
                  { label: 'Status', value: selected.status },
                  { label: 'Start Date', value: new Date(selected.startAt).toLocaleDateString() },
                  { label: 'End Date', value: new Date(selected.endAt).toLocaleDateString() },
                  { label: 'Rewards Paid', value: `₹${selected.totalRewardsPaid.toLocaleString()}` },
                  { label: 'Partners Enrolled', value: selected.partnersEnrolled },
                  { label: 'Success Rate', value: `${selected.successRate}%` },
                  { label: 'Max Per Partner', value: `₹${selected.maxRewardPerPartner?.toLocaleString() || 0}` },
                ].map(item => (
                  <div key={item.label as string} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <ProtectedAction permission="EDIT_INCENTIVE_CAMPAIGN">
                <Button size="sm" icon={<Edit size={14} />} onClick={() => {setEdit(selected); setForm({name: selected.name, description: selected.description, type: selected.type, startAt: selected.startAt, endAt: selected.endAt, maxReward: selected.maxRewardPerPartner || 50000, status: selected.status}); setSelected(null); setShow(true)}}>Edit</Button>
              </ProtectedAction>
              <ProtectedAction permission="VIEW_INCENTIVE_PROGRESS">
                <Button size="sm" variant="secondary" icon={<BarChart2 size={14} />} onClick={() => {/* Navigate to progress view */}}>View Progress</Button>
              </ProtectedAction>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
