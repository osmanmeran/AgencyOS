import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// A single quote cart shared across the client portal. Persisted to
// localStorage so a client can browse category -> supplier -> services,
// add items from several suppliers, and still find them in the cart when
// they land on the checkout panel from a different page.

const CART_KEY = 'b2b_quote_cart';
const CartContext = createContext(/** @type {any} */ (null));

export const UNIT_LABELS = {
  per_person: 'Per Person',
  per_group: 'Per Group',
  per_night: 'Per Night',
  per_trip: 'Per Trip',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  flat_rate: 'Flat Rate',
};

export function lineTotal(item) {
  if (item.unit === 'per_group' || item.unit === 'flat_rate') return item.unit_price;
  return item.unit_price * item.quantity;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // ignore quota / private-mode failures
    }
  }, [items]);

  const addItem = useCallback((item) => {
    setItems(prev => prev.some(i => i.pricing_id === item.pricing_id)
      ? prev
      : [...prev, { ...item, quantity: item.min_quantity || 1 }]);
  }, []);

  const removeItem = useCallback((pricingId) => {
    setItems(prev => prev.filter(i => i.pricing_id !== pricingId));
  }, []);

  const updateQuantity = useCallback((pricingId, quantity) => {
    setItems(prev => prev.map(i => i.pricing_id === pricingId ? { ...i, quantity } : i));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = { items, addItem, removeItem, updateQuantity, clear, count: items.length };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
