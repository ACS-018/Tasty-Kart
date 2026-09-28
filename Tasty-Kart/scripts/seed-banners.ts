/**
 * Update banner documents in Firestore with tap navigation fields.
 * Run: npx tsx scripts/seed-banners.ts
 */
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../src/lib/firebase.ts'
import { SEED_BANNERS } from '../src/lib/firebaseService.ts'

for (const banner of SEED_BANNERS) {
  await setDoc(doc(db, 'banners', banner.id), banner, { merge: true })
  console.log('→', banner.id, banner.tapAction, banner.restaurantName || banner.webUrl || 'none')
}

console.log(`\n✅ Updated ${SEED_BANNERS.length} banners in Firebase`)
