import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, Grid3X3, List, BarChart3, Download } from 'lucide-react';
import { useProducts } from '@/hooks/use-products';
import { ProductListing } from './product-listing';
import { SearchBar } from './search-bar';
import { StockStatusFilter } from './stock-status-filter';
import { SortOptions } from './sort-options';
import { ProductGrid } from './product-grid';
import { EmptyState } from './empty-state';
import { ProductAnalytics } from './product-analytics';
import { ProductFormSheet } from '../admin/product-form-sheet';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/lib/types';

interface ProductManagementDashboardProps {
  userRole: 'admin' | 'customer';
}

export function ProductManagementDashboard({ userRole }: ProductManagementDashboardProps) {
  const { products, loading, error } = useProducts();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'analytics'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Group products by category for better organization
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, products]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        products: products.sort((a, b) => a.displayOrder - b.displayOrder)
      }));
  }, [products]);

  // Filter and sort products based on current filters
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.subCategory?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Apply stock filter
    if (stockFilter !== 'all') {
      filtered = filtered.filter(product => {
        switch (stockFilter) {
          case 'in-stock':
            return (product.stockQuantity || 0) > 10;
          case 'low-stock':
            return (product.stockQuantity || 0) > 0 && (product.stockQuantity || 0) <= 10;
          case 'out-of-stock':
            return (product.stockQuantity || 0) === 0;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.pricePerUnit - b.pricePerUnit;
          break;
        case 'stock':
          comparison = (a.stockQuantity || 0) - (b.stockQuantity || 0);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, stockFilter, sortBy, sortOrder]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  // Analytics data
  const analytics = useMemo(() => {
    const totalProducts = products.length;
    const inStockProducts = products.filter(p => (p.stockQuantity || 0) > 0).length;
    const lowStockProducts = products.filter(p => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) <= 10).length;
    const outOfStockProducts = products.filter(p => (p.stockQuantity || 0) === 0).length;
    const totalValue = products.reduce((sum, p) => sum + (p.pricePerUnit * (p.stockQuantity || 0)), 0);

    return {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue,
      stockRatio: totalProducts > 0 ? (inStockProducts / totalProducts) * 100 : 0
    };
  }, [products]);

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleProductFormClose = () => {
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleProductFormSuccess = (product: Product) => {
    setShowProductForm(false);
    setEditingProduct(null);
    toast({
      title: editingProduct ? 'Product Updated' : 'Product Added',
      description: `${product.name} has been ${editingProduct ? 'updated' : 'added'} successfully.`
    });
  };

  const handleExportData = (format: 'csv' | 'json') => {
    try {
      const data = filteredProducts.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.pricePerUnit,
        stock: product.stockQuantity || 0,
        category: product.category,
        subCategory: product.subCategory,
        unit: product.unit,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        displayOrder: product.displayOrder,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }));

      if (format === 'csv') {
        const headers = Object.keys(data[0] || {});
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Export Complete',
        description: `Products exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export products. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Products</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Management</h1>
          <p className="text-muted-foreground">
            {userRole === 'admin' ? 'Manage your product catalog' : 'Browse our product catalog'}
          </p>
        </div>

        {userRole === 'admin' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExportData('csv')}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button onClick={handleAddProduct} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>Find and filter products efficiently</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search products..."
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <StockStatusFilter
              value={stockFilter}
              onChange={setStockFilter}
            />

            <SortOptions
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortByChange={setSortBy}
              onSortOrderChange={setSortOrder}
            />
          </div>
        </CardContent>
      </Card>

      {/* Analytics Dashboard */}
      {activeTab === 'analytics' && (
        <ProductAnalytics
          products={filteredProducts}
          onRefresh={() => window.location.reload()}
          onExport={handleExportData}
        />
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === 'grid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('grid')}
          className="flex items-center gap-2"
        >
          <Grid3X3 className="w-4 h-4" />
          Grid View
        </Button>
        <Button
          variant={activeTab === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('list')}
          className="flex items-center gap-2"
        >
          <List className="w-4 h-4" />
          List View
        </Button>
        {userRole === 'admin' && (
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('analytics')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Button>
        )}
      </div>

      {/* Product Display */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="No Products Found"
          description="Try adjusting your search or filter criteria."
          icon={Search}
        />
      ) : (
        <>
          {activeTab === 'grid' && (
            <ProductGrid
              products={filteredProducts}
              userRole={userRole}
              onEdit={handleEditProduct}
            />
          )}

          {activeTab === 'list' && (
            <ProductListing
              products={filteredProducts}
              userRole={userRole}
              onEdit={handleEditProduct}
            />
          )}
        </>
      )}

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ProductFormSheet
              isOpen={showProductForm}
              onClose={handleProductFormClose}
              product={editingProduct}
            />
          </div>
        </div>
      )}
    </div>
  );
}