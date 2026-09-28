import { createContext, useContext, useState, type ReactNode } from 'react'

interface SidebarContextType {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapse: () => void
  toggleMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  mobileOpen: false,
  toggleCollapse: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SidebarContext.Provider value={{
      collapsed,
      mobileOpen,
      toggleCollapse: () => setCollapsed(c => !c),
      toggleMobile: () => setMobileOpen(o => !o),
      closeMobile: () => setMobileOpen(false),
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
