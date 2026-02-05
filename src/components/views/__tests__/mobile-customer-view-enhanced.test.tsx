import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MobileCustomerView from '@/components/views/mobile-customer-view';
import { Product, CartItem } from '@/lib/types';

// Mock dependencies
vi.mock('@/hooks/use-store-status', () => ({
  useStoreStatus: () => ({
    isOpen: true,
    loading: false
  })
}));

vi.mock('@/context/language-context', () => ({
  useLanguage: () => ({ language: 'en' })
}));

vi.mock('@/firebase', () => ({
  useCollection: () => ({
    data: mockProducts,
    loading: false
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/components/notification-manager', () => ({
  default: () => <div data-testid="notification-manager">Notification Manager</div>
}));

vi.mock('@/components/install-prompt', () => ({
  default: () => <div data-testid="install-prompt">Install Prompt</div>
}));

vi.mock('@/components/fly-to-cart-context', () => ({
  useFlyToCart: () => ({
    addToCart: vi.fn()
  })
}));

vi.mock('@/lib/haptics', () => ({
  haptics: {
    impact: vi.fn()
  },
  ImpactStyle: {
    Light: 'light',
    Medium: 'medium'
  }
}));

vi.mock('@/lib/inventory-utils', () => ({
  getStockStatus: () => 'IN_STOCK'
}));

vi.mock('@/lib/translations', () => ({
  getProductName: (product: Product) => product.name
}));

// Mock products for testing
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Fresh Tomatoes',
    description: 'Organic fresh tomatoes',
    price: 45,
    pricePerUnit: 45,
    stock: 50,
    stockQuantity: 50,
    category: 'Vegetables',
    unit: 'kg',
    imageUrl: 'https://via.placeholder.com/150',
    isActive: true,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    trackInventory: true,
    variants: []
  },
  {
    id: '2',
    name: 'Crisp Apples',
    description: 'Fresh red apples',
    price: 80,
    pricePerUnit: 80,
    stock: 30,
    stockQuantity: 30,
    category: 'Fruits',
    unit: 'kg',
    imageUrl: 'https://via.placeholder.com/150',
    isActive: true,
    displayOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    trackInventory: true,
    variants: []
  },
  {
    id: '3',
    name: 'Fresh Milk',
    description: 'Farm fresh milk',
    price: 60,
    pricePerUnit: 60,
    stock: 25,
    stockQuantity: 25,
    category: 'Dairy',
    unit: 'liter',
    imageUrl: 'https://via.placeholder.com/150',
    isActive: true,
    displayOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    trackInventory: true,
    variants: []
  }
];

const mockCart: CartItem[] = [];

const mockAddToCart = vi.fn();
const mockUpdateCartQuantity = vi.fn();

const renderMobileCustomerView = () => {
  return render(
    <MobileCustomerView
      cart={mockCart}
      addToCart={mockAddToCart}
      updateCartQuantity={mockUpdateCartQuantity}
    />
  );
};

