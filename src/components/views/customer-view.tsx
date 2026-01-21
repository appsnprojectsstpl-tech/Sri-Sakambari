'use client';

import { useState, useMemo, useCallback } from 'react';
import { Filter, Search, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import NotificationManager from '@/components/notification-manager';
import InstallPrompt from '@/components/install-prompt';
import { useStoreStatus } from '@/hooks/use-store-status';
import { useLanguage } from '@/context/language-context';
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card";
import { cn } from "@/lib/utils";
import type { Product, CartItem } from "@/lib/types";
import { useCollection } from '@/firebase';
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { id: 'All', label: 'All', icon: '🧺', color: 'bg-gray-100 text-gray-700' },
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
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-full">
            <div className="relative w-full aspect-[4/3] bg-gray-50 p-4">
              <Skeleton className="w-full h-full rounded-md" />
            </div>
            <div className="flex flex-col p-3 gap-2 flex-grow">
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-1/4 rounded-full" />
              <div className="mt-auto flex items-end justify-between pt-2">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
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
  const { isOpen: isStoreOpen, loading: storeStatusLoading } = useStoreStatus(); // NEW
  const [activeCategory, setActiveCategory] = useState('All'); // Default to All
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setFilterOpen] = useState(false);
  const { toast } = useToast();

  // Wrap addToCart to respect store status - memoized to prevent re-renders
  const handleAddToCart = useCallback((product: Product, quantity: number, isCut: boolean) => {
    if (!isStoreOpen && !storeStatusLoading) {
      toast({
        variant: "destructive",
        title: "Store Closed",
        description: "Sorry! Store is currently closed for orders."
      });
      return;
    }
    addToCart(product, quantity, isCut);
  }, [isStoreOpen, storeStatusLoading, addToCart]);

  // Wrap updateCart to respect store status - memoized to prevent re-renders
  const handleUpdateCart = useCallback((productId: string, isCut: boolean, newQuantity: number) => {
    if (!isStoreOpen && !storeStatusLoading) {
      toast({
        variant: "destructive",
        title: "Store Closed",
        description: "Sorry! Store is currently closed for orders."
      });
      return;
    }
    updateCartQuantity(productId, isCut, newQuantity);
  }, [isStoreOpen, storeStatusLoading, updateCartQuantity]);

  const { data: allProducts, loading } = useCollection<Product>('products', {
    constraints: [['where', 'isActive', '==', true]]
  });

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let items = allProducts;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((p: Product) =>
        p.name.toLowerCase().includes(q) ||
        (p.name_te && p.name_te.toLowerCase().includes(q))
      );
    } else {
      if (activeCategory && activeCategory !== 'All') {
        items = items.filter((p: Product) => p.category === activeCategory);
      }
    }

    items.sort((a: Product, b: Product) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return items;
  }, [allProducts, activeCategory, searchQuery]);

  const seasonalPicks = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.slice(0, 4);
  }, [allProducts]);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-28">
      {!isStoreOpen && !storeStatusLoading && (
        <div className="bg-destructive text-destructive-foreground p-3 text-center sticky top-0 z-50 font-bold shadow-md animate-in slide-in-from-top">
          <AlertTriangle className="inline-block w-5 h-5 mr-2 mb-1 text-white" />
          Store is closed. Orders are paused.
        </div>
      )}
      <InstallPrompt />
      <NotificationManager />

      {/* Sticky Header Group: Search + Categories */}
      <div className={`sticky ${!isStoreOpen ? 'top-12' : 'top-0'} z-30 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 transition-all pb-1`}>
        <div className="container mx-auto px-4 py-2 space-y-2">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search for vegetables..."
                className="pl-10 bg-gray-100/50 border-gray-200 rounded-2xl h-11 focus-visible:ring-primary focus-visible:border-primary/50 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              )}
            </div>

            {/* Filter Sidebar Trigger */}
            <Sheet open={isFilterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-3 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all border border-gray-200"
                  aria-label="Filter"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <SheetHeader>
                  <SheetTitle>Categories</SheetTitle>
                </SheetHeader>
                <div className="py-6 flex flex-col gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setFilterOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                        activeCategory === cat.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"
                      )}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Sticky Horizontal Categories */}
          {!searchQuery && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 pt-1 sm:mx-0 sm:px-0">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-full font-bold text-xs transition-all border flex items-center gap-1.5 whitespace-nowrap shrink-0",
                    activeCategory === cat.id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-8">

        {/* Seasonal Picks (Sticky Category already filters this view conceptually, but user might want 'Deals' here. Keeping it simple) */}
        {!searchQuery && activeCategory === 'Vegetables' && (
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-900">Seasonal Picks</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="min-w-[80vw] sm:min-w-[200px] aspect-video sm:h-[180px] rounded-2xl flex-shrink-0 snap-center" />
                ))
              ) : (
                seasonalPicks.map((product: Product) => (
                  <div key={product.id} className="min-w-[80vw] sm:min-w-[200px] snap-center flex-shrink-0">
                    <ProductCard
                      product={product}
                      onAddToCart={handleAddToCart}
                      onUpdateQuantity={handleUpdateCart}
                      cartQuantity={cart.find(i => i.product.id === product.id)?.quantity || 0}
                      cutCartQuantity={0}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Main Product Grid */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900">
              {searchQuery ? 'Search Results' : activeCategory}
            </h2>
            <span className="text-xs text-gray-500 font-bold">{filteredProducts.length} items</span>
          </div>

          <ProductGrid
            products={filteredProducts}
            loading={loading}
            cart={cart}
            addToCart={handleAddToCart}
            updateCartQuantity={handleUpdateCart}
          />
        </section>

      </div>
    </div>
  );
}
