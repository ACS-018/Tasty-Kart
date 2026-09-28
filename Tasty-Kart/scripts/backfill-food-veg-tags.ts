/**
 * Backfill foodType + veg/nonveg tags on all foodItems in Firestore.
 * Run: npx tsx scripts/backfill-food-veg-tags.ts
 */
import { backfillFoodItemVegTagsInFirestore } from '../src/lib/firebaseService.ts'

const result = await backfillFoodItemVegTagsInFirestore((msg) => console.log('→', msg))

if (!result.success) {
  console.error('FAILED:', result.error)
  process.exit(1)
}

console.log(`\n✅ Updated ${result.updated} food items with veg/nonveg tags`)
process.exit(0)
