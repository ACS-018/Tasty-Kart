import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8F8F8',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '4px solid #B32B2C',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'tk-spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#6b7280', fontSize: 14, fontWeight: 600 }}>Checking session...</p>
        <style>{`@keyframes tk-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
