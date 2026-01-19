import { Product } from './types';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

/**
 * Check if a product is available for the requested quantity
 */
export function isProductAvailable(product: Product, requestedQty: number): boolean {
    // If inventory tracking is disabled, always available
    if (!product.trackInventory) return true;

    const stock = product.stockQuantity || 0;
    return stock >= requestedQty;
}

/**
 * Get the stock status of a product
 */
export function getStockStatus(product: Product): StockStatus {
    // If inventory tracking is disabled
    if (!product.trackInventory) return 'NOT_TRACKED';

    const stock = product.stockQuantity || 0;
    const threshold = product.lowStockThreshold || 5;

    if (stock === 0) return 'OUT_OF_STOCK';
    if (stock <= threshold) return 'LOW_STOCK';
    return 'IN_STOCK';
}

/**
 * Get color class for stock status badge
 */
export function getStockStatusColor(status: StockStatus): string {
    switch (status) {
        case 'IN_STOCK':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'LOW_STOCK':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'OUT_OF_STOCK':
            return 'bg-red-100 text-red-800 border-red-200';
        case 'NOT_TRACKED':
            return 'bg-gray-100 text-gray-800 border-gray-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
}

/**
 * Get display text for stock status
 */
export function getStockStatusText(status: StockStatus): string {
    switch (status) {
        case 'IN_STOCK':
            return 'In Stock';
        case 'LOW_STOCK':
            return 'Low Stock';
        case 'OUT_OF_STOCK':
            return 'Out of Stock';
        case 'NOT_TRACKED':
            return 'Not Tracked';
        default:
            return 'Unknown';
    }
}

/**
 * Get icon for stock status
 */
export function getStockStatusIcon(status: StockStatus): string {
    switch (status) {
        case 'IN_STOCK':
            return '✅';
        case 'LOW_STOCK':
            return '⚠️';
        case 'OUT_OF_STOCK':
            return '❌';
        case 'NOT_TRACKED':
            return '➖';
        default:
            return '❓';
    }
}

/**
 * Calculate new stock after adjustment
 */
export function calculateNewStock(
    currentStock: number,
    adjustmentType: 'ADD' | 'REMOVE' | 'SET',
    quantity: number
): number {
    switch (adjustmentType) {
        case 'ADD':
            return currentStock + quantity;
        case 'REMOVE':
            return Math.max(0, currentStock - quantity);
        case 'SET':
            return Math.max(0, quantity);
        default:
            return currentStock;
    }
}

/**
 * Get products with low stock
 */
export function getLowStockProducts(products: Product[]): Product[] {
    return products.filter(p => {
        if (!p.trackInventory) return false;
        const status = getStockStatus(p);
        return status === 'LOW_STOCK' || status === 'OUT_OF_STOCK';
    });
}

/**
 * Get products that are out of stock
 */
export function getOutOfStockProducts(products: Product[]): Product[] {
    return products.filter(p => {
        if (!p.trackInventory) return false;
        return getStockStatus(p) === 'OUT_OF_STOCK';
    });
}

/**
 * Calculate total inventory value
 */
export function calculateInventoryValue(products: Product[]): number {
    return products.reduce((total, product) => {
        if (!product.trackInventory) return total;
        const stock = product.stockQuantity || 0;
        const price = product.pricePerUnit || 0;
        return total + (stock * price);
    }, 0);
}
