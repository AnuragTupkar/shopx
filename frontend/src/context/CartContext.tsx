import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Cart, CartItem, Product } from '../types/catalog'

const storageKey = 'shopx-cart-v1'

interface CartContextValue extends Cart {
  addItem: (product: Product) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as CartItem[] } catch { return [] }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(items)) }, [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    addItem: (product) => setItems((current) => {
      const found = current.find((item) => item.product.id === product.id)
      return found ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product, quantity: 1 }]
    }),
    updateQuantity: (productId, quantity) => setItems((current) => quantity < 1 ? current.filter((item) => item.product.id !== productId) : current.map((item) => item.product.id === productId ? { ...item, quantity } : item)),
    removeItem: (productId) => setItems((current) => current.filter((item) => item.product.id !== productId)),
    clearCart: () => setItems([]),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.quantity * item.product.price, 0),
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
