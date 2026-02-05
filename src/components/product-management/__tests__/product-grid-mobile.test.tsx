import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ProductGrid } from '../product-grid';
import { Product } from '@/lib/types';
import React from 'react';

// Mock the hooks used in ProductGrid
vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: [],
    addToCart: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({
    user: { id: 'test-user', email: 'test@example.com' }
  })
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    formatCurrency: (price: number) => `₹${price}`
  };
});

// Mock products for testing
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Test Product 1',
    description: 'A test product description that is long enough to test truncation on mobile devices',
    price: 99.99,
    stock: 15,
    category: 'Electronics',
    subCategory: 'Mobile',
    unit: 'piece',
    imageUrl: 'https://via.placeholder.com/150',
    isActive: true,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    rating: 4.5,
    reviewCount: 10
  },
  {
    id: '2',
    name: 'Low Stock Product',
    description: 'Product with low stock',
    price: 49.99,
    stock: 5,
    category: 'Home',
    unit: 'kg',
    imageUrl: 'https://via.placeholder.com/150',
    isActive: true,
    displayOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Out of Stock Product',
    description: 'Product that is out of stock',
    price: 199.99,
    stock: 0,
    category: 'Electronics',
    unit: 'piece',
    imageUrl: 'https://via.placeholder.com/150',
    isActive: true,
    displayOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const renderProductGrid = (userRole: 'admin' | 'customer' = 'customer') => {
  return render(
    <ProductGrid 
      products={mockProducts} 
      userRole={userRole}
    />
  );
};

describe('ProductGrid Mobile Responsiveness', () => {
  beforeEach(() => {
    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 640px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  test('renders product cards with mobile-optimized sizing', () => {
    renderProductGrid();
    
    // Check that product cards are rendered
    const productCards = screen.getAllByRole('article');
    expect(productCards.length).toBe(mockProducts.length);
  });

  test('displays mobile-optimized product names', () => {
    renderProductGrid();
    
    mockProducts.forEach(product => {
      const productName = screen.getByText(product.name);
      expect(productName).toBeInTheDocument();
      expect(productName).toHaveClass('text-base', 'sm:text-lg');
    });
  });

  test('shows mobile-friendly price formatting', () => {
    renderProductGrid();
    
    mockProducts.forEach(product => {
      const priceElement = screen.getByText(`₹${product.price}`);
      expect(priceElement).toBeInTheDocument();
      expect(priceElement).toHaveClass('text-lg', 'sm:text-2xl');
    });
  });

  test('renders stock status with mobile-optimized text', () => {
    renderProductGrid();
    
    // Check for stock status badges
    const stockBadges = screen.getAllByRole('status');
    expect(stockBadges.length).toBeGreaterThan(0);
    
    // Verify mobile-optimized text classes
    stockBadges.forEach(badge => {
      expect(badge).toHaveClass('text-xs', 'sm:text-sm');
    });
  });

  test('displays mobile-optimized buttons for customer role', () => {
    renderProductGrid('customer');
    
    const addToCartButtons = screen.getAllByRole('button', { name: /cart/i });
    expect(addToCartButtons.length).toBe(mockProducts.length);
    
    addToCartButtons.forEach(button => {
      expect(button).toHaveClass('text-xs', 'sm:text-sm');
    });
  });

  test('shows mobile-optimized buttons for admin role', () => {
    renderProductGrid('admin');
    
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    
    expect(editButtons.length).toBe(mockProducts.length);
    expect(viewButtons.length).toBe(mockProducts.length);
    
    // Check button text visibility classes
    editButtons.forEach(button => {
      expect(button).toHaveClass('text-xs', 'sm:text-sm');
    });
  });

  test('renders mobile-optimized avatar sizes', () => {
    renderProductGrid();
    
    const avatars = screen.getAllByRole('img');
    expect(avatars.length).toBe(mockProducts.length);
    
    avatars.forEach(avatar => {
      expect(avatar.closest('div')).toHaveClass('w-10', 'h-10', 'sm:w-12', 'sm:h-12');
    });
  });

  test('handles long product names with proper truncation', () => {
    const longNameProduct: Product = {
      ...mockProducts[0],
      name: 'This is an extremely long product name that should be truncated on mobile devices to prevent overflow'
    };
    
    render(
      <ProductGrid 
        products={[longNameProduct]} 
        userRole="customer"
      />
    );
    
    const productName = screen.getByText(longNameProduct.name);
    expect(productName).toHaveClass('line-clamp-2');
  });

  test('shows compact stock information on mobile', () => {
    renderProductGrid();
    
    // Check that stock count is visible on mobile (hidden label on small screens)
    const stockElements = screen.getAllByText(/piece|kg|units/);
    expect(stockElements.length).toBeGreaterThan(0);
  });

  test('renders mobile-friendly grid gaps', () => {
    renderProductGrid();
    
    const gridContainer = screen.getByRole('region');
    expect(gridContainer).toHaveClass('gap-3', 'sm:gap-4', 'lg:gap-6');
  });

  test('handles empty state gracefully on mobile', () => {
    render(
      <ProductGrid 
        products={[]} 
        userRole="customer"
      />
    );
    
    expect(screen.getByText('No Products Found')).toBeInTheDocument();
  });
});