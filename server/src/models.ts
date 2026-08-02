import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const base: any = { timestamps: true, versionKey: false }

export const User = models.User ?? model('User', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, trim: true, maxlength: 24 },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
}, base))

export const Product = models.Product ?? model('Product', new Schema({
  _id: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  category: { type: String, required: true, enum: ['electronics', 'fashion', 'furniture'], index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, min: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviews: { type: Number, default: 0, min: 0 },
  badge: { type: String, trim: true },
  image: { type: String, required: true },
  colors: { type: [String], default: [] },
  featured: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
}, base))

const orderItem = new Schema({ productId: String, slug: String, name: String, image: String, pricePaise: Number, quantity: Number }, { _id: false })
const address = new Schema({ fullName: String, phone: String, line1: String, line2: String, city: String, state: String, postalCode: String }, { _id: false })
export const Order = models.Order ?? model('Order', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItem], required: true },
  deliveryAddress: { type: address, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending', index: true },
  fulfillmentStatus: { type: String, enum: ['processing', 'shipped', 'delivered'], default: 'processing' },
  razorpayOrderId: { type: String, unique: true, sparse: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  paymentSignature: { type: String, select: false },
}, base))

export const RefundRequest = models.RefundRequest ?? model('RefundRequest', new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, trim: true, maxlength: 600 },
  status: { type: String, enum: ['requested', 'resolved'], default: 'requested' },
  resolutionNote: { type: String, trim: true, maxlength: 600 },
}, base))

export const WebhookEvent = models.WebhookEvent ?? model('WebhookEvent', new Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  outcome: { type: String, required: true },
}, base))
