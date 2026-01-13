'use client';

import { useCollection } from '@/firebase';
import type { Product } from '@/lib/types';
import { products as seedProducts } from '@/lib/seed-data';
import { useMemo } from 'react';
import ShopLayout, { CategoryData } from '@/components/shop-layout';

export default function FruitsPage() {
  const { data: firestoreProducts, loading: productsLoading } = useCollection<Product>('products', {
    constraints: [['where', 'category', '==', 'Fruits'], ['where', 'isActive', '==', true]]
  });

  const products = useMemo(() => {
    const hasFirestoreFruits = firestoreProducts && firestoreProducts.length > 0;
    const sourceProducts = hasFirestoreFruits ? firestoreProducts : seedProducts;
    return sourceProducts.filter(p => p.category === 'Fruits' && p.isActive);
  }, [firestoreProducts]);

  // Group by SubCategory
  const categories = useMemo<CategoryData[]>(() => {
    const groups: Record<string, Product[]> = {};

    products.forEach(p => {
      const sub = p.subCategory || 'Other Fruits';
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(p);
    });

    const sortedKeys = Object.keys(groups).sort();

    return sortedKeys.map(key => ({
      id: key.toLowerCase().replace(/\s+/g, '-'),
      name: key,
      products: groups[key]
    }));
  }, [products]);

  return (
    <ShopLayout
      title="Fruits"
      categories={categories}
      loading={productsLoading && categories.length === 0}
    />
  );
}
