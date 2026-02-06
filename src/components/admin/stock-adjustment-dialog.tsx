'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Product } from '@/lib/types';
import { calculateNewStock } from '@/lib/inventory-utils';
import { ArrowUp, ArrowDown, Edit3 } from 'lucide-react';

interface StockAdjustmentDialogProps {
    product: Product | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdjust: (productId: string, newStock: number, type: string, quantity: number, reason: string) => Promise<void>;
}

export function StockAdjustmentDialog({
    product,
    open,
    onOpenChange,
    onAdjust
}: StockAdjustmentDialogProps) {
    const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE' | 'SET'>('ADD');
    const [quantity, setQuantity] = useState<string>('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState<string>('base');

    const hasVariants = product?.variants && product.variants.length > 0;

    let currentStock = product?.stockQuantity || 0;
    let unit = product?.unit || '';

    if (hasVariants && selectedVariantId !== 'base') {
        const variant = product!.variants!.find(v => v.id === selectedVariantId);
        if (variant) {
            currentStock = variant.stock;
            unit = variant.unit;
        }
    }

    const quantityNum = parseFloat(quantity) || 0;
    const newStock = calculateNewStock(currentStock, adjustmentType, quantityNum);

    const handleSubmit = async () => {
        if (!product || !quantity || quantityNum <= 0) return;

        setLoading(true);
        try {
            await onAdjust(
                product.id,
                newStock,
                adjustmentType,
                quantityNum,
                reason,
                (hasVariants && selectedVariantId !== 'base') ? selectedVariantId : undefined
            );
            // Reset form
            setQuantity('');
            setReason('');
            setAdjustmentType('ADD');
            setSelectedVariantId('base');
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to adjust stock:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Adjust Stock - {product.name}</DialogTitle>
                    <DialogDescription>
                        Update inventory levels for this product
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Variant Selector */}
                    {hasVariants && (
                        <div className="space-y-2">
                            <Label>Select Variant</Label>
                            <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="base">Total Stock (Read-only)</SelectItem>
                                    {product.variants!.map(v => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.unit} - Current: {v.stock}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedVariantId === 'base' && (
                                <p className="text-xs text-muted-foreground text-yellow-600">
                                    Please select a variant to adjust its stock.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Current Stock */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Current Stock:</span>
                        <span className="text-lg font-bold">{currentStock} {unit}</span>
                    </div>

                    {/* Adjustment Type */}
                    <div className="space-y-2">
                        <Label>Action</Label>
                        <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADD">
                                    <div className="flex items-center gap-2">
                                        <ArrowUp className="h-4 w-4 text-green-600" />
                                        Add Stock (Received)
                                    </div>
                                </SelectItem>
                                <SelectItem value="REMOVE">
                                    <div className="flex items-center gap-2">
                                        <ArrowDown className="h-4 w-4 text-red-600" />
                                        Remove Stock (Wastage/Damage)
                                    </div>
                                </SelectItem>
                                <SelectItem value="SET">
                                    <div className="flex items-center gap-2">
                                        <Edit3 className="h-4 w-4 text-blue-600" />
                                        Set Stock (Manual Correction)
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                        <Label>Quantity ({unit})</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder={`Enter quantity in ${unit}`}
                            disabled={hasVariants && selectedVariantId === 'base'}
                        />
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label>Reason (Optional)</Label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., Received shipment, Damaged goods, Inventory count correction"
                            rows={2}
                        />
                    </div>

                    {/* Preview */}
                    {quantity && quantityNum > 0 && (
                        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                            <span className="text-sm font-medium">New Stock:</span>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground line-through">{currentStock}</span>
                                <span className="text-xl font-bold text-primary">→ {newStock} {unit}</span>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!quantity || quantityNum <= 0 || loading || (hasVariants && selectedVariantId === 'base')}
                    >
                        {loading ? 'Updating...' : 'Update Stock'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
