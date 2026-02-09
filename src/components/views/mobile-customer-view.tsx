'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/context/language-context';
import { t } from '@/lib/translations';
import { useCollection } from '@/firebase';
import type { Product, CartItem, ProductVariant } from '@/lib/types';
import MobileProductCard from '@/components/mobile-product-card';
import ProductDetailsSheet from '@/components/product-details-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, X, SlidersHorizontal, AlertTriangle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { useStoreStatus } from '@/hooks/use-store-status';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import InstallPrompt from '@/components/install-prompt';
import NotificationManager from '@/components/notification-manager';

// Hardcoded categories - IDs match database values
const CATEGORIES = [
  { id: 'All', label: 'All', icon: '🧺', color: 'bg-gray-100 text-gray-700' },
  { id: 'Vegetables', label: 'Vegetables', icon: '🥦', color: 'bg-green-100 text-green-700' },
  { id: 'Leafy Veg', label: 'Leafy Veg', icon: '🥬', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'Fruits', label: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-700' },
  { id: 'Dairy', label: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-700' },
  { id: 'Cool Drinks', label: 'Cool Drinks', icon: '🥤', color: 'bg-orange-100 text-orange-700' },
  { id: 'Water', label: 'Water', icon: '💧', color: 'bg-cyan-100 text-cyan-700' },
];

interface MobileCustomerViewProps {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
  updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
}

const MobileProductGrid = ({
  products,
  loading,
  cart,
  addToCart,
  updateCartQuantity,
  onProductClick,
}: {
  products: Product[] | null;
  loading: boolean;
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
  updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
  onProductClick: (product: Product) => void;
}) => {
  const handleAddToCart = addToCart;
  const handleUpdateCart = updateCartQuantity;




  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4 pb-6" data-testid="mobile-product-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm h-full">
            <div className="relative w-full aspect-square bg-gray-50 p-2">
              <Skeleton className="w-full h-full rounded-md" />
            </div>
            <div className="flex flex-col p-2 gap-1 flex-grow">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-2 w-1/2 rounded-full" />
              <div className="mt-auto flex items-end justify-between pt-1">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-10 rounded-md" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-gray-500 text-sm">No products found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 pb-6">
        {products.map((product) => {
          const productCartItems = cart.filter((item) => item.product.id === product.id);
          const legacyCartItem = productCartItems.find(i => !i.isCut);

          return (
            <div key={product.id} className="flex flex-col" role="article">
              <MobileProductCard
                product={product}
                onAddToCart={handleAddToCart}
                onUpdateQuantity={handleUpdateCart}
                cartItems={productCartItems}
                cartQuantity={legacyCartItem?.quantity || 0}
                onClick={() => onProductClick(product)}
              />
            </div>
          );
        })}
      </div>


    </>
  );
};

export default function MobileCustomerView({
  cart,
  addToCart,
  updateCartQuantity,
}: MobileCustomerViewProps) {
  const { language } = useLanguage();
  const { isOpen: isStoreOpen, loading: storeStatusLoading } = useStoreStatus();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const { toast } = useToast();

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

  const { data: allProducts, loading, error } = useCollection<Product>('products', {
    constraints: []
  });

  // Debug logging
  useEffect(() => {
    console.log('MobileCustomerView: Products loading:', loading);
    console.log('MobileCustomerView: Products data:', allProducts);
    console.log('MobileCustomerView: Products error:', error);
    console.log('MobileCustomerView: Products count:', allProducts?.length || 0);

    // Category-specific debugging
    if (allProducts && allProducts.length > 0) {
      const categories = [...new Set(allProducts.map(p => p.category))];
      console.log('MobileCustomerView: Available categories:', categories);

      const leafyVegProducts = allProducts.filter(p => p.category === 'Leafy Veg');
      const drinkingWaterProducts = allProducts.filter(p => p.category === 'Water');

      console.log('MobileCustomerView: Leafy Veg products:', leafyVegProducts.length);
      console.log('MobileCustomerView: Water products:', drinkingWaterProducts.length);

      if (leafyVegProducts.length > 0) {
        console.log('MobileCustomerView: Leafy Veg sample:', leafyVegProducts.slice(0, 2).map(p => ({ name: p.name, isActive: p.isActive })));
      }
      if (drinkingWaterProducts.length > 0) {
        console.log('MobileCustomerView: Water sample:', drinkingWaterProducts.slice(0, 2).map(p => ({ name: p.name, isActive: p.isActive })));
      }
    }

    console.log('MobileCustomerView: Active category:', activeCategory);
  }, [allProducts, loading, error, activeCategory]);

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let items = allProducts;

    console.log('MobileCustomerView: Filtering started with', items.length, 'products');
    console.log('MobileCustomerView: Active category for filtering:', activeCategory);
    console.log('MobileCustomerView: Search query:', searchQuery);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((p: Product) =>
        p.name.toLowerCase().includes(q) ||
        (p.name_te && p.name_te.toLowerCase().includes(q))
      );
      console.log('MobileCustomerView: After search filter:', items.length, 'products');
    } else {
      if (activeCategory && activeCategory !== 'All') {
        console.log('MobileCustomerView: Applying category filter for:', activeCategory);
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
            console.log('MobileCustomerView: Product matched category filter:', p.name, 'category:', p.category, 'subCategory:', p.subCategory);
          }
          return matches;
        });
        console.log('MobileCustomerView: After category filter:', items.length, 'products (was', beforeFilter, ')');

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
          console.log('MobileCustomerView: Sample non-matching products:', nonMatchingProducts.slice(0, 3).map(p => ({ name: p.name, category: p.category, subCategory: p.subCategory, isActive: p.isActive })));
        }
      }
    }

    items.sort((a: Product, b: Product) => (a.displayOrder || 0) - (b.displayOrder || 0));

    console.log('MobileCustomerView: Final filtered products count:', items.length);
    return items;
  }, [allProducts, activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20" data-testid="mobile-customer-view">
      {!isStoreOpen && !storeStatusLoading && (
        <div className="bg-destructive text-destructive-foreground p-2 text-center sticky top-0 z-50 font-bold text-sm shadow-md animate-in slide-in-from-top">
          <AlertTriangle className="inline-block w-4 h-4 mr-1 text-white" />
          Store is closed. Orders are paused.
        </div>
      )}
      <InstallPrompt />
      <NotificationManager />

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded m-3">
          <strong>Error loading products:</strong> {error.message || error}
        </div>
      )}

      {/* Sticky Header Group: Search + Categories */}
      <div className={`sticky ${!isStoreOpen ? 'top-10' : 'top-0'} z-30 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 transition-all pb-1`}>
        <div className="px-3 py-2 space-y-2">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search products..."
                className="pl-8 bg-gray-100/50 border-gray-200 rounded-xl h-10 focus-visible:ring-primary focus-visible:border-primary/50 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              )}
            </div>

            {/* Filter Sidebar Trigger */}
            <Sheet open={isFilterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-2.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all border border-gray-200"
                  aria-label="Filter"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Categories</SheetTitle>
                </SheetHeader>
                <div className="py-4 flex flex-col gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setFilterOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg transition-all text-left text-sm",
                        activeCategory === cat.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"
                      )}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Sticky Horizontal Categories */}
          {!searchQuery && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 pb-1.5 pt-0.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full font-bold text-xs transition-all border flex items-center gap-1 shrink-0",
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

      <div className="px-3 py-4 space-y-6">

        {/* Main Product Grid */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-base font-bold text-gray-900">
              {searchQuery ? 'Search Results' : activeCategory}
            </h2>
            <span className="text-xs text-gray-500 font-bold">{filteredProducts.length} items</span>
          </div>

          <MobileProductGrid
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
    </div>
  );
}