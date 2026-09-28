import { Leaf, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FoodType } from '@/lib/foodItemUtils'

type Props = {
  value: FoodType
  onChange: (value: FoodType) => void
  label?: string
  required?: boolean
}

export function VegNonVegPicker({ value, onChange, label = 'Food Type', required }: Props) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
        {label}{required ? ' *' : ''}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('veg')}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors',
            value === 'veg'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 text-gray-500 hover:border-green-300 hover:bg-green-50/50'
          )}
        >
          <Leaf size={16} className="text-green-600" />
          Veg
        </button>
        <button
          type="button"
          onClick={() => onChange('nonveg')}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors',
            value === 'nonveg'
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50/50'
          )}
        >
          <Flame size={16} className="text-red-600" />
          Non-Veg
        </button>
      </div>
    </div>
  )
}

export function VegNonVegBadge({ foodType, isVeg }: { foodType?: FoodType; isVeg?: boolean }) {
  const type: FoodType = foodType ?? (isVeg ? 'veg' : 'nonveg')
  const isVegType = type === 'veg'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md',
        isVegType ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
      )}
    >
      {isVegType ? <Leaf size={10} /> : <Flame size={10} />}
      {isVegType ? 'Veg' : 'Non-Veg'}
    </span>
  )
}
