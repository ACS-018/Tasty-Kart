import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { motion } from 'framer-motion'

export function Layout() {
  return (
    <div className="flex h-screen bg-[#F8F8F8] dark:bg-gray-950 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6 max-w-[1600px] mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
