import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import morgan from 'morgan'
import Razorpay from 'razorpay'
import { z, ZodError } from 'zod'
import { adminEmails, config } from './config.js'
import { clearSession, publicUser, requireAdmin, requireAuth, setSession, type AuthRequest } from './auth.js'
import { Order, Product, RefundRequest, User, WebhookEvent } from './models.js'

const app = express()
const razorpay = new Razorpay({ key_id: config.RAZORPAY_KEY_ID, key_secret: config.RAZORPAY_KEY_SECRET })
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })
const paymentLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false })

app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }))
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'))

function asyncRoute(handler: (request: any, response: Response) => Promise<unknown>) { return (request: Request, response: Response, next: NextFunction) => Promise.resolve(handler(request, response)).catch(next) }
function toProduct(document: any) { const { _id, archived, ...product } = document; return { id: String(_id), ...product } }
function toOrder(document: any) { const { _id, user, __v, ...order } = document; return { id: String(_id), userId: String(user), ...order } }
function toRefundRequest(document: any) { const { _id, __v, ...refundRequest } = document; return { id: String(_id), ...refundRequest, order: String(document.order), requestedBy: String(document.requestedBy) } }
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const productInput = z.object({ id: z.string().trim().min(3).optional(), slug, category: z.enum(['electronics', 'fashion', 'furniture']), name: z.string().trim().min(2).max(160), description: z.string().trim().min(10).max(1000), price: z.number().nonnegative(), originalPrice: z.number().nonnegative().optional(), rating: z.number().min(0).max(5).default(0), reviews: z.number().int().nonnegative().default(0), badge: z.string().trim().max(40).optional(), image: z.string().url(), colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(8).default([]), featured: z.boolean().default(false) })

// Razorpay requires the exact raw request body for webhook signature verification.
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), asyncRoute(async (request, response) => {
  const signature = request.header('x-razorpay-signature') ?? ''
  const body = request.body as Buffer
  const expected = crypto.createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex')
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return response.status(400).json({ message: 'Invalid webhook signature.' })
  const payload = JSON.parse(body.toString('utf8')) as { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } }
  const eventId = request.header('x-razorpay-event-id') ?? crypto.createHash('sha256').update(body).digest('hex')
  if (await WebhookEvent.exists({ eventId })) return response.status(200).json({ received: true, duplicate: true })
  const eventType = payload.event ?? 'unknown'
  const razorpayOrderId = payload.payload?.payment?.entity?.order_id
  let outcome = 'ignored'
  if (razorpayOrderId && eventType === 'payment.captured') {
    const updated = await Order.findOneAndUpdate({ razorpayOrderId, paymentStatus: { $ne: 'paid' } }, { paymentStatus: 'paid', razorpayPaymentId: payload.payload?.payment?.entity?.id }, { new: true })
    outcome = updated ? 'payment_marked_paid' : 'payment_already_recorded'
  } else if (razorpayOrderId && eventType === 'payment.failed') {
    await Order.updateOne({ razorpayOrderId, paymentStatus: 'pending' }, { paymentStatus: 'failed' })
    outcome = 'payment_marked_failed'
  }
  await WebhookEvent.create({ eventId, eventType, outcome })
  response.status(200).json({ received: true })
}))

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', (_request, response) => response.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting' }))

app.get('/api/products', asyncRoute(async (request, response) => {
  const category = typeof request.query.category === 'string' ? request.query.category : undefined
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : undefined
  const featured = request.query.featured === 'true'
  const filter: Record<string, unknown> = { archived: false }
  if (category) filter.category = category
  if (featured) filter.featured = true
  if (query) filter.$or = [{ name: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } }, { category: { $regex: query, $options: 'i' } }]
  const data = await Product.find(filter).sort({ featured: -1, createdAt: -1 }).lean(); response.json(data.map(toProduct))
}))
app.get('/api/products/featured', asyncRoute(async (_request, response) => { const data = await Product.find({ archived: false, featured: true }).lean(); response.json(data.map(toProduct)) }))
app.get('/api/products/:slug', asyncRoute(async (request, response) => { const product = await Product.findOne({ slug: request.params.slug, archived: false }).lean(); if (!product) { response.status(404).json({ message: 'Product not found.' }); return } response.json(toProduct(product)) }))

