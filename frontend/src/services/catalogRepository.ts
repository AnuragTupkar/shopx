import type { CategorySlug, Product } from '../types/catalog'

export interface CatalogRepository {
  getFeaturedProducts(): Promise<Product[]>
  listProducts(filters?: { category?: CategorySlug; query?: string }): Promise<Product[]>
  getProductBySlug(slug: string): Promise<Product | undefined>
}

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' })
  if (!response.ok) throw new Error('Unable to load ShopX data. Start the API and seed MongoDB Atlas.')
  return response.json() as Promise<T>
}

export const catalogRepository: CatalogRepository = {
  getFeaturedProducts: () => get<Product[]>('/products/featured'),
  listProducts: (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.category) params.set('category', filters.category)
    if (filters.query) params.set('q', filters.query)
    return get<Product[]>(`/products${params.size ? `?${params}` : ''}`)
  },
  getProductBySlug: async (slug) => {
    const response = await fetch(`${apiBaseUrl}/products/${slug}`, { credentials: 'include' })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error('Unable to load this product.')
    return response.json() as Promise<Product>
  },
}
