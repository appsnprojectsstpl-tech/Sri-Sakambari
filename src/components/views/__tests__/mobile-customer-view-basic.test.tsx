import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MobileCustomerView from '@/components/views/mobile-customer-view';
import { Product, CartItem } from '@/lib/types';

// Simple mock for basic functionality test
vi.mock('@/firebase', () => ({
  useCollection: () => ({
    data: [],
    loading: false
  })
}));

const mockCart: CartItem[] = [];
const mockAddToCart = vi.fn();
const mockUpdateCartQuantity = vi.fn();

describe('MobileCustomerView - Basic Functionality', () => {
  test('renders without crashing', () => {
    const { container } = render(
      <MobileCustomerView
        cart={mockCart}
        addToCart={mockAddToCart}
        updateCartQuantity={mockUpdateCartQuantity}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  test('displays search input', () => {
    render(
      <MobileCustomerView
        cart={mockCart}
        addToCart={mockAddToCart}
        updateCartQuantity={mockUpdateCartQuantity}
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    expect(searchInput).toBeInTheDocument();
  });

  test('displays category buttons', () => {
    render(
      <MobileCustomerView
        cart={mockCart}
        addToCart={mockAddToCart}
        updateCartQuantity={mockUpdateCartQuantity}
      />
    );
    
    const categories = ['All', 'Vegetables', 'Fruits', 'Dairy'];
    categories.forEach(category => {
      const button = screen.getByText(category);
      expect(button).toBeInTheDocument();
    });
  });

  test('handles empty products state', () => {
    render(
      <MobileCustomerView
        cart={mockCart}
        addToCart={mockAddToCart}
        updateCartQuantity={mockUpdateCartQuantity}
      />
    );
    
    expect(screen.getByText('No products found.')).toBeInTheDocument();
  });

  test('has proper mobile-optimized layout', () => {
    const { container } = render(
      <MobileCustomerView
        cart={mockCart}
        addToCart={mockAddToCart}
        updateCartQuantity={mockUpdateCartQuantity}
      />
    );
    
    // Check for mobile-optimized classes
    const mainContainer = container.querySelector('.min-h-screen');
    expect(mainContainer).toBeInTheDocument();
  });
});