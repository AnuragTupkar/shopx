import mongoose from 'mongoose'
import { config } from './config.js'
import { Product } from './models.js'
import { seedProducts } from './seed-data.js'

await mongoose.connect(config.MONGODB_URI)
await Promise.all(seedProducts.map(({ id, ...product }) => Product.updateOne({ _id: id }, { $set: product }, { upsert: true })))
console.log(`Seeded ${seedProducts.length} products across Electronics, Fashion, and Furniture.`)
await mongoose.disconnect()
