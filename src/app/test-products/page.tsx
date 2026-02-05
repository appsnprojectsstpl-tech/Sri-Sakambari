'use client';

import { ProductListing } from '@/components/product-management';
import { useState, useEffect } from 'react';
import { Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  product: Product;
  quantity: number;
  isCut: boolean;
  selectedVariant?: any;
}

export default function TestProductManagement() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  // Load cart from localStorage on mount
  useEffect(() => {
    console.log('TestProductManagement: Component mounted');
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
    console.log('Selected product:', product);
    console.log('Product name:', product?.name);
    console.log('Product category:', product?.category);
    toast({
      title: 'Product Selected',
      description: `You selected ${product.name}`,
      duration: 2000,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Test Product Management</h1>
          <p className="text-muted-foreground">
            Testing the new restructured product management system
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Fruits Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Fruits</h2>
            <div className="border rounded-lg p-4">
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
          </div>

          {/* Vegetables Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Vegetables</h2>
            <div className="border rounded-lg p-4">
              <ProductListing
                category="vegetables"
                title="Fresh Vegetables"
                description="Farm-fresh vegetables, delivered daily"
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
          </div>
        </div>

        {/* Cart Summary */}
        <div className="mt-8 p-4 bg-card rounded-lg border">
          <h3 className="text-lg font-semibold text-foreground mb-2">Cart Summary</h3>
          <p className="text-muted-foreground">
            Total items: {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          </p>
          <p className="text-muted-foreground">
            Total products: {cartItems.length}
          </p>
        </div>
      </div>
    </div>
  );
}