import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  imageOptimization,
  lazyLoading,
  caching,
  bundleOptimization,
  performanceMonitoring,
  virtualization
} from '@/lib/performance-optimization';

describe('Performance Optimization Utilities', () => {
  describe('Image Optimization', () => {
    describe('getOptimizedImageUrl', () => {
      it('should optimize Firebase Storage images', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/image.jpg?token=abc';
        const optimized = imageOptimization.getOptimizedImageUrl(url, { width: 300, height: 200, quality: 80 });
        
        expect(optimized).toContain('w=300');
        expect(optimized).toContain('h=200');
        expect(optimized).toContain('q=80');
      });

      it('should handle images without existing query parameters', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/image.jpg';
        const optimized = imageOptimization.getOptimizedImageUrl(url, { width: 300 });
        
        expect(optimized).toContain('?w=300');
      });

      it('should handle images with existing query parameters', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/image.jpg?token=abc';
        const optimized = imageOptimization.getOptimizedImageUrl(url, { width: 300 });
        
        expect(optimized).toContain('&w=300');
      });

      it('should not modify non-Firebase images', () => {
        const url = 'https://example.com/image.jpg';
        const optimized = imageOptimization.getOptimizedImageUrl(url, { width: 300 });
        
        expect(optimized).toBe(url);
      });

      it('should handle empty options', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/image.jpg';
        const optimized = imageOptimization.getOptimizedImageUrl(url);
        
        expect(optimized).toBe(url + '?');
      });
    });

    describe('preloadImage', () => {
      it('should preload image successfully', async () => {
        const mockImg = {
          src: '',
          onload: null as any,
          onerror: null as any
        };
        
        vi.stubGlobal('Image', vi.fn(() => mockImg));
        
        const preloadPromise = imageOptimization.preloadImage('https://example.com/image.jpg');
        
        mockImg.onload();
        await preloadPromise;
        
        expect(mockImg.src).toBe('https://example.com/image.jpg');
      });

      it('should reject on image load error', async () => {
        const mockImg = {
          src: '',
          onload: null as any,
          onerror: null as any
        };
        
        vi.stubGlobal('Image', vi.fn(() => mockImg));
        
        const preloadPromise = imageOptimization.preloadImage('https://example.com/image.jpg');
        
        mockImg.onerror(new Error('Load failed'));
        
        await expect(preloadPromise).rejects.toThrow();
      });
    });

    describe('preloadImages', () => {
      it('should preload multiple images with concurrency control', async () => {
        const preloadImageSpy = vi.spyOn(imageOptimization, 'preloadImage').mockResolvedValue();
        
        const urls = ['url1.jpg', 'url2.jpg', 'url3.jpg', 'url4.jpg', 'url5.jpg'];
        await imageOptimization.preloadImages(urls, 2);

        expect(preloadImageSpy).toHaveBeenCalledTimes(5);
        urls.forEach((url, index) => {
          expect(preloadImageSpy).toHaveBeenNthCalledWith(index + 1, url);
        });
        
        preloadImageSpy.mockRestore();
      });
    });

    describe('getSrcSet', () => {
      it('should generate responsive srcset', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/image.jpg';
        const sizes = [320, 640, 1024];
        
        const srcset = imageOptimization.getSrcSet(url, sizes);
        
        expect(srcset).toContain('320w');
        expect(srcset).toContain('640w');
        expect(srcset).toContain('1024w');
        expect(srcset).toContain('w=320');
        expect(srcset).toContain('w=640');
        expect(srcset).toContain('w=1024');
      });
    });

    describe('getOptimalImageSize', () => {
      it('should return appropriate size for container width', () => {
        expect(imageOptimization.getOptimalImageSize(300)).toBe(320);
        expect(imageOptimization.getOptimalImageSize(500)).toBe(640);
        expect(imageOptimization.getOptimalImageSize(800)).toBe(1024);
      });

      it('should consider device pixel ratio', () => {
        expect(imageOptimization.getOptimalImageSize(300, 2)).toBe(640);
        expect(imageOptimization.getOptimalImageSize(300, 3)).toBe(1024);
      });

      it('should return largest size for very large containers', () => {
        expect(imageOptimization.getOptimalImageSize(2000)).toBe(1920);
        expect(imageOptimization.getOptimalImageSize(3000)).toBe(1920);
      });
    });
  });

  describe('Lazy Loading', () => {
    describe('useDynamicImport', () => {
      it('should handle successful dynamic import', async () => {
        const mockModule = { default: 'MockComponent' };
        const importFn = vi.fn().mockResolvedValue(mockModule);
        
        const { result } = renderHook(() => lazyLoading.useDynamicImport(() => importFn()));
        
        // Wait for async operations
        await vi.waitFor(() => {
          expect(result.current.loading).toBe(false);
          expect(result.current.error).toBe(null);
          expect(result.current.component).toBe('MockComponent');
        });
      });

      it('should handle import errors', async () => {
        const importError = new Error('Import failed');
        const importFn = vi.fn().mockRejectedValue(importError);
        
        const { result } = renderHook(() => lazyLoading.useDynamicImport(() => importFn()));
        
        // Wait for async operations
        await vi.waitFor(() => {
          expect(result.current.loading).toBe(false);
          expect(result.current.error).toBe(importError);
          expect(result.current.component).toBe(null);
        });
      });
    });

    describe('useProgressiveImage', () => {
      it('should handle progressive image loading', async () => {
        const mockImg = {
          src: '',
          onload: null as any,
          onerror: null as any
        };
        
        vi.stubGlobal('Image', vi.fn(() => mockImg));
        
        const { result } = renderHook(() => lazyLoading.useProgressiveImage('full-image.jpg', 'placeholder.jpg'));
        
        expect(result.current.src).toBe('placeholder.jpg');
        expect(result.current.loading).toBe(true);
        
        act(() => {
          mockImg.onload();
        });
        
        await vi.waitFor(() => {
          expect(result.current.src).toBe('full-image.jpg');
          expect(result.current.loading).toBe(false);
        });
      });
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('createMemoryCache', () => {
      it('should create cache with TTL functionality', () => {
        const cache = caching.createMemoryCache<string>();
        
        cache.set('key1', 'value1', 1000);
        expect(cache.get('key1')).toBe('value1');
        
        cache.set('key2', 'value2', 1); // 1ms TTL
        
        // Wait for TTL to expire
        vi.advanceTimersByTime(10);
        expect(cache.get('key2')).toBeUndefined();
      });

      it('should delete values', () => {
        const cache = caching.createMemoryCache<string>();
        
        cache.set('key1', 'value1', 1000);
        expect(cache.get('key1')).toBe('value1');
        
        cache.delete('key1');
        expect(cache.get('key1')).toBeUndefined();
      });

      it('should clear all values', () => {
        const cache = caching.createMemoryCache<string>();
        
        cache.set('key1', 'value1', 1000);
        cache.set('key2', 'value2', 1000);
        
        cache.clear();
        
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBeUndefined();
      });

      it('should return cache size', () => {
        const cache = caching.createMemoryCache<string>();
        
        expect(cache.size()).toBe(0);
        
        cache.set('key1', 'value1', 1000);
        cache.set('key2', 'value2', 1000);
        
        expect(cache.size()).toBe(2);
      });
    });

    describe('useMemoWithTTL', () => {
      it('should memoize expensive computations', () => {
        const compute = vi.fn(() => Math.random());
        
        // Test within the same hook instance
        const { result, rerender } = renderHook(
          ({ deps }) => caching.useMemoWithTTL(compute, deps, 1000),
          { initialProps: { deps: [1, 2, 3] } }
        );
        
        const firstValue = result.current;
        
        // Rerender with same dependencies - should not recompute
        rerender({ deps: [1, 2, 3] });
        expect(result.current).toBe(firstValue);
        
        expect(compute).toHaveBeenCalledTimes(1);
      });

      it('should recompute when dependencies change', () => {
        const compute = vi.fn(() => Math.random());
        
        const { result: result1 } = renderHook(() => caching.useMemoWithTTL(compute, [1], 1000));
        const { result: result2 } = renderHook(() => caching.useMemoWithTTL(compute, [2], 1000));
        
        expect(compute).toHaveBeenCalledTimes(2);
        expect(result1.current).not.toBe(result2.current);
      });
    });

    describe('useCachedFetch', () => {
      it('should fetch and cache data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ data: 'test' })
        });
        
        const { result } = renderHook(() => caching.useCachedFetch('https://api.example.com/data'));
        
        await vi.waitFor(() => {
          expect(result.current.loading).toBe(false);
          expect(result.current.error).toBe(null);
          expect(result.current.data).toEqual({ data: 'test' });
        });
      });

      it('should handle fetch errors', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
        
        const { result } = renderHook(() => caching.useCachedFetch('https://api.example.com/data'));
        
        await vi.waitFor(() => {
          expect(result.current.loading).toBe(false);
          expect(result.current.error).toBeInstanceOf(Error);
          expect(result.current.data).toBe(null);
        });
      });
    });
  });

  describe('Bundle Optimization', () => {
    describe('dynamicImports', () => {
      it('should have AdminView component', () => {
        expect(bundleOptimization.dynamicImports.AdminView).toBeDefined();
      });

      it('should have DeliveryView component', () => {
        expect(bundleOptimization.dynamicImports.DeliveryView).toBeDefined();
      });

      it('should have CustomerView component', () => {
        expect(bundleOptimization.dynamicImports.CustomerView).toBeDefined();
      });

      it('should have SubscriptionManager component', () => {
        expect(bundleOptimization.dynamicImports.SubscriptionManager).toBeDefined();
      });

      it('should have ProductListing component', () => {
        expect(bundleOptimization.dynamicImports.ProductListing).toBeDefined();
      });
    });

    describe('lazyLibraries', () => {
      it('should have commented out library loaders', () => {
        expect(bundleOptimization.lazyLibraries).toBeDefined();
        // These are commented out in the actual implementation
        expect(bundleOptimization.lazyLibraries.loadChartLibrary).toBeUndefined();
        expect(bundleOptimization.lazyLibraries.loadDatePicker).toBeUndefined();
        expect(bundleOptimization.lazyLibraries.loadRichTextEditor).toBeUndefined();
      });
    });
  });

  describe('Performance Monitoring', () => {
    describe('useRenderTracker', () => {
      it('should warn about slow renders', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Mock Date.now to simulate a slow render
        const originalDateNow = Date.now;
        let mockTime = 1000;
        Date.now = vi.fn(() => mockTime);
        
        const { rerender } = renderHook(() => performanceMonitoring.useRenderTracker('TestComponent'));
        
        // Advance time to simulate slow render
        mockTime = 1200; // 200ms later
        
        // Re-render to trigger the effect
        rerender();
        
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('[Performance] TestComponent took')
        );
        
        Date.now = originalDateNow;
        consoleWarn.mockRestore();
      });

      it('should warn about excessive renders', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const { rerender } = renderHook(() => performanceMonitoring.useRenderTracker('TestComponent'));
        
        // Simulate multiple renders
        for (let i = 0; i < 15; i++) {
          rerender();
        }
        
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('[Performance] TestComponent rendered')
        );
        
        consoleWarn.mockRestore();
      });
    });

    describe('useMemoryMonitor', () => {
      it('should monitor memory usage', () => {
        vi.useFakeTimers();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Mock performance.memory
        const originalPerformance = global.performance;
        global.performance = {
          ...originalPerformance,
          memory: {
            usedJSHeapSize: 150 * 1024 * 1024, // 150MB
            totalJSHeapSize: 200 * 1024 * 1024,
            jsHeapSizeLimit: 1000 * 1024 * 1024
          }
        } as any;
        
        renderHook(() => performanceMonitoring.useMemoryMonitor(100 * 1024 * 1024)); // 100MB threshold
        
        vi.advanceTimersByTime(30000); // 30 seconds
        
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('High memory usage: 150.00MB')
        );
        
        vi.useRealTimers();
        consoleWarn.mockRestore();
        global.performance = originalPerformance;
      });
    });
  });

  describe('Virtualization', () => {
    describe('useVirtualList', () => {
      it('should calculate visible items', () => {
        const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`);
        const itemHeight = 50;
        const containerHeight = 200;
        const scrollTop = 100;
        
        const result = virtualization.useVirtualList(items, itemHeight, containerHeight, scrollTop);
        
        expect(result.startIndex).toBe(2); // 100 / 50 = 2
        expect(result.endIndex).toBe(6); // (100 + 200) / 50 = 6
        expect(result.visibleItems).toHaveLength(5); // Items 2, 3, 4, 5, 6
        expect(result.offsetY).toBe(100); // 2 * 50 = 100
        expect(result.totalHeight).toBe(5000); // 100 * 50 = 5000
      });

      it('should handle empty list', () => {
        const items: string[] = [];
        const result = virtualization.useVirtualList(items, 50, 200, 0);
        
        expect(result.startIndex).toBe(0);
        expect(result.endIndex).toBe(4);
        expect(result.visibleItems).toHaveLength(0);
        expect(result.totalHeight).toBe(0);
      });
    });
  });
});