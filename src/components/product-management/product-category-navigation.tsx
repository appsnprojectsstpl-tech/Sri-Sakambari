import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  Package,
  Search,
  Filter,
  Grid,
  List,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  productCount: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  imageUrl?: string;
}

interface ProductCategoryNavigationProps {
  products: Product[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  viewMode: 'grid' | 'list' | 'analytics';
  onViewModeChange: (mode: 'grid' | 'list' | 'analytics') => void;
  userRole: 'admin' | 'customer';
}

export function ProductCategoryNavigation({
  products,
  selectedCategory,
  onCategorySelect,
  viewMode,
  onViewModeChange,
  userRole
}: ProductCategoryNavigationProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Group products by category and calculate statistics
  const categories = useMemo(() => {
    const categoryMap = new Map<string, Product[]>();

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(product);
    });

    return Array.from(categoryMap.entries()).map(([name, products]) => {
      const inStockCount = products.filter(p => (p.stockQuantity || 0) > 10).length;
      const lowStockCount = products.filter(p => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) <= 10).length;
      const outOfStockCount = products.filter(p => (p.stockQuantity || 0) === 0).length;
      const totalValue = products.reduce((sum, p) => sum + (p.pricePerUnit * (p.stockQuantity || 0)), 0);

      return {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        productCount: products.length,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalValue,
        description: `Browse ${products.length} products in ${name}`
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    return categories.filter(category =>
      category.name.toLowerCase().includes(query) ||
      category.description?.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getStockStatusColor = (inStock: number, lowStock: number, outOfStock: number) => {
    if (outOfStock > 0 && inStock === 0 && lowStock === 0) return 'text-red-600';
    if (lowStock > 0) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStockStatusIcon = (inStock: number, lowStock: number, outOfStock: number) => {
    if (outOfStock > 0 && inStock === 0 && lowStock === 0) return <AlertTriangle className="w-4 h-4" />;
    if (lowStock > 0) return <Package className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  if (categories.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Categories Found</h3>
          <p className="text-muted-foreground text-center">Products need to be categorized to appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Product Categories</h2>
          <p className="text-muted-foreground">Browse products by category</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className="flex items-center gap-2"
          >
            <Grid className="w-4 h-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="flex items-center gap-2"
          >
            <List className="w-4 h-4" />
            List
          </Button>
          {userRole === 'admin' && (
            <Button
              variant={viewMode === 'analytics' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('analytics')}
              className="flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((category) => {
          const isExpanded = expandedCategories.includes(category.id);
          const isSelected = selectedCategory === category.name;

          return (
            <Card
              key={category.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected && "ring-2 ring-primary shadow-md"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5 text-muted-foreground" />
                      {category.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {category.description}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {category.productCount} items
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Stock Status Summary */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      In Stock
                    </span>
                    <span className="font-medium">{category.inStockCount}</span>
                  </div>

                  {category.lowStockCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-yellow-600">
                        <Package className="w-3 h-3" />
                        Low Stock
                      </span>
                      <span className="font-medium">{category.lowStockCount}</span>
                    </div>
                  )}

                  {category.outOfStockCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        Out of Stock
                      </span>
                      <span className="font-medium">{category.outOfStockCount}</span>
                    </div>
                  )}
                </div>

                {/* Total Value */}
                <div className="mb-4 p-2 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground">Total Value</div>
                  <div className="text-lg font-bold">
                    ₹{category.totalValue.toLocaleString()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => onCategorySelect(category.name)}
                    className="flex-1"
                  >
                    {isSelected ? 'Selected' : 'Browse'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCategoryExpansion(category.id)}
                    className="px-2"
                  >
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                  </Button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="text-sm font-medium mb-2">Quick Stats</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-green-50 rounded">
                        <div className="font-medium text-green-700">In Stock</div>
                        <div className="text-green-600">{category.inStockCount}</div>
                      </div>
                      <div className="p-2 bg-yellow-50 rounded">
                        <div className="font-medium text-yellow-700">Low Stock</div>
                        <div className="text-yellow-600">{category.lowStockCount}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stock Ratio: {category.productCount > 0
                        ? ((category.inStockCount / category.productCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Footer */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {categories.length} Categories
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {products.length} Total Products
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Showing {filteredCategories.length} of {categories.length} categories
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}