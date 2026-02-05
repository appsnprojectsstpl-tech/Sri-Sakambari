/**
 * Performance optimization utilities for Sakambari
 * Provides lazy loading, image optimization, caching, and bundle optimization
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';

/**
 * Image optimization utilities
 */
export const imageOptimization = {
  /**
   * Generate optimized image URLs with size and quality parameters
   */
  getOptimizedImageUrl: (url: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
    crop?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  } = {}): string => {
    if (!url) return '';

    // If it's already an optimized URL (e.g., from Cloudinary), return as is
    if (url.includes('cloudinary') || url.includes('imgix')) {
      return url;
    }

    // For Firebase Storage URLs, we can add optimization parameters
    if (url.includes('firebasestorage')) {
      const params = new URLSearchParams();
      if (options.width) params.set('w', options.width.toString());
      if (options.height) params.set('h', options.height.toString());
      if (options.quality) params.set('q', options.quality.toString());
      if (options.format) params.set('f', options.format);
      if (options.crop) params.set('c', options.crop);

      return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
    }

    return url;
  },

  /**
   * Preload critical images
   */
  preloadImage: (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  },

  /**
   * Preload multiple images in parallel with concurrency control
   */
  preloadImages: async (urls: string[], concurrency = 5): Promise<void> => {
    const chunks = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(url => imageOptimization.preloadImage(url)));
    }
  },

  /**
   * Generate responsive image srcset
   */
  getSrcSet: (url: string, sizes: number[]): string => {
    return sizes.map(size => `${imageOptimization.getOptimizedImageUrl(url, { width: size })} ${size}w`).join(', ');
  },

  /**
   * Calculate optimal image size based on container and device
   */
  getOptimalImageSize: (containerWidth: number, devicePixelRatio = 1): number => {
    const sizes = [320, 480, 640, 768, 1024, 1280, 1440, 1920];
    const targetSize = containerWidth * devicePixelRatio;
    
    return sizes.find(size => size >= targetSize) || sizes[sizes.length - 1];
  }
};

/**
 * Lazy loading utilities
 */
export const lazyLoading = {
  /**
   * Custom hook for intersection observer-based lazy loading
   */
  useIntersectionObserver: (options: IntersectionObserverInit = {}) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
      if (!ref.current) return;

      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      }, options);

      observer.observe(ref.current);

      return () => observer.disconnect();
    }, [options]);

    return { ref, isIntersecting };
  },

  /**
   * Dynamic import with loading state
   */
  useDynamicImport: <T>(importFn: () => Promise<{ default: T }>) => {
    const [component, setComponent] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      let mounted = true;

      importFn()
        .then(module => {
          if (mounted) {
            setComponent(module.default);
            setLoading(false);
          }
        })
        .catch(err => {
          if (mounted) {
            setError(err);
            setLoading(false);
          }
        });

      return () => { mounted = false; };
    }, [importFn]);

    return { component, loading, error };
  },

  /**
   * Progressive image loading with blur effect
   */
  useProgressiveImage: (src: string, placeholder: string) => {
    const [currentSrc, setCurrentSrc] = useState(placeholder);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      setLoading(true);
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setLoading(false);
      };
      img.onerror = () => {
        setLoading(false);
      };

      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }, [src]);

    return { src: currentSrc, loading };
  }
};

/**
 * Caching utilities
 */
