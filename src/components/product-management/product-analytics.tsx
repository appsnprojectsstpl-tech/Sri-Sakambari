import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { Product } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface ProductAnalyticsProps {
  products: Product[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'json') => void;
}

interface AnalyticsData {
  totalProducts: number;
  totalValue: number;
  averagePrice: number;
  medianPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  stockMetrics: {
    totalStock: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    inStockPercentage: number;
    lowStockPercentage: number;
    outOfStockPercentage: number;
  };
  categoryBreakdown: Array<{
    name: string;
    count: number;
    value: number;
    averagePrice: number;
    stockStatus: {
      inStock: number;
      lowStock: number;
      outOfStock: number;
    };
  }>;
  topProducts: Array<{
    product: Product;
    value: number;
    stockStatus: string;
  }>;
  priceDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  trends: {
    stockTrend: 'up' | 'down' | 'stable';
    valueTrend: 'up' | 'down' | 'stable';
    priceTrend: 'up' | 'down' | 'stable';
  };
}

export function ProductAnalytics({ products, dateRange, onRefresh, onExport }: ProductAnalyticsProps) {
  const analytics = useMemo(() => {
    if (!products.length) {
      return null;
    }

    // Basic metrics
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const prices = products.map(p => p.price).sort((a, b) => a - b);
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const medianPrice = prices[Math.floor(prices.length / 2)];
    const priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };

    // Stock metrics
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const inStockCount = products.filter(p => p.stock > 10).length;
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    // Category breakdown
    const categoryMap = new Map<string, Product[]>();
    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(product);
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, products]) => {
      const count = products.length;
      const value = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
      const averagePrice = products.reduce((sum, p) => sum + p.price, 0) / count;
      const inStock = products.filter(p => p.stock > 10).length;
      const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
      const outOfStock = products.filter(p => p.stock === 0).length;

      return {
        name,
        count,
        value,
        averagePrice,
        stockStatus: { inStock, lowStock, outOfStock }
      };
    }).sort((a, b) => b.value - a.value);

    // Top products by value
    const topProducts = products
      .map(product => ({
        product,
        value: product.price * product.stock,
        stockStatus: product.stock === 0 ? 'out-of-stock' : 
                    product.stock <= 10 ? 'low-stock' : 'in-stock'
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Price distribution
    const priceRanges = [
      { min: 0, max: 50, label: 'Under ₹50' },
      { min: 50, max: 100, label: '₹50 - ₹100' },
      { min: 100, max: 200, label: '₹100 - ₹200' },
      { min: 200, max: 500, label: '₹200 - ₹500' },
      { min: 500, max: 1000, label: '₹500 - ₹1000' },
      { min: 1000, max: Infinity, label: 'Over ₹1000' }
    ];

    const priceDistribution = priceRanges.map(range => {
      const count = products.filter(p => p.price >= range.min && p.price < range.max).length;
      return {
        range: range.label,
        count,
        percentage: totalProducts > 0 ? (count / totalProducts) * 100 : 0
      };
    }).filter(d => d.count > 0);

    // Simple trends (would be more sophisticated with historical data)
    const trends = {
      stockTrend: inStockCount > outOfStockCount ? 'up' : 'down',
      valueTrend: totalValue > 0 ? 'up' : 'down',
      priceTrend: averagePrice > medianPrice ? 'up' : 'stable'
    };

    return {
      totalProducts,
      totalValue,
      averagePrice,
      medianPrice,
      priceRange,
      stockMetrics: {
        totalStock,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        inStockPercentage: totalProducts > 0 ? (inStockCount / totalProducts) * 100 : 0,
        lowStockPercentage: totalProducts > 0 ? (lowStockCount / totalProducts) * 100 : 0,
        outOfStockPercentage: totalProducts > 0 ? (outOfStockCount / totalProducts) * 100 : 0
      },
      categoryBreakdown,
      topProducts,
      priceDistribution,
      trends
    };
  }, [products]);

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-muted-foreground text-center">Add some products to see analytics.</p>
        </CardContent>
      </Card>
    );
  }

  const handleExport = (format: 'csv' | 'json') => {
    onExport?.(format);
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Product Analytics</h2>
          <p className="text-muted-foreground">
            {dateRange 
              ? `Data from ${format(dateRange.start, 'MMM d, yyyy')} to ${format(dateRange.end, 'MMM d, yyyy')}`
              : 'Real-time product insights'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalProducts}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon trend={analytics.trends.stockTrend} />
              <span>Stock {analytics.trends.stockTrend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.totalValue.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon trend={analytics.trends.valueTrend} />
              <span>Value {analytics.trends.valueTrend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Price</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.averagePrice.toFixed(2)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon trend={analytics.trends.priceTrend} />
              <span>Price {analytics.trends.priceTrend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.stockMetrics.inStockPercentage.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {analytics.stockMetrics.inStockCount} in stock
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stock Status Distribution</CardTitle>
            <CardDescription>Breakdown of products by stock levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">In Stock</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{analytics.stockMetrics.inStockCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {analytics.stockMetrics.inStockPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Low Stock</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{analytics.stockMetrics.lowStockCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {analytics.stockMetrics.lowStockPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Out of Stock</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{analytics.stockMetrics.outOfStockCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {analytics.stockMetrics.outOfStockPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price Distribution</CardTitle>
            <CardDescription>Products grouped by price ranges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.priceDistribution.map((range, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{range.range}</span>
                    <span className="font-medium">{range.count} items</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${range.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
          <CardDescription>Top categories by value and product count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.categoryBreakdown.slice(0, 5).map((category, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category.count} products • Avg: ₹{category.averagePrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">₹{category.value.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">
                    {((category.value / analytics.totalValue) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Products by Value */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products by Inventory Value</CardTitle>
          <CardDescription>Products with highest total value (price × stock)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.topProducts.slice(0, 8).map((item, index) => (
              <div key={item.product.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.product.category} • Stock: {item.product.stock}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">₹{item.value.toLocaleString()}</div>
                  <Badge 
                    variant={item.stockStatus === 'in-stock' ? 'success' : 
                            item.stockStatus === 'low-stock' ? 'warning' : 'destructive'}
                    className="text-xs"
                  >
                    {item.stockStatus.replace('-', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}