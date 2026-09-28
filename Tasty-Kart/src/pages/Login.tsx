import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Utensils, KeyRound, AlertCircle, ArrowRight, CheckCircle2, Sparkles, Store, Bike, Star } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

export function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, loading } = useAuth()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated (after auth state resolves)
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  const handleQuickFillSuperAdmin = () => {
    setEmail('Admin123@gmail.com')
    setPassword('Admin123')
    setErrorMsg('')
    toast.info('Super Admin Auto-filled', 'Admin123@gmail.com & Admin123 filled')
  }

  const handleQuickFillAdmin = () => {
    setEmail('uday@gmail.com')
    setPassword('Uday@9618')
    setErrorMsg('')
    toast.info('Admin Auto-filled', 'uday@gmail.com & Uday@9618 filled')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    setIsLoading(true)

    try {
      const res = await login(email, password)
      setIsLoading(false)

      if (res.success) {
        toast.success('Welcome Super Admin!', `Authenticated session active. Token generated.`)
        navigate('/', { replace: true })
      } else {
        setErrorMsg(res.message || 'Invalid credentials')
        toast.error('Authentication Failed', 'Check credentials and try again')
      }
    } catch (err: any) {
      setIsLoading(false)
      setErrorMsg(err?.message || 'Authentication error')
    }
  }

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-950 flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* ── LEFT HALF: Full-Screen Form Area (White & Primary Red) ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative bg-white dark:bg-gray-950">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#B32B2C] text-[#fff] flex items-center justify-center shadow-lg shadow-red-900/30">
              <Utensils size={22} />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white block">TastyKart</span>
              <span className="text-[10px] font-bold text-[#B32B2C] uppercase tracking-widest block -mt-1">Admin Portal</span>
            </div>
          </div>

          
        </div>

        {/* Main Form Center Box */}
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-[#B32B2C] dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-900/50 mb-3">
              <Sparkles size={13} /> Super Admin Portal
            </span>
            
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Sign In to Dashboard</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Enter your authorized administrator credentials to manage TastyKart operations.
            </p>

            {/* Quick Fill Credentials Banner */}
            <div className="mt-6 p-4 rounded-2xl bg-red-50/60 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#B32B2C] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Super Admin Credentials</p>
                    <p className="text-[11px] font-mono text-[#B32B2C] dark:text-red-400 font-bold">Admin123@gmail.com</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleQuickFillSuperAdmin}
                  className="px-3 py-1.5 rounded-xl bg-[#B32B2C] hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-900/30 transition-all shrink-0"
                >
                  Auto-fill Super Admin
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-red-100 dark:border-red-900/30">
                <span className="text-[11px] text-gray-500 font-mono">uday@gmail.com</span>
                <button
                  type="button"
                  onClick={handleQuickFillAdmin}
                  className="text-xs font-bold text-[#B32B2C] hover:underline"
                >
                  Fill Admin
                </button>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-[#B32B2C] dark:text-red-300 text-xs flex items-center gap-2.5 font-semibold"
              >
                <AlertCircle size={18} className="shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="uday@gmail.com"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C] focus:bg-white dark:focus:bg-gray-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C] focus:bg-white dark:focus:bg-gray-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#B32B2C] hover:bg-red-700 text-white font-extrabold text-sm shadow-xl shadow-red-900/30 border border-red-400/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 dark:border-gray-900 pt-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-emerald-500" /> 256-Bit Encrypted Portal
          </span>
          <span>© 2026 TastyKart Admin</span>
        </div>
      </div>

      {/* ── RIGHT HALF: Full-Screen Primary Red Brand Hero Panel ── */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#B32B2C] via-red-700 to-red-900 p-12 lg:p-16 text-white flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/20 rounded-full blur-3xl pointer-events-none" />

        {/* Right Top Status */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold border border-white/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live System: 100% Operational
          </span>
          <span className="text-xs text-red-100 font-medium">Bangalore Dispatch Node</span>
        </div>

        {/* Right Center Hero Quote & Telemetry */}
        <div className="relative z-10 my-auto max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-6 border border-white/20">
            <Utensils size={32} className="text-white" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Real-time Food Delivery Dispatch & Control
          </h2>
          <p className="text-base text-red-100 mt-4 leading-relaxed font-normal">
            Manage live orders, partner kitchens, driver fleets, menu heatmaps, and financial analytics with complete operational clarity.
          </p>

          {/* Quick Metrics Cards Strip */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/20">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
              <div className="flex items-center gap-1.5 text-xs text-red-200 font-medium mb-1">
                <Store size={14} /> Kitchens
              </div>
              <span className="text-2xl font-black">128</span>
              <span className="text-[10px] text-emerald-300 block font-semibold mt-0.5">+2.4% this mo</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
              <div className="flex items-center gap-1.5 text-xs text-red-200 font-medium mb-1">
                <Bike size={14} /> Fleet
              </div>
              <span className="text-2xl font-black">94</span>
              <span className="text-[10px] text-emerald-300 block font-semibold mt-0.5">38 Active now</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
              <div className="flex items-center gap-1.5 text-xs text-red-200 font-medium mb-1">
                <Star size={14} /> CSAT Score
              </div>
              <span className="text-2xl font-black">4.8 / 5</span>
              <span className="text-[10px] text-red-200 block font-semibold mt-0.5">1,420 Reviews</span>
            </div>
          </div>
        </div>

        {/* Right Bottom Footer Quote */}
        <div className="relative z-10 pt-6 border-t border-white/20 flex items-center justify-between text-xs text-red-100">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" /> Guaranteed 99.9% Telemetry Uptime
          </span>
          <span className="font-mono">v2.4.0-prod</span>
        </div>
      </div>
    </div>
  )
}
