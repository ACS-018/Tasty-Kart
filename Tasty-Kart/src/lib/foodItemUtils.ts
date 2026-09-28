import type { FoodItem } from '@/data/dummy'

export type FoodType = 'veg' | 'nonveg'

/** Normalize isVeg, foodType, and tags so every item has a veg/nonveg tag. */
export function normalizeFoodItemVegFields(
  item: Partial<FoodItem> & { isVeg?: boolean; foodType?: string; tags?: string[] }
): Pick<FoodItem, 'foodType' | 'isVeg' | 'tags'> {
  const foodType: FoodType =
    item.foodType === 'veg' || item.foodType === 'nonveg'
      ? item.foodType
      : item.isVeg
        ? 'veg'
        : 'nonveg'

  const isVeg = foodType === 'veg'
  const otherTags = (item.tags || []).filter(t => t !== 'veg' && t !== 'nonveg')
  const tags = [foodType, ...otherTags]

  return { foodType, isVeg, tags }
}

export function getFoodTypeLabel(item: Pick<FoodItem, 'foodType' | 'isVeg'>): string {
  const type = item.foodType ?? (item.isVeg ? 'veg' : 'nonveg')
  return type === 'veg' ? 'Veg' : 'Non-Veg'
}
