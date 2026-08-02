import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { accountService } from '../services/accountService'
import type { UserProfile } from '../types/catalog'

interface AuthValue { user: UserProfile | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<void>; logout: () => Promise<void>; updateProfile: (name: string, phone: string) => Promise<void> }
const AuthContext = createContext<AuthValue | undefined>(undefined)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null); const [loading, setLoading] = useState(true)
  useEffect(() => { void accountService.me().then(({ user }) => setUser(user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const value = useMemo<AuthValue>(() => ({ user, loading,
    login: async (email, password) => { const { user } = await accountService.login({ email, password }); setUser(user) },
    register: async (input) => { const { user } = await accountService.register(input); setUser(user) },
    logout: async () => { await accountService.logout(); setUser(null) },
    updateProfile: async (name, phone) => { const { user } = await accountService.updateProfile({ name, phone }); setUser(user) },
  }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context }
