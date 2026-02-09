import { useState } from 'react';
import { CartItem, Product } from '@/lib/types';

interface UseCartReturn {
  cart: CartItem[];
  addToCart: (product: Product) => Promise<void>;
}

export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = async (product: Product): Promise<void> => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          product,
          quantity: 1,
          isCut: false,
        }];
      }
    });
  };

  return {
    cart,
    addToCart
  };
}
