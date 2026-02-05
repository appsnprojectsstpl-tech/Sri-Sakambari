'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Filter, Search, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import NotificationManager from '@/components/notification-manager';
import InstallPrompt from '@/components/install-prompt';
import { useStoreStatus } from '@/hooks/use-store-status';
import { useLanguage } from '@/context/language-context';
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/product-card";
import { useToast } from "@/hooks/use-toast";
import CustomerHeader from "@/components/customer/customer-header";
import ProductGrid from "@/components/customer/product-grid";
import SeasonalCarousel from "@/components/customer/seasonal-carousel";
import { useCollection } from '@/firebase';



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
  const handleAddToCart = useCallback((product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => {
    if (!isStoreOpen && !storeStatusLoading) {
      toast({
        variant: "destructive",
        title: "Store Closed",
        description: "Sorry! Store is currently closed for orders."
      });
      return;
    }
    addToCart(product, quantity, isCut, variant);
  }, [isStoreOpen, storeStatusLoading, addToCart]);

  // Wrap updateCart to respect store status - memoized to prevent re-renders
  const handleUpdateCart = useCallback((productId: string, isCut: boolean, newQuantity: number, variantId?: string) => {
    if (!isStoreOpen && !storeStatusLoading) {
      toast({
        variant: "destructive",
        title: "Store Closed",
        description: "Sorry! Store is currently closed for orders."
      });
      return;
    }
    updateCartQuantity(productId, isCut, newQuantity, variantId);
  }, [isStoreOpen, storeStatusLoading, updateCartQuantity]);

  const { data: allProducts, loading } = useCollection<Product>('products', {
    constraints: [['where', 'isActive', '==', true]]
  });

  const [sortOption, setSortOption] = useState('recommended');

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

    // Sorting Logic
    items = [...items].sort((a: Product, b: Product) => {
      switch (sortOption) {
        case 'price-low':
          return a.pricePerUnit - b.pricePerUnit;
        case 'price-high':
          return b.pricePerUnit - a.pricePerUnit;
        case 'name':
          return a.name.localeCompare(b.name);
        default: // recommended
          return (a.displayOrder || 0) - (b.displayOrder || 0);
      }
    });

    return items;
  }, [allProducts, activeCategory, searchQuery, sortOption]);

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
      <CustomerHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        sortOption={sortOption}
        setSortOption={setSortOption}
        isStoreOpen={isStoreOpen}
      />

      <div className="container mx-auto px-4 py-6 space-y-8">

        {/* Seasonal Picks (Sticky Category already filters this view conceptually, but user might want 'Deals' here. Keeping it simple) */}
        {/* Seasonal Picks */}
        {!searchQuery && activeCategory === 'Vegetables' && (
          <SeasonalCarousel
            products={seasonalPicks}
            loading={loading}
            cart={cart}
            addToCart={handleAddToCart}
            updateCartQuantity={handleUpdateCart}
          />
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
