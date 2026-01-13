'use client';

import { useCollection } from '@/firebase';
import type { Product } from '@/lib/types';
import { products as seedProducts } from '@/lib/seed-data';
import { useMemo } from 'react';
import ShopLayout, { CategoryData } from '@/components/shop-layout';

export default function VegetablesPage() {
  const { data: firestoreProducts, loading: productsLoading } = useCollection<Product>('products', {
    constraints: [['where', 'category', '==', 'Vegetables'], ['where', 'isActive', '==', true]]
  });

  const products = useMemo(() => {
    const hasFirestoreVegs = firestoreProducts && firestoreProducts.length > 0;
    const sourceProducts = hasFirestoreVegs ? firestoreProducts : seedProducts;
    return sourceProducts.filter(p => p.category === 'Vegetables' && p.isActive);
  }, [firestoreProducts]);

  // Group by SubCategory
  const categories = useMemo<CategoryData[]>(() => {
    const groups: Record<string, Product[]> = {};

    products.forEach(p => {
      const sub = p.subCategory || 'Fresh Vegetables';
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(p);
    });

    // Valid subcategories order or arbitrary sort
    const sortedKeys = Object.keys(groups).sort();

    return sortedKeys.map(key => ({
      id: key.toLowerCase().replace(/\s+/g, '-'),
      name: key,
      products: groups[key]
    }));
  }, [products]);

  return (
    <ShopLayout
      title="Vegetables"
      categories={categories}
      loading={productsLoading && categories.length === 0}
    />
  );
}
