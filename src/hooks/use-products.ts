import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product } from '@/lib/types';
import { productService, ProductFilters, ProductSort } from '@/lib/product-service';
import { useCollection } from '@/firebase';
import type { Constraint } from '@/firebase/firestore/utils';

export interface UseProductsOptions {
  filters?: ProductFilters;
  sort?: ProductSort;
  realtime?: boolean;
  enabled?: boolean;
}

export interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  sort: ProductSort;
  setSort: (sort: ProductSort) => void;
}

/**
 * Enhanced product management hook with filtering, sorting, and caching
 */
export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const { filters: initialFilters = {}, sort: initialSort = { field: 'displayOrder', direction: 'asc' }, realtime = true, enabled = true } = options;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [sort, setSort] = useState<ProductSort>(initialSort);

  // Real-time data from Firestore
  const { data: firestoreProducts, loading: firestoreLoading } = useCollection<Product>(
    'products',
    {
      constraints: (() => {
        const c: Constraint[] = [];
        if (filters.category) c.push(['where', 'category', '==', filters.category]);
        if (filters.isActive !== undefined) c.push(['where', 'isActive', '==', filters.isActive]);
        return c;
      })(),
      disabled: !realtime || !enabled
    }
  );

  /**
   * Fetch products based on current filters and sort
   */
  const fetchProducts = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      console.log('useProducts: Starting fetch with filters:', filters, 'sort:', sort);

      let result: Product[];

      if (realtime && firestoreProducts) {
        console.log('useProducts: Using real-time data, count:', firestoreProducts.length);
        // Use real-time data and apply client-side filtering/sorting
        result = [...firestoreProducts];

        // Apply search filter
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          result = result.filter(product =>
            product.name.toLowerCase().includes(searchLower) ||
            product.name_te?.toLowerCase().includes(searchLower) ||
            product.category.toLowerCase().includes(searchLower)
          );
        }

        // Apply stock status filter
        if (filters.stockStatus) {
          result = result.filter(product => {
            if (!product.trackInventory) return filters.stockStatus === 'NOT_TRACKED';
            if (product.stockQuantity === 0) return filters.stockStatus === 'OUT_OF_STOCK';
            if (product.stockQuantity <= 5) return filters.stockStatus === 'LOW_STOCK';
            return filters.stockStatus === 'IN_STOCK';
          });
        }

        // Apply sorting
        result.sort((a, b) => {
          let aValue = (a as any)[sort.field];
          let bValue = (b as any)[sort.field];

          if (aValue === undefined) aValue = '';
          if (bValue === undefined) bValue = '';

          if (sort.direction === 'asc') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        console.log('useProducts: After filtering/sorting, result count:', result.length);
      } else {
        // Use service-based fetching
        result = await productService.getProducts(filters, sort);
      }

      setProducts(result);
      console.log('useProducts: Successfully fetched', result.length, 'products');
    } catch (err) {
      console.error('useProducts: Error fetching products:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch products'));
    } finally {
      setLoading(false);
    }
  }, [filters, sort, realtime, firestoreProducts, enabled]);

  /**
   * Refetch products
   */
  const refetch = useCallback(async () => {
    await fetchProducts();
  }, [fetchProducts]);

  // Fetch products when dependencies change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Update loading state based on Firestore loading
  useEffect(() => {
    if (realtime) {
      setLoading(firestoreLoading);
    }
  }, [firestoreLoading, realtime]);

  return {
    products,
    loading,
    error,
    refetch,
    filters,
    setFilters,
    sort,
    setSort
  };
}

/**
 * Hook for managing a single product
 */
export function useProduct(productId: string | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await productService.getProductById(productId);
      setProduct(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch product'));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const updateProduct = useCallback(async (updates: Partial<Product>) => {
    if (!productId) return;

    await productService.updateProduct(productId, updates);
    await fetchProduct();
  }, [productId, fetchProduct]);

  return {
    product,
    loading,
    error,
    refetch: fetchProduct,
    updateProduct
  };
}

/**
 * Hook for product stock management
 */
export function useProductStock(options: { threshold?: number } = {}) {
  const { threshold = 5 } = options;
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStockStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [lowStock, outOfStock] = await Promise.all([
        productService.getLowStockProducts(threshold),
        productService.getOutOfStockProducts()
      ]);

      setLowStockProducts(lowStock);
      setOutOfStockProducts(outOfStock);
    } catch (error) {
      console.error('Failed to fetch stock status:', error);
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    fetchStockStatus();
  }, [fetchStockStatus]);

  return {
    lowStockProducts,
    outOfStockProducts,
    loading,
    refetch: fetchStockStatus
  };
}