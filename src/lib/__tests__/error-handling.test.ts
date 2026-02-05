import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ValidationError,
  BusinessRuleError,
  NetworkError,
  validators,
  productValidators,
  orderValidators,
  subscriptionValidators,
  userValidators,
  errorHandlers,
  performanceMonitor
} from '@/lib/error-handling';

describe('Error Handling Utilities', () => {
  describe('Custom Error Classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid email', 'email', 'invalid-email');
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid email');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
    });

    it('should create BusinessRuleError with correct properties', () => {
      const error = new BusinessRuleError('Order cannot be cancelled', 'order_cancellation');
      expect(error.name).toBe('BusinessRuleError');
      expect(error.message).toBe('Order cannot be cancelled');
      expect(error.rule).toBe('order_cancellation');
    });

    it('should create NetworkError with correct properties', () => {
      const error = new NetworkError('Connection failed', 503, true);
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
    });
  });

  describe('Validators', () => {
    describe('email validator', () => {
      it('should validate correct email addresses', () => {
        expect(validators.email('user@example.com')).toBe(true);
        expect(validators.email('user.name@example.co.uk')).toBe(true);
        expect(validators.email('user+tag@example.com')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(validators.email('invalid')).toBe(false);
        expect(validators.email('user@')).toBe(false);
        expect(validators.email('@example.com')).toBe(false);
        expect(validators.email('')).toBe(false);
      });
    });

    describe('phone validator', () => {
      it('should validate correct phone numbers', () => {
        expect(validators.phone('+1234567890')).toBe(true);
        expect(validators.phone('1234567890')).toBe(true);
        expect(validators.phone('+91 98765 43210')).toBe(true);
      });

      it('should reject invalid phone numbers', () => {
        expect(validators.phone('123')).toBe(false);
        expect(validators.phone('abc123')).toBe(false);
        expect(validators.phone('')).toBe(false);
      });
    });

    describe('number validator', () => {
      it('should validate numbers with min/max constraints', () => {
        expect(validators.number(5, 1, 10)).toBe(true);
        expect(validators.number(1, 1, 10)).toBe(true);
        expect(validators.number(10, 1, 10)).toBe(true);
        expect(validators.number(0, 1, 10)).toBe(false);
        expect(validators.number(11, 1, 10)).toBe(false);
      });

      it('should reject non-numeric values', () => {
        expect(validators.number('abc')).toBe(false);
        expect(validators.number(NaN)).toBe(false);
      });
    });

    describe('required validator', () => {
      it('should validate required fields', () => {
        expect(validators.required('text')).toBe(true);
        expect(validators.required(0)).toBe(true);
        expect(validators.required(false)).toBe(true);
        expect(validators.required([1, 2, 3])).toBe(true);
      });

      it('should reject empty or null values', () => {
        expect(validators.required('')).toBe(false);
        expect(validators.required('   ')).toBe(false);
        expect(validators.required(null)).toBe(false);
        expect(validators.required(undefined)).toBe(false);
        expect(validators.required([])).toBe(false);
      });
    });

    describe('timeSlot validator', () => {
      it('should validate valid time slots', () => {
        expect(validators.timeSlot('morning')).toBe(true);
        expect(validators.timeSlot('afternoon')).toBe(true);
        expect(validators.timeSlot('evening')).toBe(true);
      });

      it('should reject invalid time slots', () => {
        expect(validators.timeSlot('night')).toBe(false);
        expect(validators.timeSlot('')).toBe(false);
      });
    });
  });

  describe('Product Validators', () => {
    it('should validate valid product', () => {
      const product = {
        name: 'Fresh Apples',
        price: 50,
        category: 'Fruits',
        stock: 100,
        images: ['image1.jpg', 'image2.jpg']
      };

      const errors = productValidators.validateProduct(product);
      expect(errors).toHaveLength(0);
    });

    it('should validate invalid product', () => {
      const product = {
        name: '',
        price: -10,
        category: '',
        stock: -5,
        images: new Array(6).fill('image.jpg')
      };

      const errors = productValidators.validateProduct(product);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'name')).toBe(true);
      expect(errors.some(e => e.field === 'price')).toBe(true);
      expect(errors.some(e => e.field === 'category')).toBe(true);
      expect(errors.some(e => e.field === 'stock')).toBe(true);
      expect(errors.some(e => e.field === 'images')).toBe(true);
    });
  });

  describe('Order Validators', () => {
    it('should validate valid order', () => {
      const order = {
        customerId: 'user-123',
        items: [{ productId: 'prod-1', quantity: 2 }],
        deliveryAddress: '123 Main St',
        deliverySlot: 'morning',
        paymentMethod: 'COD'
      };

      const errors = orderValidators.validateOrder(order);
      expect(errors).toHaveLength(0);
    });

    it('should validate order status transitions', () => {
      expect(() => {
        orderValidators.validateOrderStatusTransition('PENDING', 'ASSIGNED');
      }).not.toThrow();

      expect(() => {
        orderValidators.validateOrderStatusTransition('PENDING', 'DELIVERED');
      }).toThrow(BusinessRuleError);
    });
  });

  describe('Subscription Validators', () => {
    it('should validate valid subscription', () => {
      const subscription = {
        planName: 'Weekly Veggies',
        frequency: 'weekly',
        items: [{ productId: 'prod-1', qty: 2 }],
        deliverySlot: 'morning',
        nextDeliveryDate: '2024-01-15'
      };

      const errors = subscriptionValidators.validateSubscription(subscription);
      expect(errors).toHaveLength(0);
    });

    it('should validate invalid subscription', () => {
      const subscription = {
        planName: '',
        frequency: 'invalid',
        items: [],
        deliverySlot: 'night',
        nextDeliveryDate: 'invalid-date'
      };

      const errors = subscriptionValidators.validateSubscription(subscription);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('User Validators', () => {
    it('should validate valid user', () => {
      const user = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        role: 'customer'
      };

      const errors = userValidators.validateUser(user);
      expect(errors).toHaveLength(0);
    });

    it('should validate invalid user', () => {
      const user = {
        name: 'J',
        email: 'invalid-email',
        phone: '123',
        role: 'invalid-role'
      };

      const errors = userValidators.validateUser(user);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate address', () => {
      const address = {
        line1: '123 Main Street',
        city: 'New York',
        pincode: '123456'
      };

      const errors = userValidators.validateAddress(address);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Error Handlers', () => {
    describe('handleFirebaseError', () => {
      it('should handle Firebase permission error', () => {
        const error = { code: 'permission-denied' };
        const message = errorHandlers.handleFirebaseError(error);
        expect(message).toBe('You do not have permission to perform this action');
      });

      it('should handle Firebase unavailable error', () => {
        const error = { code: 'unavailable' };
        const message = errorHandlers.handleFirebaseError(error);
        expect(message).toBe('Service is temporarily unavailable. Please try again later');
      });

      it('should handle unknown Firebase error', () => {
        const error = { code: 'unknown-error', message: 'Something went wrong' };
        const message = errorHandlers.handleFirebaseError(error);
        expect(message).toBe('An error occurred. Please try again');
      });
    });

    describe('handleNetworkError', () => {
      it('should handle HTTP response errors', () => {
        const error = {
          response: {
            status: 503,
            statusText: 'Service Unavailable'
          }
        };
        const networkError = errorHandlers.handleNetworkError(error);
        expect(networkError.statusCode).toBe(503);
        expect(networkError.retryable).toBe(true);
      });

      it('should handle request errors', () => {
        const error = { request: {} };
        const networkError = errorHandlers.handleNetworkError(error);
        expect(networkError.message).toBe('Network request failed');
        expect(networkError.retryable).toBe(true);
      });

      it('should handle response errors with status text', () => {
        const error = { response: { status: 503, statusText: 'Service Unavailable' } };
        const networkError = errorHandlers.handleNetworkError(error);
        expect(networkError.message).toBe('Network error: Service Unavailable');
        expect(networkError.statusCode).toBe(503);
        expect(networkError.retryable).toBe(true);
      });
    });

    describe('retryOperation', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should retry failed operations', async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const operation = vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new NetworkError('Network error', 503, true);
          }
          return 'success';
        });

        const resultPromise = errorHandlers.retryOperation(operation, 3, 1000);
        
        // Advance timers to skip delays
        await vi.runAllTimersAsync();
        
        const result = await resultPromise;
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(3);
        
        vi.useRealTimers();
      });

      it('should not retry non-retryable errors', async () => {
        const operation = vi.fn().mockRejectedValue(new NetworkError('Client error', 400, false));
        
        await expect(errorHandlers.retryOperation(operation, 3, 100)).rejects.toThrow('Client error');
        expect(operation).toHaveBeenCalledTimes(1);
      });
    });

    describe('sanitizeInput', () => {
      it('should sanitize user input', () => {
        const input = '  <script>alert("xss")</script>  ';
        const sanitized = errorHandlers.sanitizeInput(input);
        expect(sanitized).toBe('scriptalert("xss")/script');
      });

      it('should limit input length', () => {
        const input = 'a'.repeat(2000);
        const sanitized = errorHandlers.sanitizeInput(input);
        expect(sanitized.length).toBe(1000);
      });
    });

    describe('validateFileUpload', () => {
      it('should validate file size', () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        Object.defineProperty(file, 'size', { value: 1024 * 1024 * 6 }); // 6MB

        const errors = errorHandlers.validateFileUpload(file, { maxSize: 1024 * 1024 * 5 });
        expect(errors.length).toBe(1);
        expect(errors[0].field).toBe('fileSize');
      });

      it('should validate file type', () => {
        const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

        const errors = errorHandlers.validateFileUpload(file, { allowedTypes: ['image/jpeg', 'image/png'] });
        expect(errors.length).toBe(1);
        expect(errors[0].field).toBe('fileType');
      });
    });
  });

  describe('Performance Monitor', () => {
    describe('measureTime', () => {
      it('should measure synchronous function execution time', () => {
        const consoleSpy = vi.spyOn(console, 'log');
        const testFn = () => {
          for (let i = 0; i < 1000; i++) {} // Simulate work
          return 'result';
        };

        const measuredFn = performanceMonitor.measureTime(testFn, 'testFunction');
        const result = measuredFn();

        expect(result).toBe('result');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Performance] testFunction took'));
        consoleSpy.mockRestore();
      });

      it('should measure asynchronous function execution time', async () => {
        const consoleSpy = vi.spyOn(console, 'log');
        const testFn = async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'async result';
        };

        const measuredFn = performanceMonitor.measureTime(testFn, 'asyncTestFunction');
        const result = await measuredFn();

        expect(result).toBe('async result');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Performance] asyncTestFunction took'));
        consoleSpy.mockRestore();
      });
    });

    describe('debounce', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should debounce function calls', async () => {
        const fn = vi.fn();
        const debouncedFn = performanceMonitor.debounce(fn, 100);

        debouncedFn('arg1');
        debouncedFn('arg2');
        debouncedFn('arg3');

        expect(fn).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(100);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('arg3');
      });

      it('should cancel debounced calls', async () => {
        const fn = vi.fn();
        const debouncedFn = performanceMonitor.debounce(fn, 100);

        debouncedFn('arg1');
        debouncedFn.cancel();

        await vi.advanceTimersByTimeAsync(100);

        expect(fn).not.toHaveBeenCalled();
      });
    });

    describe('throttle', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should throttle function calls', () => {
        const fn = vi.fn();
        const throttledFn = performanceMonitor.throttle(fn, 100);

        throttledFn('arg1');
        throttledFn('arg2');
        throttledFn('arg3');

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('arg1');

        vi.advanceTimersByTime(100);

        throttledFn('arg4');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenCalledWith('arg4');
      });
    });
  });
});