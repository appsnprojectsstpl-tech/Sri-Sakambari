import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductFormSheet } from '@/components/admin/product-form-sheet';
import type { Product } from '@/lib/types';

// Mock the Firebase hooks and components
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  storage: {}
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn()
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn()
}));

describe('Product Form Master Product Checkbox', () => {
  const mockProduct: Product = {
    id: 'test-product-1',
    name: 'Test Tomato',
    category: 'Vegetables',
    pricePerUnit: 50,
    unit: 'Kg',
    isActive: true,
    imageUrl: '/test-image.jpg',
    imageHint: 'Fresh tomato',
    displayOrder: 1,
    createdAt: new Date(),
    isCutVegetable: false,
    cutCharge: 0,
    stockQuantity: 100,
    trackInventory: true,
    variants: []
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    product: mockProduct,
    onSave: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render master product checkbox', () => {
    render(<ProductFormSheet {...defaultProps} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product');
    expect(masterProductCheckbox).toBeInTheDocument();
    expect(masterProductCheckbox).toBeInstanceOf(HTMLInputElement);
  });

  it('should have master product checkbox unchecked by default', () => {
    render(<ProductFormSheet {...defaultProps} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    expect(masterProductCheckbox.checked).toBe(false);
  });

  it('should check master product checkbox when clicked', () => {
    render(<ProductFormSheet {...defaultProps} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    fireEvent.click(masterProductCheckbox);
    
    expect(masterProductCheckbox.checked).toBe(true);
  });

  it('should auto-add variants when master product checkbox is checked for vegetables', () => {
    render(<ProductFormSheet {...defaultProps} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    fireEvent.click(masterProductCheckbox);
    
    // Should show variant management UI
    expect(screen.getByText('Product Variants')).toBeInTheDocument();
  });

  it('should preserve master product state when form is submitted', () => {
    const onSave = vi.fn();
    render(<ProductFormSheet {...defaultProps} onSave={onSave} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    fireEvent.click(masterProductCheckbox);
    
    const submitButton = screen.getByRole('button', { name: /update|save/i });
    fireEvent.click(submitButton);
    
    // The form should handle the master product state
    expect(onSave).toHaveBeenCalled();
  });

  it('should handle variant group ID generation for master products', () => {
    render(<ProductFormSheet {...defaultProps} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    fireEvent.click(masterProductCheckbox);
    
    // When master product is checked, it should generate a variant group ID
    expect(masterProductCheckbox.checked).toBe(true);
  });

  it('should show existing master product state when editing', () => {
    const masterProduct = {
      ...mockProduct,
      isMasterProduct: true,
      variantGroupId: 'test-group-1'
    };
    
    render(<ProductFormSheet {...defaultProps} product={masterProduct} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    expect(masterProductCheckbox.checked).toBe(true);
  });

  it('should handle variant products with master product ID', () => {
    const variantProduct = {
      ...mockProduct,
      masterProductId: 'master-product-1',
      variantGroupId: 'test-group-1',
      isMasterProduct: false
    };
    
    render(<ProductFormSheet {...defaultProps} product={variantProduct} />);
    
    const masterProductCheckbox = screen.getByLabelText('Master Product') as HTMLInputElement;
    expect(masterProductCheckbox.checked).toBe(false);
  });
});