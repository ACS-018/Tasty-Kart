import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { createOrUpdateUserProfile, type UserRole } from '@/lib/firebaseService'
import { type AdminRole, hasPermission, canAccessPage, getRoleInfo, type Permission } from '@/lib/permissions'

interface User {
  uid: string
  name: string
  email: string
  role: UserRole
  adminRole: AdminRole | null
  avatar: string
  token?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string; token?: string }>
  logout: () => Promise<void>
  // Permission checking helpers
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  canAccessPage: (page: string) => boolean
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  canAccessPage: () => false,
})

const AUTH_KEY = 'tastykart_auth_user'
const TOKEN_KEY = 'tastykart_auth_token'

/**
 * Map email addresses to admin roles
 * Can be extended with a Firestore collection for dynamic role assignment
 */
const adminRoleMapping: Record<string, AdminRole> = {
  'admin123@gmail.com': 'SUPER_ADMIN',
  'uday@gmail.com': 'OPERATIONS_ADMIN', // Default operations role
}

function getAdminRoleFromEmail(email: string): AdminRole | null {
  const lowerEmail = email.toLowerCase()
  return adminRoleMapping[lowerEmail] || null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY) || null
  })
  const [loading, setLoading] = useState(true)

  // Helper to generate a fallback JWT-style session token if offline
  const generateSessionToken = (uid: string, email: string) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({ uid, email, role: 'admin', iat: Date.now(), exp: Date.now() + 86400000 }))
    const signature = btoa('tastykart_super_admin_secret')
    return `${header}.${payload}.${signature}`
  }

  // Firebase Auth State Synchronization
  useEffect(() => {
    let resolved = false
    const finishLoading = () => {
      if (!resolved) {
        resolved = true
        setLoading(false)
      }
    }

    // Never block the UI forever if Firebase auth is slow/unavailable
    const timeout = window.setTimeout(finishLoading, 2500)

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        let authToken = ''
        try {
          authToken = await fbUser.getIdToken()
        } catch {
          authToken = generateSessionToken(fbUser.uid, fbUser.email || '')
        }

        const isSuperAdmin = fbUser.email?.toLowerCase() === 'admin123@gmail.com'
        const isAdmin = isSuperAdmin || fbUser.email?.toLowerCase() === 'uday@gmail.com'
        const role: UserRole = isAdmin ? 'admin' : 'customer'
        const adminRole = getAdminRoleFromEmail(fbUser.email || '')
        const displayName = isSuperAdmin
          ? 'Super Admin'
          : fbUser.displayName || (fbUser.email === 'uday@gmail.com' ? 'Uday Admin' : fbUser.email?.split('@')[0] || 'User')

        const userData: User = {
          uid: fbUser.uid,
          name: displayName,
          email: fbUser.email || '',
          role: role,
          adminRole: adminRole,
          avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
          token: authToken
        }
        setUser(userData)
        setToken(authToken)
        localStorage.setItem(AUTH_KEY, JSON.stringify(userData))
        localStorage.setItem(TOKEN_KEY, authToken)
      } else if (!localStorage.getItem(AUTH_KEY)) {
        setUser(null)
        setToken(null)
      }
      finishLoading()
    }, (err) => {
      console.warn('Firebase auth state error:', err)
      finishLoading()
    })

    return () => {
      window.clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  const isAuthenticated = !!user

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase()

    // Check supported super admin & admin credentials
    const isSuperAdminCred = cleanEmail === 'admin123@gmail.com' && pass === 'Admin123'
    const isUdayAdminCred = cleanEmail === 'uday@gmail.com' && pass === 'Uday@9618'

    if (!isSuperAdminCred && !isUdayAdminCred) {
      // Try generic Firebase Auth login for registered users
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, pass)
        const idToken = await userCred.user.getIdToken()
        const adminRole = getAdminRoleFromEmail(cleanEmail)
        const userData: User = {
          uid: userCred.user.uid,
          name: userCred.user.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          role: 'customer',
          adminRole: adminRole,
          avatar: userCred.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userCred.user.uid}`,
          token: idToken
        }
        setUser(userData)
        setToken(idToken)
        localStorage.setItem(AUTH_KEY, JSON.stringify(userData))
        localStorage.setItem(TOKEN_KEY, idToken)
        return { success: true, token: idToken }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Invalid credentials. Super Admin login: Admin123@gmail.com / Admin123'
        }
      }
    }

    const name = isSuperAdminCred ? 'Super Admin' : 'Uday Admin'
    const fallbackUid = isSuperAdminCred ? 'super-admin-uid' : 'uday-admin-uid'

    try {
      let userCred
      try {
        userCred = await signInWithEmailAndPassword(auth, cleanEmail, pass)
      } catch (signInErr: any) {
        // If account not created on Firebase Auth yet, auto-create
        try {
          userCred = await createUserWithEmailAndPassword(auth, cleanEmail, pass)
        } catch (createErr: any) {
          console.warn('Firebase user registration info:', createErr)
        }
      }

      let sessionToken = ''
      if (userCred?.user) {
        sessionToken = await userCred.user.getIdToken()
      } else {
        sessionToken = generateSessionToken(fallbackUid, cleanEmail)
      }

      const uid = userCred?.user?.uid || fallbackUid
      const adminRole = getAdminRoleFromEmail(cleanEmail)
      const userData: User = {
        uid: uid,
        name: name,
        email: cleanEmail,
        role: 'admin',
        adminRole: adminRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${isSuperAdminCred ? 'superadmin' : 'uday'}`,
        token: sessionToken
      }

      setUser(userData)
      setToken(sessionToken)
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData))
      localStorage.setItem(TOKEN_KEY, sessionToken)

      // Sync user profile to Firebase Firestore
      createOrUpdateUserProfile({
        uid,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        avatar: userData.avatar
      }).catch(err => console.warn('Firestore profile sync info:', err))

      return { success: true, token: sessionToken }
    } catch (err: any) {
      // Fallback local session token creation
      const sessionToken = generateSessionToken(fallbackUid, cleanEmail)
      const adminRole = getAdminRoleFromEmail(cleanEmail)
      const userData: User = {
        uid: fallbackUid,
        name: name,
        email: cleanEmail,
        role: 'admin',
        adminRole: adminRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${isSuperAdminCred ? 'superadmin' : 'uday'}`,
        token: sessionToken
      }
      setUser(userData)
      setToken(sessionToken)
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData))
      localStorage.setItem(TOKEN_KEY, sessionToken)
      return { success: true, token: sessionToken }
    }
  }

  const logout = async () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(TOKEN_KEY)
    try {
      await firebaseSignOut(auth)
    } catch (err) {
      console.warn('Firebase signout info:', err)
    }
  }

  // Permission checking helper functions
  const checkPermission = (permission: Permission): boolean => {
    if (!user?.adminRole) return false
    return hasPermission(user.adminRole, permission)
  }

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!user?.adminRole) return false
    return permissions.some(p => hasPermission(user.adminRole, p))
  }

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    if (!user?.adminRole) return false
    return permissions.every(p => hasPermission(user.adminRole, p))
  }

  const checkPageAccess = (page: string): boolean => {
    if (!user?.adminRole) return false
    return canAccessPage(user.adminRole, page)
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      token,
      loading,
      login,
      logout,
      hasPermission: checkPermission,
      hasAnyPermission: checkAnyPermission,
      hasAllPermissions: checkAllPermissions,
      canAccessPage: checkPageAccess,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
