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
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: product.imageUrl,
          unit: product.unit || 'piece',
          isCut: false,
          variants: []
        }];
      }
    });
  };

  return {
    cart,
    addToCart
  };
}