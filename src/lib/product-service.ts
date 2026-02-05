import { Product, ProductVariant } from '@/lib/types';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { firestore as db } from '@/firebase';

export interface ProductFilters {
  category?: string;
  subCategory?: string;
  isActive?: boolean;
  searchTerm?: string;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';
}

export interface ProductSort {
  field: 'name' | 'price' | 'stockQuantity' | 'createdAt' | 'displayOrder';
  direction: 'asc' | 'desc';
}

export interface ProductGroup {
  id: string;
  name: string;
  products: Product[];
}

/**
 * Centralized product management service
 */
export class ProductService {
  private static instance: ProductService;
  private collectionName = 'products';

  static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  /**
   * Get products with filters and sorting
   */
  async getProducts(filters: ProductFilters = {}, sort: ProductSort = { field: 'displayOrder', direction: 'asc' }): Promise<Product[]> {
    let q = collection(db, this.collectionName);
    const constraints: any[] = [];

    // Apply filters
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }
    if (filters.subCategory) {
      constraints.push(where('subCategory', '==', filters.subCategory));
    }
    if (filters.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive));
    }

    // Build query with constraints
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Product));

    // Apply search filter if provided
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      products = products.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.name_te?.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    products.sort((a, b) => {
      let aValue = a[sort.field];
      let bValue = b[sort.field];

      // Handle undefined values
      if (aValue === undefined) aValue = '';
      if (bValue === undefined) bValue = '';

      if (sort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return products;
  }

  /**
   * Get products grouped by subcategory
   */
  async getProductsGroupedBySubcategory(category: string): Promise<ProductGroup[]> {
    const products = await this.getProducts({ category, isActive: true });
    
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
  }

  /**
   * Get single product by ID
   */
  async getProductById(id: string): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  }

  /**
   * Create new product
   */
  async createProduct(productData: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...productData,
      createdAt: serverTimestamp()
    });
    
    return {
      id: docRef.id,
      ...productData,
      createdAt: new Date()
    };
  }

  /**
   * Update existing product
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), updates);
  }

  /**
   * Delete product
   */
  async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  /**
   * Update product stock
   */
  async updateStock(id: string, quantity: number, lastRestocked?: Date): Promise<void> {
    const updates: Partial<Product> = { stockQuantity: quantity };
    if (lastRestocked) {
      updates.lastRestocked = lastRestocked;
    }
    await this.updateProduct(id, updates);
  }

  /**
   * Bulk update products
   */
  async bulkUpdate(updates: { id: string; data: Partial<Product> }[]): Promise<void> {
    const batch = writeBatch(db);
    
    updates.forEach(({ id, data }) => {
      batch.update(doc(db, this.collectionName, id), data);
    });
    
    await batch.commit();
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold: number = 5): Promise<Product[]> {
    const products = await this.getProducts({ isActive: true });
    return products.filter(product => 
      product.trackInventory && 
      product.stockQuantity <= threshold && 
      product.stockQuantity > 0
    );
  }

  /**
   * Get out of stock products
   */
  async getOutOfStockProducts(): Promise<Product[]> {
    const products = await this.getProducts({ isActive: true });
    return products.filter(product => 
      product.trackInventory && 
      product.stockQuantity === 0
    );
  }

  /**
   * Search products
   */
  async searchProducts(searchTerm: string, category?: string): Promise<Product[]> {
    return this.getProducts({ 
      searchTerm, 
      category,
      isActive: true 
    });
  }
}

// Export singleton instance
export const productService = ProductService.getInstance();