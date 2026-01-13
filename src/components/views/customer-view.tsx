'use client';

import { useMemo, useState } from 'react';
import type { Product, CartItem } from '@/lib/types';
import ProductCard from '@/components/product-card';
import { Skeleton } from '../ui/skeleton';
import { useLanguage } from '@/context/language-context';
import { t } from '@/lib/translations';
import { useCollection } from '@/firebase';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const CATEGORIES = [
  { id: 'Vegetables', label: 'Vegetables', icon: '🥦', color: 'bg-green-100 text-green-700' },
  { id: 'Fruits', label: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-700' },
  { id: 'Dairy', label: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-700' },
];

interface CustomerViewProps {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, isCut: boolean) => void;
  updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number) => void;
}

const ProductGrid = ({
  products,
  loading,
  cart,
  addToCart,
  updateCartQuantity,
}: {
  products: Product[] | null;
  loading: boolean;
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, isCut: boolean) => void;
  updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number) => void;
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col space-y-3">
            <Skeleton className="h-[120px] w-full rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-10 opacity-60">
        <p>No products found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 pb-24">
      {products.map((product) => {
        const cartItem = cart.find(
          (item) => item.product.id === product.id && !item.isCut
        );
        const cutCartItem = cart.find(
          (item) => item.product.id === product.id && item.isCut
        );
        return (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={addToCart}
            onUpdateQuantity={updateCartQuantity}
            cartQuantity={cartItem?.quantity || 0}
            cutCartQuantity={cutCartItem?.quantity || 0}
          />
        );
      })}
    </div>
  );
};

export default function CustomerView({
  cart,
  addToCart,
  updateCartQuantity,
}: CustomerViewProps) {
  const { language } = useLanguage();
  const [activeCategory, setActiveCategory] = useState('Vegetables');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all products (unoptimized but okay for <100 products)
  // In a real app we would query based on activeCategory
  const { data: allProducts, loading } = useCollection<Product>('products', {
    constraints: [['where', 'isActive', '==', true]]
  });

  // Filter Logic
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let items = allProducts;

    // Search Filter (Global)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.name_te && p.name_te.toLowerCase().includes(q))
      );
    } else {
      // Category Filter (Only if no search)
      if (activeCategory) {
        items = items.filter(p => p.category === activeCategory);
      }
    }

    // Sort by Display Order
    items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return items;
  }, [allProducts, activeCategory, searchQuery]);

  // Seasonal Picks (Just taking random 4 items for now, or use a flag if avail)
  const seasonalPicks = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.slice(0, 4);
  }, [allProducts]);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">

      {/* Header / Search */}
      <div className="bg-white sticky top-0 z-10 px-4 py-3 shadow-sm border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search for kale, carrots..."
            className="pl-9 bg-gray-50 border-gray-100 rounded-full h-11 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-8">

        {/* Seasonal Picks Section (Only show if on 'All' or just always show at top?) 
            User image shows "Seasonal Picks" then "Categories".
            Let's keep it clean.
        */}
        {/* Seasonal Picks Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900">Seasonal Picks</h2>
            <button className="text-xs font-bold text-primary hidden sm:block">See all</button>
          </div>
          {/* Native Mobile Carousel - CSS Snap */}
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="min-w-[80vw] sm:min-w-[200px] aspect-video sm:h-[180px] rounded-2xl flex-shrink-0 snap-center" />
              ))
            ) : (
              seasonalPicks.map(product => (
                <div key={product.id} className="min-w-[80vw] sm:min-w-[200px] snap-center flex-shrink-0">
                  {/* Quick Mini Card */}
                  <ProductCard
                    product={product}
                    onAddToCart={addToCart}
                    onUpdateQuantity={updateCartQuantity}
                    cartQuantity={cart.find(i => i.product.id === product.id)?.quantity || 0}
                    cutCartQuantity={0}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-5 py-2 rounded-full font-bold text-sm transition-all border",
                  activeCategory === cat.id
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* Main Product Grid */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900">
              {activeCategory}
            </h2>
            <span className="text-xs text-gray-500 font-bold">{filteredProducts.length} items</span>
          </div>

          <ProductGrid
            products={filteredProducts}
            loading={loading}
            cart={cart}
            addToCart={addToCart}
            updateCartQuantity={updateCartQuantity}
          />
        </section>

      </div>
    </div>
  );
}