const registerInput = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(8).max(72), phone: z.string().trim().max(24).optional() })
app.post('/api/auth/register', authLimit, asyncRoute(async (request, response) => {
  const input = registerInput.parse(request.body); const email = input.email.toLowerCase()
  if (await User.exists({ email })) { response.status(409).json({ message: 'An account already exists for this email.' }); return }
  const user = await User.create({ name: input.name, email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12), role: adminEmails.has(email) ? 'admin' : 'customer' })
  setSession(response, user); response.status(201).json({ user: publicUser(user) })
}))
app.post('/api/auth/login', authLimit, asyncRoute(async (request, response) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(request.body)
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) { response.status(401).json({ message: 'Invalid email or password.' }); return }
  setSession(response, user); response.json({ user: publicUser(user) })
}))
app.post('/api/auth/logout', (_request, response) => { clearSession(response); response.status(204).end() })
app.get('/api/auth/me', requireAuth, asyncRoute(async (request: AuthRequest, response) => { const user = await User.findById(request.user!.id).lean(); if (!user) { response.status(401).json({ message: 'Session is no longer valid.' }); return } response.json({ user: publicUser(user) }) }))
app.patch('/api/auth/profile', requireAuth, asyncRoute(async (request: AuthRequest, response) => { const input = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(24).optional() }).parse(request.body); const user = await User.findByIdAndUpdate(request.user!.id, input, { new: true }).lean(); response.json({ user: publicUser(user!) }) }))

const checkoutInput = z.object({ items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) })).min(1).max(20), deliveryAddress: z.object({ fullName: z.string().trim().min(2).max(80), phone: z.string().trim().min(7).max(24), line1: z.string().trim().min(4).max(160), line2: z.string().trim().max(160).optional(), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), postalCode: z.string().trim().min(4).max(12) }) })
app.post('/api/payments/order', paymentLimit, requireAuth, asyncRoute(async (request: AuthRequest, response) => {
  const input = checkoutInput.parse(request.body); const ids = [...new Set(input.items.map((item) => item.productId))]
  const products = await Product.find({ _id: { $in: ids }, archived: false }).lean(); if (products.length !== ids.length) { response.status(400).json({ message: 'One or more products are unavailable.' }); return }
  const byId = new Map(products.map((product) => [String(product._id), product]))
  const items = input.items.map((item) => { const product = byId.get(item.productId)!; return { productId: String(product._id), slug: product.slug, name: product.name, image: product.image, pricePaise: Math.round(product.price * 100), quantity: item.quantity } })
  const amountPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0)
  const order = await Order.create({ user: request.user!.id, items, deliveryAddress: input.deliveryAddress, amountPaise, currency: 'INR' })
  try {
    const razorpayOrder = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt: `sx_${String(order._id)}`, notes: { shopx_order_id: String(order._id), customer_id: request.user!.id } })
    order.razorpayOrderId = razorpayOrder.id; await order.save()
    response.status(201).json({ order: { id: String(order._id), amountPaise, currency: 'INR' }, razorpay: { keyId: config.RAZORPAY_KEY_ID, orderId: razorpayOrder.id, amount: amountPaise, currency: 'INR' } })
  } catch (error) { await Order.findByIdAndDelete(order._id); throw error }
}))
app.post('/api/payments/verify', paymentLimit, requireAuth, asyncRoute(async (request: AuthRequest, response) => {
  const input = z.object({ orderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpayOrderId: z.string().min(1), razorpaySignature: z.string().min(1) }).parse(request.body)
  const order = await Order.findOne({ _id: input.orderId, user: request.user!.id }).select('+paymentSignature')
  if (!order || order.razorpayOrderId !== input.razorpayOrderId) { response.status(404).json({ message: 'Payment order not found.' }); return }
  const expected = crypto.createHmac('sha256', config.RAZORPAY_KEY_SECRET).update(`${order.razorpayOrderId}|${input.razorpayPaymentId}`).digest('hex')
  if (input.razorpaySignature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(input.razorpaySignature), Buffer.from(expected))) { response.status(400).json({ message: 'Payment verification failed.' }); return }
  if (order.paymentStatus === 'paid') { response.json({ order: toOrder(order.toObject()) }); return }
  order.paymentStatus = 'paid'; order.razorpayPaymentId = input.razorpayPaymentId; order.paymentSignature = input.razorpaySignature; await order.save()
  response.json({ order: toOrder(order.toObject()) })
}))

