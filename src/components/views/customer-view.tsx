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
import ProductDetailsSheet from '@/components/product-details-sheet';
import { useCollection } from '@/firebase';
import type { Product, ProductVariant, CartItem } from '@/lib/types';

interface CustomerViewProps {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
  updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
}

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
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

  // Handle product click - memoized to prevent re-renders
  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsProductDetailOpen(true);
  }, []);

  const { data: allProducts, loading, error } = useCollection<Product>('products', {
    constraints: []
  });

  // Debug logging
  useEffect(() => {
    console.log('CustomerView: Products loading:', loading);
    console.log('CustomerView: Products data:', allProducts);
    console.log('CustomerView: Products error:', error);
    console.log('CustomerView: Products count:', allProducts?.length || 0);

    // Category-specific debugging
    if (allProducts && allProducts.length > 0) {
      const categories = [...new Set(allProducts.map(p => p.category))];
      console.log('CustomerView: Available categories:', categories);

      const leafyVegProducts = allProducts.filter(p => p.category === 'Leafy Veg');
      const drinkingWaterProducts = allProducts.filter(p => p.category === 'Water');

      console.log('CustomerView: Leafy Veg products:', leafyVegProducts.length);
      console.log('CustomerView: Water products:', drinkingWaterProducts.length);

      if (leafyVegProducts.length > 0) {
        console.log('CustomerView: Leafy Veg sample:', leafyVegProducts.slice(0, 2).map(p => ({ name: p.name, isActive: p.isActive })));
      }
      if (drinkingWaterProducts.length > 0) {
        console.log('CustomerView: Water sample:', drinkingWaterProducts.slice(0, 2).map(p => ({ name: p.name, isActive: p.isActive })));
      }
    }

    console.log('CustomerView: Active category:', activeCategory);
  }, [allProducts, loading, error, activeCategory]);

  const [sortOption, setSortOption] = useState('recommended');

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let items = allProducts;

    console.log('CustomerView: Filtering started with', items.length, 'products');
    console.log('CustomerView: Active category for filtering:', activeCategory);
    console.log('CustomerView: Search query:', searchQuery);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((p: Product) =>
        p.name.toLowerCase().includes(q) ||
        (p.name_te && p.name_te.toLowerCase().includes(q))
      );
      console.log('CustomerView: After search filter:', items.length, 'products');
    } else if (activeCategory && activeCategory !== 'All') {
      console.log('CustomerView: Applying category filter for:', activeCategory);
      const beforeFilter = items.length;
      items = items.filter((p: Product) => {
        // Handle both main category and subcategory matching
        let matches = false;

        if (activeCategory === 'Leafy Veg') {
          // For Leafy Veg, check both category and subcategory
          matches = p.category === 'Leafy Veg' || (p.category === 'Vegetables' && p.subCategory === 'Leafy Veg');
        } else if (activeCategory === 'Water') {
          // For Water, check main category
          matches = p.category === 'Water';
        } else {
          // For other categories, check main category
          matches = p.category === activeCategory;
        }

        if (matches) {
          console.log('CustomerView: Product matched category filter:', p.name, 'category:', p.category, 'subCategory:', p.subCategory);
        }
        return matches;
      });
      console.log('CustomerView: After category filter:', items.length, 'products (was', beforeFilter, ')');

      // Show products that didn't match for debugging
      const nonMatchingProducts = allProducts.filter((p: Product) => {
        if (activeCategory === 'Leafy Veg') {
          return !(p.category === 'Leafy Veg' || (p.category === 'Vegetables' && p.subCategory === 'Leafy Veg'));
        } else if (activeCategory === 'Water') {
          return p.category !== 'Water';
        } else {
          return p.category !== activeCategory;
        }
      });
      if (nonMatchingProducts.length > 0 && items.length === 0) {
        console.log('CustomerView: Sample non-matching products:', nonMatchingProducts.slice(0, 3).map(p => ({ name: p.name, category: p.category, subCategory: p.subCategory, isActive: p.isActive })));
      }
    }

    // Sorting Logic
    console.log('CustomerView: Final filtered products count before sorting:', items.length);
    return [...items].sort((a: Product, b: Product) => {
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
  }, [allProducts, activeCategory, searchQuery, sortOption]);

  return (
    <>
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

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error loading products:</strong> {error.message || error}
            </div>
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
              onProductClick={(product) => {
                setSelectedProduct(product);
                setIsProductDetailOpen(true);
              }}
            />
          </section>

        </div>
      </div>
      {/* Product Details Sheet */}
      {selectedProduct && (
        <ProductDetailsSheet
          isOpen={isProductDetailOpen}
          onClose={() => {
            setIsProductDetailOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          cartItems={cart}
          onAddToCart={handleAddToCart}
          onUpdateQuantity={handleUpdateCart}
        />
      )}
    </>
  );
}
