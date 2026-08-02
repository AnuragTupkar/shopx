import { apiBaseUrl } from './catalogRepository'
import type { Product, RefundRequest, ShopOrder, UserProfile } from '../types/catalog'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  const data = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(data.message ?? 'Request failed.')
  return data
}
export const accountService = {
  register: (input: { name: string; email: string; password: string; phone?: string }) => api<{ user: UserProfile }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => api<{ user: UserProfile }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: async () => { await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' }) },
  me: () => api<{ user: UserProfile }>('/auth/me'),
  updateProfile: (input: Pick<UserProfile, 'name' | 'phone'>) => api<{ user: UserProfile }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(input) }),
  orders: () => api<ShopOrder[]>('/orders/me'),
  adminOrders: () => api<ShopOrder[]>('/admin/orders'),
  adminCustomers: () => api<UserProfile[]>('/admin/customers'),
  adminProducts: () => api<Product[]>('/admin/products'),
  createProduct: (input: Omit<Product, 'id'>) => api<Product>('/admin/products', { method: 'POST', body: JSON.stringify(input) }),
  updateProduct: (id: string, input: Partial<Omit<Product, 'id'>>) => api<Product>(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  archiveProduct: (id: string) => api<Product>(`/admin/products/${id}/archive`, { method: 'POST' }),
  updateFulfillment: (id: string, fulfillmentStatus: ShopOrder['fulfillmentStatus']) => api<ShopOrder>(`/admin/orders/${id}/fulfillment`, { method: 'PATCH', body: JSON.stringify({ fulfillmentStatus }) }),
  refundRequests: () => api<RefundRequest[]>('/admin/refund-requests'),
  createRefundRequest: (orderId: string, reason: string) => api<RefundRequest>('/admin/refund-requests', { method: 'POST', body: JSON.stringify({ orderId, reason }) }),
  resolveRefundRequest: (id: string, resolutionNote: string) => api<RefundRequest>(`/admin/refund-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', resolutionNote }) }),
}
