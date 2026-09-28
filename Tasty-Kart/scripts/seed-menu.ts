/**
 * Seeds restaurant + menu dummy data into Firestore.
 * Run: npx tsx scripts/seed-menu.ts
 */
import {
  seedRestaurantMenuToFirebase,
} from '../src/lib/firebaseService.ts'

const result = await seedRestaurantMenuToFirebase((msg) => console.log('→', msg))

if (!result.success) {
  console.error('FAILED:', result.error)
  process.exit(1)
}

console.log('\n✅ Seeded to Firebase (tastykart-b791a):')
console.table(result.counts)
process.exit(0)
