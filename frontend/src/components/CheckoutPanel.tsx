import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { paymentService } from '../services/paymentService'
import type { DeliveryAddress } from '../types/catalog'

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } } }
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
let razorpayLoader: Promise<void> | undefined
function loadRazorpay() {
  if (!razorpayLoader) razorpayLoader = new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load secure checkout.')); document.body.appendChild(script) })
  return razorpayLoader
}
export function CheckoutPanel() {
  const { user } = useAuth(); const { items, subtotal, clearCart } = useCart(); const navigate = useNavigate()
  const [address, setAddress] = useState<DeliveryAddress>({ fullName: user?.name ?? '', phone: user?.phone ?? '', line1: '', city: '', state: '', postalCode: '' })
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false)
  const change = (field: keyof DeliveryAddress, value: string) => setAddress((current) => ({ ...current, [field]: value }))
  async function checkout(event: React.FormEvent) {
    event.preventDefault(); if (!user) { navigate('/account?mode=login'); return }
    setBusy(true); setStatus('Creating your secure order…')
    try {
      const result = await paymentService.createOrder(items, address); await loadRazorpay()
      if (!window.Razorpay) throw new Error('Secure checkout is unavailable.')
      const gateway = new window.Razorpay({ key: result.razorpay.keyId, amount: result.razorpay.amount, currency: result.razorpay.currency, name: 'ShopX', description: 'ShopX order', order_id: result.razorpay.orderId, prefill: { name: address.fullName, contact: address.phone, email: user.email }, theme: { color: '#173e35' }, handler: async (payment: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try { await paymentService.verifyPayment({ orderId: result.order.id, razorpayPaymentId: payment.razorpay_payment_id, razorpayOrderId: payment.razorpay_order_id, razorpaySignature: payment.razorpay_signature }); clearCart(); navigate('/profile?paid=true') } catch (error) { setStatus(error instanceof Error ? error.message : 'Payment could not be verified.') }
      }, modal: { confirm_close: true } })
      gateway.open(); setStatus('Complete payment in the secure Razorpay window.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to start checkout.') } finally { setBusy(false) }
  }
  return <aside className="h-fit rounded-[20px] bg-sand p-6"><h2 className="font-display text-2xl text-forest">Order summary</h2><div className="mt-6 flex justify-between text-sm"><span className="text-ink/60">Subtotal</span><span className="font-semibold">{money.format(subtotal)}</span></div><div className="mt-3 flex justify-between text-sm"><span className="text-ink/60">Delivery</span><span className="font-semibold text-forest">Free</span></div><div className="my-5 border-t border-ink/10" /><div className="flex justify-between text-lg font-bold text-forest"><span>Total</span><span>{money.format(subtotal)}</span></div>{user ? <form onSubmit={checkout} className="mt-6 grid gap-2"><p className="text-xs font-bold uppercase tracking-wider text-forest/65">Delivery address</p><input required value={address.fullName} onChange={(e) => change('fullName', e.target.value)} placeholder="Full name" className="checkout-input" /><input required value={address.phone} onChange={(e) => change('phone', e.target.value)} placeholder="Phone number" className="checkout-input" /><input required value={address.line1} onChange={(e) => change('line1', e.target.value)} placeholder="Address line" className="checkout-input" /><div className="grid grid-cols-2 gap-2"><input required value={address.city} onChange={(e) => change('city', e.target.value)} placeholder="City" className="checkout-input" /><input required value={address.state} onChange={(e) => change('state', e.target.value)} placeholder="State" className="checkout-input" /></div><input required value={address.postalCode} onChange={(e) => change('postalCode', e.target.value)} placeholder="Postal code" className="checkout-input" /><button disabled={busy} className="primary-button mt-2 w-full">{busy ? 'Preparing order…' : 'Pay securely'}</button></form> : <button onClick={() => navigate('/account?mode=login')} className="primary-button mt-6 w-full">Sign in to checkout</button>}<p className="mt-3 flex items-center justify-center gap-1 text-center text-xs leading-5 text-ink/48"><LockKeyhole size={13} /> Razorpay Test Mode secure checkout</p>{status && <p className="mt-3 text-center text-xs text-forest">{status}</p>}</aside>
}
