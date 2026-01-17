'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Plus, ShoppingCart } from 'lucide-react';
import type { Order, Product } from '@/lib/types';
import { useMemo } from 'react';
import Image from 'next/image';

interface FavoriteProductsProps {
    orders: Order[];
    onReorder: (productId: string) => void;
}

export default function FavoriteProducts({ orders, onReorder }: FavoriteProductsProps) {
    const favoriteProducts = useMemo(() => {
        // Count product frequency
        const productCount = new Map<string, { count: number; name: string; name_te?: string; lastPrice: number }>();

        orders.forEach(order => {
            order.items.forEach(item => {
                const current = productCount.get(item.productId) || { count: 0, name: item.name || 'Unknown', name_te: item.name_te, lastPrice: item.priceAtOrder };
                productCount.set(item.productId, {
                    count: current.count + item.qty,
                    name: item.name || current.name,
                    name_te: item.name_te || current.name_te,
                    lastPrice: item.priceAtOrder
                });
            });
        });

        // Convert to array and sort by count
        return Array.from(productCount.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6); // Top 6 products
    }, [orders]);

    if (favoriteProducts.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        Favorite Products
                    </CardTitle>
                    <CardDescription>Your most ordered items</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-8">
                        Place some orders to see your favorite products here!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    Favorite Products
                </CardTitle>
                <CardDescription>Quick reorder your favorites</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-3">
                    {favoriteProducts.map((product) => (
                        <div key={product.id} className="border rounded-lg p-3 space-y-2">
                            <div className="aspect-square relative bg-gray-50 rounded-md overflow-hidden">
                                <Image
                                    src={`https://picsum.photos/seed/${product.id}/200/200`}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                    sizes="150px"
                                />
                                <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                                    <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                                </div>
                            </div>
                            <div>
                                <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                                <p className="text-xs text-muted-foreground">Ordered {product.count}x</p>
                                <p className="text-sm font-bold text-green-600">₹{product.lastPrice}</p>
                            </div>
                            <Button
                                size="sm"
                                className="w-full"
                                variant="outline"
                                onClick={() => onReorder(product.id)}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add to Cart
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
