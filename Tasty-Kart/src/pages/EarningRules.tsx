import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, TrendingUp, Loader2, Copy } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { ProtectedAction } from '@/components/shared/ProtectedAction'
import { type EarningRule, type EarningRuleScope } from '@/data/dummy'
import { addDocumentToFirestore, updateDocumentInFirestore, deleteDocumentFromFirestore } from '@/lib/firebaseService'

export function EarningRules() {
  const { user } = useAuth()
  const { success } = useToast()
  
  const [rules, setRules] = useState<EarningRule[]>([])
  const [show, setShow] = useState(false)
  const [edit, setEdit] = useState<EarningRule | null>(null)
  const [selected, setSelected] = useState<EarningRule | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    baseFee: 30,
    city: 'Bangalore',
    scope: 'GLOBAL' as EarningRuleScope,
    priority: 1,
    peakMultiplier: 1.5,
    nightMultiplier: 1.2,
    status: 'ACTIVE',
  })

  // Load rules (would be from Firestore in production)
  useEffect(() => {
    // Placeholder - would connect to real-time listener
    setRules([])
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim()) return
    
    setLoading(true)
    try {
      const ruleData: any = {
        id: edit?.id || `rule_${Date.now()}`,
        cityId: form.city,
        name: form.name,
        description: form.description || undefined,
        scopeType: form.scope,
        effectiveFrom: new Date().toISOString(),
        version: (edit?.version || 0) + 1,
        baseFee: form.baseFee,
        distanceSlabs: [],
        peakHourMultiplier: form.peakMultiplier,
        nightDeliveryMultiplier: form.nightMultiplier,
        priority: form.priority,
        overridePolicy: 'HIGHEST_PRIORITY',
        isActive: form.status === 'ACTIVE',
        status: form.status,
        createdAt: edit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: edit?.createdBy || user?.uid || 'system',
        updatedBy: user?.uid || 'system',
      }

      const res = edit
        ? await updateDocumentInFirestore('earningRules', edit.id, ruleData)
        : await addDocumentToFirestore('earningRules', ruleData)
      
      if (res.success) {
        success(edit ? 'Updated!' : 'Created!', form.name)
        setShow(false)
        setEdit(null)
        setForm({ name: '', description: '', baseFee: 30, city: 'Bangalore', scope: 'CITY', priority: 1, peakMultiplier: 1.5, nightMultiplier: 1.2, status: 'ACTIVE' })
        // Reload rules
        setRules([...rules, ruleData])
      }
    } catch (e: any) {
      success('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await deleteDocumentFromFirestore('earningRules', id)
      if (res.success) {
        success('Deleted!', name)
        setRules(rules.filter(r => r.id !== id))
      }
    } catch (e: any) {
      success('Error', e.message)
    }
  }

  const handleDuplicate = (rule: EarningRule) => {
    setEdit(null)
    setForm({
      name: `${rule.name} (Copy)`,
      description: rule.description || '',
      baseFee: rule.baseFee,
      city: rule.cityId,
      scope: rule.scopeType,
      priority: rule.priority + 1,
      peakMultiplier: rule.peakHourMultiplier || 1.5,
      nightMultiplier: rule.nightDeliveryMultiplier || 1.2,
      status: 'DRAFT',
    })
    setShow(true)
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Earning Rules" description="Define base earnings, multipliers, and distance slabs" />

      <div className="flex justify-end gap-2">
        <ProtectedAction permission="CREATE_EARNING_RULE">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => { setEdit(null); setShow(true); setForm({ name: '', description: '', baseFee: 30, city: 'Bangalore', scope: 'CITY', priority: 1, peakMultiplier: 1.5, nightMultiplier: 1.2, status: 'ACTIVE' }) }}>
            New Rule
          </Button>
        </ProtectedAction>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: rules.length, color: 'bg-blue-100' },
          { label: 'Active', value: rules.filter(r => r.isActive).length, color: 'bg-green-100' },
          { label: 'Avg Base Fee', value: `₹${Math.round(rules.reduce((s, r) => s + r.baseFee, 0) / Math.max(rules.length, 1))}`, color: 'bg-amber-100' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
        {rules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No earning rules yet</div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3 flex-1">
                <TrendingUp size={20} className="text-[#B32B2C]" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-500">Base ₹{rule.baseFee} • Peak {rule.peakHourMultiplier}x • Night {rule.nightDeliveryMultiplier}x • Priority {rule.priority}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {rule.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex gap-2 ml-4">
                <ProtectedAction permission="VIEW_EARNING_RULES">
                  <Button size="sm" variant="secondary" onClick={() => setSelected(rule)}>View</Button>
                </ProtectedAction>
                <ProtectedAction permission="EDIT_EARNING_RULE">
                  <Button size="sm" variant="secondary" icon={<Edit size={14} />} onClick={() => {setEdit(rule); setForm({name: rule.name, description: rule.description || '', baseFee: rule.baseFee, city: rule.cityId, scope: rule.scopeType, priority: rule.priority, peakMultiplier: rule.peakHourMultiplier || 1.5, nightMultiplier: rule.nightDeliveryMultiplier || 1.2, status: rule.status}); setShow(true)}}>Edit</Button>
                </ProtectedAction>
                <ProtectedAction permission="CREATE_EARNING_RULE">
                  <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => handleDuplicate(rule)}>Duplicate</Button>
                </ProtectedAction>
                <ProtectedAction permission="DELETE_EARNING_RULE">
                  <Button size="sm" variant="danger" onClick={() => handleDelete(rule.id, rule.name)}>Delete</Button>
                </ProtectedAction>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={show} onClose={() => setShow(false)} title={edit ? 'Edit Rule' : 'New Earning Rule'} size="md">
        <form onSubmit={handleSave} className="space-y-3">
          <input type="text" placeholder="Rule Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          <input type="text" placeholder="City" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Base Fee (₹)" value={form.baseFee} onChange={e => setForm({...form, baseFee: Number(e.target.value)})} min="10" step="5" className="px-3 py-2 border rounded-lg" />
            <input type="number" placeholder="Priority" value={form.priority} onChange={e => setForm({...form, priority: Number(e.target.value)})} min="1" max="10" className="px-3 py-2 border rounded-lg" />
            <input type="number" placeholder="Peak Multiplier" value={form.peakMultiplier} onChange={e => setForm({...form, peakMultiplier: Number(e.target.value)})} min="1" max="3" step="0.1" className="px-3 py-2 border rounded-lg" />
            <input type="number" placeholder="Night Multiplier" value={form.nightMultiplier} onChange={e => setForm({...form, nightMultiplier: Number(e.target.value)})} min="1" max="3" step="0.1" className="px-3 py-2 border rounded-lg" />
          </div>
          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="secondary" type="button" onClick={() => setShow(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Rule Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="text-xl font-bold text-gray-900">{selected.name}</h3>
              <p className="text-sm text-gray-600 mt-2">{selected.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'City', value: selected.cityId },
                { label: 'Base Fee', value: `₹${selected.baseFee}` },
                { label: 'Priority', value: selected.priority },
                { label: 'Peak Multiplier', value: `${selected.peakHourMultiplier}x` },
                { label: 'Night Multiplier', value: `${selected.nightDeliveryMultiplier}x` },
                { label: 'Status', value: selected.status },
                { label: 'Version', value: selected.version },
                { label: 'Scope', value: selected.scopeType },
              ].map(item => (
                <div key={item.label as string} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-bold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3 border-t">
              <ProtectedAction permission="EDIT_EARNING_RULE">
                <Button size="sm" icon={<Edit size={14} />} onClick={() => {setEdit(selected); setForm({name: selected.name, description: selected.description || '', baseFee: selected.baseFee, city: selected.cityId, scope: selected.scopeType, priority: selected.priority, peakMultiplier: selected.peakHourMultiplier || 1.5, nightMultiplier: selected.nightDeliveryMultiplier || 1.2, status: selected.status}); setSelected(null); setShow(true)}}>Edit</Button>
              </ProtectedAction>
              <ProtectedAction permission="CREATE_EARNING_RULE">
                <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => {handleDuplicate(selected); setSelected(null)}}>Duplicate</Button>
              </ProtectedAction>
              <ProtectedAction permission="DELETE_EARNING_RULE">
                <Button size="sm" variant="danger" onClick={() => {handleDelete(selected.id, selected.name); setSelected(null)}}>Delete</Button>
              </ProtectedAction>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
