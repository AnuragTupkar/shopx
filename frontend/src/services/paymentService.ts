import { apiBaseUrl } from './catalogRepository'
import type { CartItem, DeliveryAddress, ShopOrder } from '../types/catalog'

export interface PaymentService {
  createOrder(items: CartItem[], deliveryAddress: DeliveryAddress): Promise<{ order: { id: string }; razorpay: { keyId: string; orderId: string; amount: number; currency: string } }>
  verifyPayment(input: { orderId: string; razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string }): Promise<{ order: ShopOrder }>
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(data.message ?? 'Request failed.')
  return data
}

export const paymentService: PaymentService = {
  createOrder(items, deliveryAddress) {
    return request('/payments/order', { items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })), deliveryAddress })
  },
  verifyPayment(input) {
    return request('/payments/verify', input)
  },
}
