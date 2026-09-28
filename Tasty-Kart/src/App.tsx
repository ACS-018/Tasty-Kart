import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { SidebarProvider } from '@/context/SidebarContext'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Orders = lazy(() => import('@/pages/Orders').then(m => ({ default: m.Orders })))
const Cities = lazy(() => import('@/pages/Cities').then(m => ({ default: m.Cities })))
const EarningRules = lazy(() => import('@/pages/EarningRules').then(m => ({ default: m.EarningRules })))
const IncentiveCampaigns = lazy(() => import('@/pages/IncentiveCampaigns').then(m => ({ default: m.IncentiveCampaigns })))
const WalletTransactions = lazy(() => import('@/pages/WalletTransactions').then(m => ({ default: m.WalletTransactions })))
const Payouts = lazy(() => import('@/pages/Payouts').then(m => ({ default: m.Payouts })))
const FinanceDashboard = lazy(() => import('@/pages/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })))
const OperationsDashboard = lazy(() => import('@/pages/OperationsDashboard').then(m => ({ default: m.OperationsDashboard })))
const Restaurants = lazy(() => import('@/pages/Restaurants').then(m => ({ default: m.Restaurants })))
const RestaurantMenu = lazy(() => import('@/pages/RestaurantMenu').then(m => ({ default: m.RestaurantMenu })))
const RestaurantCategories = lazy(() => import('@/pages/RestaurantCategories').then(m => ({ default: m.RestaurantCategories })))
const FoodCategories = lazy(() => import('@/pages/FoodCategories').then(m => ({ default: m.FoodCategories })))
const FoodItems = lazy(() => import('@/pages/FoodItems').then(m => ({ default: m.FoodItems })))
const Addons = lazy(() => import('@/pages/Addons').then(m => ({ default: m.Addons })))
const Offers = lazy(() => import('@/pages/Offers').then(m => ({ default: m.Offers })))
const Coupons = lazy(() => import('@/pages/Coupons').then(m => ({ default: m.Coupons })))
const Customers = lazy(() => import('@/pages/Customers').then(m => ({ default: m.Customers })))
const DeliveryPartners = lazy(() => import('@/pages/DeliveryPartners').then(m => ({ default: m.DeliveryPartners })))
const DeliveryIncentives = lazy(() => import('@/pages/DeliveryIncentives').then(m => ({ default: m.DeliveryIncentives })))
const DeliveryMapView = lazy(() => import('@/pages/DeliveryMapView').then(m => ({ default: m.DeliveryMapView })))
const SurgeRequests = lazy(() => import('@/pages/SurgeRequests').then(m => ({ default: m.SurgeRequests })))
const Subscriptions = lazy(() => import('@/pages/Subscriptions').then(m => ({ default: m.Subscriptions })))
const Payments = lazy(() => import('@/pages/Payments').then(m => ({ default: m.Payments })))
const Reviews = lazy(() => import('@/pages/Reviews').then(m => ({ default: m.Reviews })))
const Notifications = lazy(() => import('@/pages/Notifications').then(m => ({ default: m.Notifications })))
const Support = lazy(() => import('@/pages/Support').then(m => ({ default: m.Support })))
const Banners = lazy(() => import('@/pages/Banners').then(m => ({ default: m.Banners })))
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const Profile = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })))

function PageLoader() {
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
      <p style={{ color: '#6b7280', fontSize: 14, fontWeight: 600 }}>Loading TastyKart...</p>
      <style>{`@keyframes tk-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <SidebarProvider>
            <ToastProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/cities" element={<Cities />} />
                      <Route path="/earning-rules" element={<EarningRules />} />
                      <Route path="/incentive-campaigns" element={<IncentiveCampaigns />} />
                      <Route path="/wallet-transactions" element={<WalletTransactions />} />
                      <Route path="/payouts" element={<Payouts />} />
                      <Route path="/finance-dashboard" element={<FinanceDashboard />} />
                      <Route path="/operations-dashboard" element={<OperationsDashboard />} />
                      <Route path="/restaurants" element={<Restaurants />} />
                      <Route path="/restaurants/:id" element={<RestaurantMenu />} />
                      <Route path="/restaurant-categories" element={<RestaurantCategories />} />
                      <Route path="/food-categories" element={<FoodCategories />} />
                      <Route path="/food-items" element={<FoodItems />} />
                      <Route path="/addons" element={<Addons />} />
                      <Route path="/offers" element={<Offers />} />
                      <Route path="/coupons" element={<Coupons />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/delivery-partners" element={<DeliveryPartners />} />
                      <Route path="/delivery-map" element={<DeliveryMapView />} />
                      <Route path="/surge-requests" element={<SurgeRequests />} />
                      <Route path="/delivery-incentives" element={<DeliveryIncentives />} />
                      <Route path="/subscriptions" element={<Subscriptions />} />
                      <Route path="/payments" element={<Payments />} />
                      <Route path="/reviews" element={<Reviews />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/support" element={<Support />} />
                      <Route path="/banners" element={<Banners />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<Profile />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
            </ToastProvider>
          </SidebarProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