export const caching = {
  /**
   * Simple in-memory cache with TTL
   */
  createMemoryCache: <K, V>() => {
    const cache = new Map<K, { value: V; expiry: number }>();

    return {
      get: (key: K): V | undefined => {
        const item = cache.get(key);
        if (!item) return undefined;

        if (Date.now() > item.expiry) {
          cache.delete(key);
          return undefined;
        }

        return item.value;
      },

      set: (key: K, value: V, ttlMs: number) => {
        cache.set(key, { value, expiry: Date.now() + ttlMs });
      },

      clear: () => cache.clear(),

      delete: (key: K) => cache.delete(key),

      size: () => cache.size
    };
  },

  /**
   * Custom hook for caching expensive computations
   */
  useMemoWithTTL: <T>(compute: () => T, deps: any[], ttlMs = 60000): T => {
    const cacheRef = useRef<{ value: T; timestamp: number } | null>(null);
    const depsRef = useRef(deps);

    return useMemo(() => {
      const now = Date.now();
      const depsChanged = deps.some((dep, i) => dep !== depsRef.current[i]);

      if (depsChanged || !cacheRef.current || now - cacheRef.current.timestamp > ttlMs) {
        cacheRef.current = { value: compute(), timestamp: now };
        depsRef.current = deps;
      }

      return cacheRef.current.value;
    }, [compute, ...deps]);
  },

  /**
   * Cache API responses with stale-while-revalidate strategy
   */
  useCachedFetch: <T>(url: string, options?: RequestInit) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const cacheRef = useRef<{ data: T; timestamp: number } | null>(null);

    useEffect(() => {
      let mounted = true;
      const CACHE_TTL = 300000; // 5 minutes

      const fetchData = async (useCache = true) => {
        try {
          // Check cache first
          const now = Date.now();
          if (useCache && cacheRef.current && now - cacheRef.current.timestamp < CACHE_TTL) {
            if (mounted) {
              setData(cacheRef.current.data);
              setLoading(false);
            }
            
            // Revalidate in background
            fetchData(false);
            return;
          }

          const response = await fetch(url, options);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const result = await response.json();
          cacheRef.current = { data: result, timestamp: now };

          if (mounted) {
            setData(result);
            setLoading(false);
            setError(null);
          }
        } catch (err) {
          if (mounted) {
            setError(err as Error);
            setLoading(false);
          }
        }
      };

      fetchData();

      return () => { mounted = false; };
    }, [url]);

    return { data, loading, error, refetch: () => fetchData(false) };
  }
};

/**
 * Bundle optimization utilities
 */
export const bundleOptimization = {
  /**
   * Dynamic component imports for code splitting
   */
  dynamicImports: {
    AdminView: dynamic(() => import('@/components/views/admin-view'), {
      loading: () => React.createElement('div', { className: 'flex items-center justify-center h-64' }, 'Loading Admin...'),
      ssr: false
    }),
    
    DeliveryView: dynamic(() => import('@/components/views/delivery-view'), {
      loading: () => React.createElement('div', { className: 'flex items-center justify-center h-64' }, 'Loading Delivery...'),
      ssr: false
    }),

    CustomerView: dynamic(() => import('@/components/views/customer-view'), {
      loading: () => React.createElement('div', { className: 'flex items-center justify-center h-64' }, 'Loading Customer...'),
      ssr: false
    }),

    SubscriptionManager: dynamic(() => import('@/components/customer/subscription-manager'), {
      loading: () => React.createElement('div', { className: 'flex items-center justify-center h-64' }, 'Loading Subscriptions...'),
      ssr: false
    }),

    ProductListing: dynamic(() => import('@/components/product-management/product-listing'), {
      loading: () => React.createElement('div', { className: 'flex items-center justify-center h-64' }, 'Loading Products...'),
      ssr: false
    })
  },

  /**
   * Lazy load heavy libraries
   */
  lazyLibraries: {
    // loadChartLibrary: () => import('chart.js'), // Chart.js not installed
    // loadDatePicker: () => import('react-datepicker'), // react-datepicker not installed
    // loadRichTextEditor: () => import('@/components/ui/rich-text-editor') // Component doesn't exist
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceMonitoring = {
  /**
   * Measure component render performance
   */
  useRenderTracker: (componentName: string) => {
    const renderCount = useRef(0);
    const startTime = useRef(Date.now());

    useEffect(() => {
      renderCount.current++;
      const duration = Date.now() - startTime.current;
      
      if (duration > 100) {
        console.warn(`[Performance] ${componentName} took ${duration}ms to render`);
      }
      
      if (renderCount.current > 10) {
        console.warn(`[Performance] ${componentName} rendered ${renderCount.current} times`);
      }
    });
  },

  /**
   * Monitor memory usage
   */
  useMemoryMonitor: (threshold = 100 * 1024 * 1024) => { // 100MB
    useEffect(() => {
      if (typeof performance === 'undefined' || !performance.memory) return;

      const checkMemory = () => {
        const usedMemory = performance.memory.usedJSHeapSize;
        if (usedMemory > threshold) {
          console.warn(`[Memory] High memory usage: ${(usedMemory / 1024 / 1024).toFixed(2)}MB`);
        }
      };

      const interval = setInterval(checkMemory, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }, [threshold]);
  }
};

/**
 * Virtualization utilities for large lists
 */
export const virtualization = {
  /**
   * Simple virtualization for lists
   */
  useVirtualList: <T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    scrollTop: number
  ) => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
    const visibleItems = items.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;

    return {
      visibleItems,
      startIndex,
      endIndex,
      offsetY,
      totalHeight: items.length * itemHeight
    };
  }
};

/**
 * Export all utilities
 */
export default {
  imageOptimization,
  lazyLoading,
  caching,
  bundleOptimization,
  performanceMonitoring,
  virtualization
};