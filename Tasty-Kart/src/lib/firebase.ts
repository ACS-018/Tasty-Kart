import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics, isSupported } from 'firebase/analytics'

// Web app's Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyB-QlfBbJvM1birb8ChxkbyndqgGnIawS0",
  authDomain: "tastykart-b791a.firebaseapp.com",
  projectId: "tastykart-b791a",
  storageBucket: "tastykart-b791a.firebasestorage.app",
  messagingSenderId: "1045450942825",
  appId: "1:1045450942825:web:2a233d7750e2328466f5f8",
  measurementId: "G-3C5EJ35NNB"
}

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

// Initialize Firebase Services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Analytics (optional browser support check)
export let analytics: ReturnType<typeof getAnalytics> | null = null
if (typeof window !== 'undefined') {
  isSupported().then(yes => {
    if (yes) analytics = getAnalytics(app)
  })
}

export default app
