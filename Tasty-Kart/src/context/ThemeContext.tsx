import { createContext, useContext, type ReactNode } from 'react'

type Theme = 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme?: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Force light mode only - dark mode disabled
  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}