export type CategorySlug = 'electronics' | 'fashion' | 'furniture'

export interface Product {
  id: string
  slug: string
  category: CategorySlug
  name: string
  description: string
  price: number
  originalPrice?: number
  rating: number
  reviews: number
  badge?: string
  image: string
  colors: string[]
  featured?: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Cart {
  items: CartItem[]
}

export interface OrderDraft {
  items: Array<{ productId: string; quantity: number }>
  subtotal: number
  currency: 'INR'
}

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  role: 'customer' | 'admin'
}

export interface DeliveryAddress {
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
}

export interface ShopOrder {
  id: string
  userId: string
  items: Array<{ productId: string; slug: string; name: string; image: string; pricePaise: number; quantity: number }>
  deliveryAddress: DeliveryAddress
  amountPaise: number
  currency: 'INR'
  paymentStatus: 'pending' | 'paid' | 'failed'
  fulfillmentStatus: 'processing' | 'shipped' | 'delivered'
  createdAt: string
}

export interface RefundRequest {
  id: string
  order: string
  requestedBy: string
  reason: string
  status: 'requested' | 'resolved'
  resolutionNote?: string
  createdAt: string
}
