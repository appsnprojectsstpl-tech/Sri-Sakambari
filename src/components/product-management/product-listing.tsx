'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProducts } from '@/hooks/use-products';
import { Product } from '@/lib/types';
import ProductCard from '@/components/product-card';
import ProductCardSkeleton from '@/components/product-card-skeleton';
import { CategoryFilter } from '@/components/product-management/category-filter';
import { SearchBar } from '@/components/product-management/search-bar';
import { StockStatusFilter } from '@/components/product-management/stock-status-filter';
import { SortOptions } from '@/components/product-management/sort-options';
import { ProductGrid } from '@/components/product-management/product-grid';
import { EmptyState } from '@/components/product-management/empty-state';

interface ProductListingProps {
  category?: string;
  title: string;
  description?: string;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableSorting?: boolean;
  layout?: 'grid' | 'list';
  onProductSelect?: (product: Product) => void;
  cartItems?: Array<{ product: Product; quantity: number; isCut: boolean; selectedVariant?: any }>;
  onAddToCart?: (product: Product, quantity: number, isCut: boolean, variant?: any) => void;
  onUpdateQuantity?: (productId: string, isCut: boolean, quantity: number, variantId?: string) => void;
}

export default function ProductListing({
  category,
  title,
  description,
  enableSearch = true,
  enableFilters = true,
  enableSorting = true,
  layout = 'grid',
  onProductSelect,
  cartItems = [],
  onAddToCart,
  onUpdateQuantity
}: ProductListingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(layout);

  // Use the enhanced products hook
  const { products, loading, error, filters, setFilters, sort, setSort } = useProducts({
    filters: {
      category,
      isActive: true,
      searchTerm
    },
    sort: {
      field: sortBy,
      direction: sortDirection
    }
  });

  // Debug logging
  useEffect(() => {
    console.log('ProductListing debug:', {
      category,
      productsCount: products.length,
      loading,
      error,
      filters,
      sort
    });
  }, [products, loading, error, filters, sort, category]);

  // Group products by subcategory
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    
    products.forEach(product => {
      const subCategory = product.subCategory || 'Other';
      if (!groups[subCategory]) {
        groups[subCategory] = [];
      }
      groups[subCategory].push(product);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, products]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        products: products.sort((a, b) => a.displayOrder - b.displayOrder)
      }));
  }, [products]);

  // Get cart quantities for products
  const getCartQuantity = (productId: string, isCut: boolean = false) => {
    const item = cartItems.find(item => 
      item.product.id === productId && item.isCut === isCut
    );
    return item?.quantity || 0;
  };

  // Handle search
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setFilters({ ...filters, searchTerm: term });
  };

  // Handle stock status filter
  const handleStockStatusChange = (status: string) => {
    setSelectedStockStatus(status);
    if (status === 'all') {
      const { stockStatus, ...restFilters } = filters;
      setFilters(restFilters);
    } else {
      setFilters({ ...filters, stockStatus: status as any });
    }
  };

  // Handle sort change
  const handleSortChange = (newSortBy: 'name' | 'price' | 'stock', newDirection?: 'asc' | 'desc') => {
    const newSortDirection = newDirection || (sortBy === newSortBy && sortDirection === 'asc' ? 'desc' : 'asc');
    setSortBy(newSortBy);
    setSortDirection(newSortDirection);
    setSort({ field: newSortBy, direction: newSortDirection });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Products</h3>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {enableSearch && (
                <SearchBar 
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Search products..."
                  className="w-full sm:w-64"
                />
              )}
              
              {enableFilters && (
                <>
                  <StockStatusFilter 
                    value={selectedStockStatus}
                    onChange={handleStockStatusChange}
                  />
                  
                  <div className="flex items-center gap-1 border rounded-md">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-l-md transition-colors ${
                        viewMode === 'grid' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-r-md transition-colors ${
                        viewMode === 'list' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
              
              {enableSorting && (
                <SortOptions
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 container mx-auto px-4 py-6">
        {loading ? (
          <ProductGrid layout={viewMode}>
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </ProductGrid>
        ) : groupedProducts.length === 0 ? (
          <EmptyState 
            title="No products found"
            description="Try adjusting your search or filters"
          />
        ) : (
          <div className="space-y-8">
            {groupedProducts.map((group) => (
              <section key={group.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">{group.name}</h2>
                  <span className="text-sm text-muted-foreground">
                    {group.products.length} products
                  </span>
                </div>
                
                <ProductGrid layout={viewMode}>
                  {group.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={(product, quantity, isCut, variant) => {
                        if (onAddToCart) {
                          onAddToCart(product, quantity, isCut, variant);
                        }
                      }}
                      onUpdateQuantity={(productId, isCut, quantity, variantId) => {
                        if (onUpdateQuantity) {
                          onUpdateQuantity(productId, isCut, quantity, variantId);
                        }
                      }}
                      cartItems={cartItems}
                      onClick={() => {
                        if (onProductSelect) {
                          onProductSelect(product);
                        }
                      }}
                    />
                  ))}
                </ProductGrid>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ProductListing };