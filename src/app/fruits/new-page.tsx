'use client';

import { useState, useEffect } from 'react';
import { ProductListing } from '@/components/product-management';
import { Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { haptics, ImpactStyle } from '@/lib/haptics';
import { useFlyToCart } from '@/components/fly-to-cart-context';

// Cart item interface for the new structure
interface CartItem {
  product: Product;
  quantity: number;
  isCut: boolean;
  selectedVariant?: any;
}

export default function FruitsPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();
  const { addToCart: triggerFlyToCart } = useFlyToCart();

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const handleAddToCart = (product: Product, quantity: number, isCut: boolean, variant?: any) => {
    haptics.impact(ImpactStyle.Medium);
    
    setCartItems(prevCart => {
      const existingItem = prevCart.find(item => 
        item.product.id === product.id && 
        item.isCut === isCut &&
        item.selectedVariant?.id === variant?.id
      );

      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id && 
          item.isCut === isCut &&
          item.selectedVariant?.id === variant?.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prevCart, { product, quantity, isCut, selectedVariant: variant }];
      }
    });

    toast({
      title: 'Added to cart',
      description: `${product.name} added to cart`,
      duration: 2000,
    });
  };

  const handleUpdateQuantity = (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => {
    haptics.impact(ImpactStyle.Light);
    
    if (newQuantity <= 0) {
      setCartItems(prevCart => 
        prevCart.filter(item => 
          !(item.product.id === productId && 
            item.isCut === isCut && 
            item.selectedVariant?.id === variantId)
        )
      );
    } else {
      setCartItems(prevCart =>
        prevCart.map(item =>
          item.product.id === productId && 
          item.isCut === isCut &&
          item.selectedVariant?.id === variantId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    }
  };

  const handleProductSelect = (product: Product) => {
    // You can implement product detail modal or navigation here
    console.log('Selected product:', product);
  };

  return (
    <div className="min-h-screen bg-background">
      <ProductListing
        category="fruits"
        title="Fresh Fruits"
        description="Hand-picked, fresh fruits delivered to your doorstep"
        enableSearch={true}
        enableFilters={true}
        enableSorting={true}
        layout="grid"
        onProductSelect={handleProductSelect}
        cartItems={cartItems}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
      />
    </div>
  );
}