describe('MobileCustomerView - Enhanced Responsive 2-Column Grid', () => {
  beforeEach(() => {
    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
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

  test('renders mobile customer view with enhanced 2-column grid layout', () => {
    renderMobileCustomerView();
    
    // Check that the main container is rendered
    const container = screen.getByTestId('mobile-customer-view');
    expect(container).toBeInTheDocument();
    
    // Check that products are displayed in grid
    const products = screen.getAllByRole('article');
    expect(products.length).toBe(mockProducts.length);
  });

  test('displays search functionality with mobile optimization', () => {
    renderMobileCustomerView();
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    expect(searchInput).toBeInTheDocument();
    
    // Test search functionality
    fireEvent.change(searchInput, { target: { value: 'tomato' } });
    expect(searchInput).toHaveValue('tomato');
  });

  test('shows category filter buttons with mobile styling', () => {
    renderMobileCustomerView();
    
    const categories = ['All', 'Vegetables', 'Fruits', 'Dairy'];
    categories.forEach(category => {
      const button = screen.getByText(category);
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('mobile-category-pill');
    });
  });

  test('renders product cards with enhanced mobile-optimized sizing', () => {
    renderMobileCustomerView();
    
    const productCards = screen.getAllByRole('article');
    expect(productCards.length).toBe(mockProducts.length);
    
    // Check mobile-optimized classes
    productCards.forEach(card => {
      expect(card).toHaveClass('mobile-product-card-enhanced');
    });
  });

  test('displays touch-friendly tap targets with proper sizing', () => {
    renderMobileCustomerView();
    
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    expect(addButtons.length).toBeGreaterThan(0);
    
    addButtons.forEach(button => {
      expect(button).toHaveClass('mobile-touch-target');
      // Check minimum touch target size (44px)
      const computedStyle = window.getComputedStyle(button);
      expect(parseInt(computedStyle.minWidth)).toBeGreaterThanOrEqual(44);
      expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(44);
    });
  });

  test('handles add to cart functionality with haptic feedback', () => {
    renderMobileCustomerView();
    
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    expect(addButtons.length).toBeGreaterThan(0);
    
    // Click first add button
    fireEvent.click(addButtons[0]);
    expect(mockAddToCart).toHaveBeenCalled();
    expect(vi.mocked(haptics.impact)).toHaveBeenCalledWith('medium');
  });

  test('shows seasonal picks section for vegetables category', () => {
    renderMobileCustomerView();
    
    // Click on Vegetables category
    const vegetablesButton = screen.getByText('Vegetables');
    fireEvent.click(vegetablesButton);
    
    // Should show seasonal picks
    expect(screen.getByText('Seasonal Picks')).toBeInTheDocument();
  });

  test('renders consistent card heights across all products', () => {
    renderMobileCustomerView();
    
    const productCards = screen.getAllByRole('article');
    const heights = productCards.map(card => card.clientHeight);
    
    // All cards should have the same height (within 2 pixels tolerance)
    const uniqueHeights = new Set(heights);
    expect(uniqueHeights.size).toBeLessThanOrEqual(2);
  });

  test('handles load more functionality with mobile optimization', () => {
    // Mock many products
    const manyProducts = Array.from({ length: 20 }, (_, i) => ({
      ...mockProducts[0],
      id: `product-${i}`,
      name: `Product ${i}`
    }));
    
    vi.mocked(useCollection).mockReturnValue({
      data: manyProducts,
      loading: false
    });
    
    renderMobileCustomerView();
    
    // Should show load more button
    const loadMoreButton = screen.getByText('Load More');
    expect(loadMoreButton).toBeInTheDocument();
    expect(loadMoreButton).toHaveClass('mobile-load-more');
    
    // Click load more
    fireEvent.click(loadMoreButton);
    // In real implementation, this would load more products
  });

  test('handles empty products state gracefully', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: [],
      loading: false
    });
    
    renderMobileCustomerView();
    
    expect(screen.getByText('No products found.')).toBeInTheDocument();
  });

  test('renders with proper spacing for mobile devices', () => {
    renderMobileCustomerView();
    
    const gridContainer = screen.getByTestId('mobile-product-grid');
    expect(gridContainer).toHaveClass('mobile-customer-grid');
    // Should have mobile-optimized gap
    const computedStyle = window.getComputedStyle(gridContainer);
    expect(computedStyle.gap).toBe('0.75rem'); // 12px gap
  });

  test('handles orientation changes with responsive design', () => {
    renderMobileCustomerView();
    
    // Simulate orientation change
    Object.defineProperty(window, 'orientation', {
      value: 90,
      writable: true
    });
    
    // Should still render properly
    const productCards = screen.getAllByRole('article');
    expect(productCards.length).toBe(mockProducts.length);
  });

  test('optimizes for smooth scrolling performance', () => {
    renderMobileCustomerView();
    
    const gridContainer = screen.getByTestId('mobile-product-grid');
    const computedStyle = window.getComputedStyle(gridContainer);
    
    // Should have smooth scrolling
    expect(computedStyle.scrollBehavior).toBe('smooth');
    
    // Should have hardware acceleration
    expect(computedStyle.transform).toContain('translateZ');
  });

  test('handles store closed state with proper messaging', () => {
    // Mock store as closed
    vi.mocked(useStoreStatus).mockReturnValue({
      isOpen: false,
      loading: false
    });
    
    renderMobileCustomerView();
    
    // Should show store closed message
    expect(screen.getByText('Store is closed. Orders are paused.')).toBeInTheDocument();
  });

  test('provides proper accessibility features', () => {
    renderMobileCustomerView();
    
    // Check ARIA labels
    const productCards = screen.getAllByRole('article');
    productCards.forEach(card => {
      expect(card).toHaveAttribute('aria-label');
    });
    
    // Check button accessibility
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    addButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-label');
    });
  });

  test('handles haptic feedback on interactions', () => {
    renderMobileCustomerView();
    
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    
    // Click add button
    fireEvent.click(addButtons[0]);
    
    // Should trigger haptic feedback
    expect(vi.mocked(haptics.impact)).toHaveBeenCalledWith('medium');
  });

  test('maintains visual consistency with design system', () => {
    renderMobileCustomerView();
    
    // Check consistent colors
    const productCards = screen.getAllByRole('article');
    productCards.forEach(card => {
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.backgroundColor).toBe('rgb(255, 255, 255)'); // White background
    });
    
    // Check consistent typography
    const titles = screen.getAllByText(/Fresh/);
    titles.forEach(title => {
      expect(title).toHaveClass('mobile-product-title');
    });
  });
});