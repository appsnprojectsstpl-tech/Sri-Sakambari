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
import MobileProductCard from "@/components/mobile-product-card";
import { cn } from "@/lib/utils";
import type { Product, CartItem, ProductVariant } from "@/lib/types";
import { useCollection } from '@/firebase';
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { id: 'All', label: 'All', icon: '🧺', color: 'bg-gray-100 text-gray-700' },
  { id: 'Vegetables', label: 'Vegetables', icon: '🥦', color: 'bg-green-100 text-green-700' },
  { id: 'Fruits', label: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-700' },
  { id: 'Dairy', label: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-700' },
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
}: {
  products: Product[] | null;
  loading: boolean;
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
  updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
}) => {
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    setVisibleCount(8);
  }, [products]);

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

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleProducts.length < products.length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 pb-6">
        {visibleProducts.map((product) => {
          const productCartItems = cart.filter((item) => item.product.id === product.id);
          const legacyCartItem = productCartItems.find(i => !i.isCut);

          return (
            <div key={product.id} className="flex flex-col" role="article">
              <MobileProductCard
                product={product}
                onAddToCart={addToCart}
                onUpdateQuantity={updateCartQuantity}
                cartItems={productCartItems}
                cartQuantity={legacyCartItem?.quantity || 0}
              />
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount(prev => prev + 8)}
            className="min-w-[120px] rounded-full shadow-sm text-sm"
          >
            Load More
          </Button>
        </div>
      )}
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
    <div className="min-h-screen bg-gray-50/50 pb-20" data-testid="mobile-customer-view">
      {!isStoreOpen && !storeStatusLoading && (
        <div className="bg-destructive text-destructive-foreground p-2 text-center sticky top-0 z-50 font-bold text-sm shadow-md animate-in slide-in-from-top">
          <AlertTriangle className="inline-block w-4 h-4 mr-1 text-white" />
          Store is closed. Orders are paused.
        </div>
      )}
      <InstallPrompt />
      <NotificationManager />

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

        {/* Seasonal Picks */}
        {!searchQuery && activeCategory === 'Vegetables' && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-base font-bold text-gray-900">Seasonal Picks</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x snap-mandatory -mx-3 px-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="min-w-[75vw] h-32 rounded-xl flex-shrink-0 snap-center" />
                ))
              ) : (
                seasonalPicks.map((product: Product) => (
                  <div key={product.id} className="min-w-[75vw] snap-center flex-shrink-0">
                    <MobileProductCard
                      product={product}
                      onAddToCart={handleAddToCart}
                      onUpdateQuantity={handleUpdateCart}
                      cartItems={cart.filter(i => i.product.id === product.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        )}

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
          />
        </section>

      </div>
    </div>
  );
}