app.get('/api/orders/me', requireAuth, asyncRoute(async (request: AuthRequest, response) => { const orders = await Order.find({ user: request.user!.id }).sort({ createdAt: -1 }).lean(); response.json(orders.map(toOrder)) }))

app.use('/api/admin', requireAuth, requireAdmin)
app.get('/api/admin/products', asyncRoute(async (_request, response) => { const data = await Product.find().sort({ updatedAt: -1 }).lean(); response.json(data.map(toProduct)) }))
app.post('/api/admin/products', asyncRoute(async (request, response) => { const input = productInput.parse(request.body); const id = input.id ?? `prd-${crypto.randomUUID().slice(0, 8)}`; const product = await Product.create({ _id: id, ...input, id: undefined }); response.status(201).json(toProduct(product.toObject())) }))
app.patch('/api/admin/products/:id', asyncRoute(async (request, response) => { const input = productInput.partial().omit({ id: true }).parse(request.body); const product = await Product.findByIdAndUpdate(request.params.id, input, { new: true }); if (!product) { response.status(404).json({ message: 'Product not found.' }); return } response.json(toProduct(product.toObject())) }))
app.post('/api/admin/products/:id/archive', asyncRoute(async (request, response) => { const product = await Product.findByIdAndUpdate(request.params.id, { archived: true }, { new: true }); if (!product) { response.status(404).json({ message: 'Product not found.' }); return } response.json(toProduct(product.toObject())) }))
app.get('/api/admin/customers', asyncRoute(async (_request, response) => { const users = await User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean(); response.json(users.map(publicUser)) }))
app.get('/api/admin/orders', asyncRoute(async (_request, response) => { const orders = await Order.find().sort({ createdAt: -1 }).lean(); response.json(orders.map(toOrder)) }))
app.patch('/api/admin/orders/:id/fulfillment', asyncRoute(async (request, response) => { const input = z.object({ fulfillmentStatus: z.enum(['processing', 'shipped', 'delivered']) }).parse(request.body); const order = await Order.findOneAndUpdate({ _id: request.params.id, paymentStatus: 'paid' }, input, { new: true }); if (!order) { response.status(404).json({ message: 'A paid order was not found.' }); return } response.json(toOrder(order.toObject())) }))
app.get('/api/admin/refund-requests', asyncRoute(async (_request, response) => { const data = await RefundRequest.find().sort({ createdAt: -1 }).lean(); response.json(data.map(toRefundRequest)) }))
app.post('/api/admin/refund-requests', asyncRoute(async (request: AuthRequest, response) => { const input = z.object({ orderId: z.string().min(1), reason: z.string().trim().min(5).max(600) }).parse(request.body); const order = await Order.findOne({ _id: input.orderId, paymentStatus: 'paid' }); if (!order) { response.status(404).json({ message: 'A paid order was not found.' }); return } const refundRequest = await RefundRequest.create({ order: order._id, requestedBy: request.user!.id, reason: input.reason }); response.status(201).json(toRefundRequest(refundRequest.toObject())) }))
app.patch('/api/admin/refund-requests/:id', asyncRoute(async (request, response) => { const input = z.object({ status: z.enum(['requested', 'resolved']), resolutionNote: z.string().trim().max(600).optional() }).parse(request.body); const refundRequest = await RefundRequest.findByIdAndUpdate(request.params.id, input, { new: true }); if (!refundRequest) { response.status(404).json({ message: 'Refund request not found.' }); return } response.json(toRefundRequest(refundRequest.toObject())) }))

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) return response.status(400).json({ message: 'Invalid request data.', issues: error.issues })
  if (error instanceof mongoose.Error.ValidationError) return response.status(400).json({ message: error.message })
  if ((error as { code?: number }).code === 11000) return response.status(409).json({ message: 'A record with this value already exists.' })
  if (typeof error === 'object' && error && 'status' in error) { const typedError = error as { status: number; message?: string }; return response.status(typedError.status).json({ message: typedError.message ?? 'Request failed.' }) }
  console.error(error)
  response.status(500).json({ message: 'Something went wrong. Please try again.' })
})

await mongoose.connect(config.MONGODB_URI)
app.listen(config.PORT, () => console.log(`ShopX API listening on http://localhost:${config.PORT}`))
