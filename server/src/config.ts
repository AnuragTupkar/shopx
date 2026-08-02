import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ADMIN_EMAIL_ALLOWLIST: z.string().default(''),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(16),
})

export const config = schema.parse(process.env)
export const adminEmails = new Set(config.ADMIN_EMAIL_ALLOWLIST.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
