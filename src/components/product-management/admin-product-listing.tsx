'use client';

import { useState } from 'react';
import { ProductListing } from '@/components/product-management';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminProductListingProps {
  onProductEdit: (product: Product) => void;
  onProductDelete: (productId: string) => void;
  onProductAdd: () => void;
}

export function AdminProductListing({ 
  onProductEdit, 
  onProductDelete, 
  onProductAdd 
}: AdminProductListingProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleProductSelect = (product: Product) => {
    try {
      setSelectedProduct(product);
    } catch (error) {
      console.error('Error selecting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to display product details',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const handleEditProduct = (product: Product) => {
    try {
      onProductEdit(product);
    } catch (error) {
      console.error('Error editing product:', error);
      toast({
        title: 'Error',
        description: 'Failed to open product editor',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (isDeleting) return; // Prevent multiple simultaneous deletions
    
    const confirmed = window.confirm('Are you sure you want to delete this product? This action cannot be undone and will affect all existing orders.');
    if (!confirmed) return;
    
    setIsDeleting(productId);
    
    try {
      await onProductDelete(productId);
      toast({
        title: 'Product Deleted',
        description: 'Product has been successfully deleted from the catalog',
        duration: 3000,
      });
      
      // Close the details panel if the deleted product was selected
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      
      let errorMessage = 'Failed to delete product. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = 'You do not have permission to delete this product';
        } else if (error.message.includes('product-in-use')) {
          errorMessage = 'This product cannot be deleted because it is referenced in existing orders';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Product Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog, inventory, and pricing
          </p>
        </div>
        <Button onClick={onProductAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-foreground">0</div>
          <div className="text-sm text-muted-foreground">Total Products</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">0</div>
          <div className="text-sm text-muted-foreground">In Stock</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">0</div>
          <div className="text-sm text-muted-foreground">Low Stock</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">0</div>
          <div className="text-sm text-muted-foreground">Out of Stock</div>
        </div>
      </div>

      {/* Enhanced Product Listing for Admin */}
      <ProductListing
        title="All Products"
        description="Click on any product to view details or edit"
        enableSearch={true}
        enableFilters={true}
        enableSorting={true}
        layout="list"
        onProductSelect={handleProductSelect}
        cartItems={[]} // No cart functionality for admin
        onAddToCart={() => {}} // No-op for admin
        onUpdateQuantity={() => {}} // No-op for admin
      />

      {/* Product Details Panel */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Product Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  try {
                    setSelectedProduct(null);
                  } catch (error) {
                    console.error('Error closing product details:', error);
                    toast({
                      title: 'Error',
                      description: 'Failed to close product details',
                      variant: 'destructive',
                      duration: 3000,
                    });
                  }
                }}
              >
                Close
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-foreground">{selectedProduct.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedProduct.category}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="font-medium">₹{selectedProduct.pricePerUnit}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unit</p>
                  <p className="font-medium">{selectedProduct.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stock</p>
                  <p className="font-medium">{selectedProduct.stockQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">
                    {selectedProduct.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleEditProduct(selectedProduct)}
                  className="flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Product
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteProduct(selectedProduct.id)}
                  disabled={isDeleting === selectedProduct.id}
                  className="flex items-center gap-2"
                >
                  {isDeleting === selectedProduct.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Product
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}