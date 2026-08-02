import type { CategorySlug } from '../types/catalog'

export const SHOP_CATEGORIES: Array<{ slug: CategorySlug; name: string; image: string; accent: string }> = [
  { slug: 'electronics', name: 'Electronics', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85', accent: '#315a71' },
  { slug: 'fashion', name: 'Fashion', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85', accent: '#b8664b' },
  { slug: 'furniture', name: 'Furniture', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85', accent: '#6b7753' },
]
