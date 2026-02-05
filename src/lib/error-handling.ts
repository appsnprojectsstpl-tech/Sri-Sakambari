/**
 * Comprehensive error handling and validation utilities for Sakambari
 * Provides robust error handling, input validation, and defensive programming techniques
 */

export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string, public rule?: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public statusCode?: number, public retryable = false) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Input validation utilities
 */
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  phone: (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{9,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  },

  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  number: (value: any, min?: number, max?: number): boolean => {
    const num = Number(value);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  },

  string: (value: any, minLength?: number, maxLength?: number): boolean => {
    if (typeof value !== 'string') return false;
    if (minLength !== undefined && value.length < minLength) return false;
    if (maxLength !== undefined && value.length > maxLength) return false;
    return true;
  },

  required: (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  },

  array: (value: any, minLength?: number, maxLength?: number): boolean => {
    if (!Array.isArray(value)) return false;
    if (minLength !== undefined && value.length < minLength) return false;
    if (maxLength !== undefined && value.length > maxLength) return false;
    return true;
  },

  date: (value: any, minDate?: Date, maxDate?: Date): boolean => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    if (minDate && date < minDate) return false;
    if (maxDate && date > maxDate) return false;
    return true;
  },

  timeSlot: (slot: string): boolean => {
    const validSlots = ['morning', 'afternoon', 'evening'];
    return validSlots.includes(slot);
  },

  frequency: (frequency: string): boolean => {
    const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
    return validFrequencies.includes(frequency);
  },

  orderStatus: (status: string): boolean => {
    const validStatuses = ['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    return validStatuses.includes(status);
  },

  paymentMethod: (method: string): boolean => {
    const validMethods = ['COD', 'UPI', 'CARD', 'WALLET'];
    return validMethods.includes(method);
  }
};

/**
 * Product validation utilities
 */
export const productValidators = {
  validateProduct: (product: any) => {
    const errors: ValidationError[] = [];

    if (!validators.required(product.name)) {
      errors.push(new ValidationError('Product name is required', 'name', product.name));
    }

    if (!validators.string(product.name, 2, 100)) {
      errors.push(new ValidationError('Product name must be between 2 and 100 characters', 'name', product.name));
    }

    if (!validators.required(product.price)) {
      errors.push(new ValidationError('Product price is required', 'price', product.price));
    }

    if (!validators.number(product.price, 0.01)) {
      errors.push(new ValidationError('Product price must be a positive number', 'price', product.price));
    }

    if (!validators.required(product.category)) {
      errors.push(new ValidationError('Product category is required', 'category', product.category));
    }

    if (!validators.string(product.category, 2, 50)) {
      errors.push(new ValidationError('Product category must be between 2 and 50 characters', 'category', product.category));
    }

    if (product.stock !== undefined && !validators.number(product.stock, 0)) {
      errors.push(new ValidationError('Product stock must be a non-negative number', 'stock', product.stock));
    }

    if (product.images && !validators.array(product.images, 0, 5)) {
      errors.push(new ValidationError('Product images must be an array with maximum 5 items', 'images', product.images));
    }

    return errors;
  },

  validateVariant: (variant: any) => {
    const errors: ValidationError[] = [];

    if (!validators.required(variant.name)) {
      errors.push(new ValidationError('Variant name is required', 'name', variant.name));
    }

    if (!validators.number(variant.priceAdjustment, -1000, 1000)) {
      errors.push(new ValidationError('Price adjustment must be between -1000 and 1000', 'priceAdjustment', variant.priceAdjustment));
    }

    return errors;
  }
};

/**
 * Order validation utilities
 */
export const orderValidators = {
  validateOrder: (order: any) => {
    const errors: ValidationError[] = [];

    if (!validators.required(order.customerId)) {
      errors.push(new ValidationError('Customer ID is required', 'customerId', order.customerId));
    }

    if (!validators.required(order.items) || !validators.array(order.items, 1)) {
      errors.push(new ValidationError('Order must have at least one item', 'items', order.items));
    }

    if (order.items) {
      order.items.forEach((item: any, index: number) => {
        if (!validators.required(item.productId)) {
          errors.push(new ValidationError(`Item ${index + 1}: Product ID is required`, `items.${index}.productId`, item.productId));
        }
        if (!validators.number(item.quantity, 1, 100)) {
          errors.push(new ValidationError(`Item ${index + 1}: Quantity must be between 1 and 100`, `items.${index}.quantity`, item.quantity));
        }
      });
    }

    if (!validators.required(order.deliveryAddress)) {
      errors.push(new ValidationError('Delivery address is required', 'deliveryAddress', order.deliveryAddress));
    }

    if (order.deliverySlot && !validators.timeSlot(order.deliverySlot)) {
      errors.push(new ValidationError('Invalid delivery slot', 'deliverySlot', order.deliverySlot));
    }

    if (order.paymentMethod && !validators.paymentMethod(order.paymentMethod)) {
      errors.push(new ValidationError('Invalid payment method', 'paymentMethod', order.paymentMethod));
    }

    return errors;
  },

  validateOrderStatusTransition: (currentStatus: string, newStatus: string) => {
    const validTransitions: Record<string, string[]> = {
      'PENDING': ['ASSIGNED', 'CANCELLED'],
      'ASSIGNED': ['OUT_FOR_DELIVERY', 'CANCELLED'],
      'OUT_FOR_DELIVERY': ['DELIVERED', 'CANCELLED'],
      'DELIVERED': [],
      'CANCELLED': []
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BusinessRuleError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        'order_status_transition'
      );
    }
  }
};

/**
 * Subscription validation utilities
 */
export const subscriptionValidators = {
  validateSubscription: (subscription: any) => {
    const errors: ValidationError[] = [];

    if (!validators.required(subscription.planName)) {
      errors.push(new ValidationError('Plan name is required', 'planName', subscription.planName));
    }

    if (!validators.required(subscription.frequency)) {
      errors.push(new ValidationError('Frequency is required', 'frequency', subscription.frequency));
    }

    if (subscription.frequency && !validators.frequency(subscription.frequency)) {
      errors.push(new ValidationError('Invalid frequency', 'frequency', subscription.frequency));
    }

    if (!validators.required(subscription.items) || !validators.array(subscription.items, 1)) {
      errors.push(new ValidationError('Subscription must have at least one item', 'items', subscription.items));
    }

    if (subscription.deliverySlot && !validators.timeSlot(subscription.deliverySlot)) {
      errors.push(new ValidationError('Invalid delivery slot', 'deliverySlot', subscription.deliverySlot));
    }

    if (subscription.nextDeliveryDate && !validators.date(subscription.nextDeliveryDate)) {
      errors.push(new ValidationError('Invalid next delivery date', 'nextDeliveryDate', subscription.nextDeliveryDate));
    }

    return errors;
  }
};

/**
 * User validation utilities
 */
export const userValidators = {
  validateUser: (user: any) => {
    const errors: ValidationError[] = [];

    if (!validators.required(user.name)) {
      errors.push(new ValidationError('User name is required', 'name', user.name));
    }

    if (!validators.string(user.name, 2, 100)) {
      errors.push(new ValidationError('User name must be between 2 and 100 characters', 'name', user.name));
    }

    if (!validators.required(user.email)) {
      errors.push(new ValidationError('User email is required', 'email', user.email));
    }

    if (!validators.email(user.email)) {
      errors.push(new ValidationError('Invalid email format', 'email', user.email));
    }

    if (!validators.required(user.phone)) {
      errors.push(new ValidationError('User phone is required', 'phone', user.phone));
    }

    if (!validators.phone(user.phone)) {
      errors.push(new ValidationError('Invalid phone format', 'phone', user.phone));
    }

    if (user.role && !['customer', 'admin', 'delivery'].includes(user.role)) {
      errors.push(new ValidationError('Invalid user role', 'role', user.role));
    }

    return errors;
  },

  validateAddress: (address: any) => {
    const errors: ValidationError[] = [];

    if (!validators.required(address.line1)) {
      errors.push(new ValidationError('Address line 1 is required', 'line1', address.line1));
    }

    if (!validators.string(address.line1, 5, 200)) {
      errors.push(new ValidationError('Address line 1 must be between 5 and 200 characters', 'line1', address.line1));
    }

    if (!validators.required(address.city)) {
      errors.push(new ValidationError('City is required', 'city', address.city));
    }

    if (!validators.required(address.pincode)) {
      errors.push(new ValidationError('Pincode is required', 'pincode', address.pincode));
    }

    if (!validators.string(address.pincode, 6, 6)) {
      errors.push(new ValidationError('Pincode must be 6 characters', 'pincode', address.pincode));
    }

    return errors;
  }
};

/**
 * Error handling utilities
 */
export const errorHandlers = {
  /**
   * Handle Firebase errors with user-friendly messages
   */
  handleFirebaseError: (error: any): string => {
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          return 'You do not have permission to perform this action';
        case 'unavailable':
          return 'Service is temporarily unavailable. Please try again later';
        case 'not-found':
          return 'The requested item was not found';
        case 'already-exists':
          return 'This item already exists';
        case 'invalid-argument':
          return 'Invalid input provided';
        case 'deadline-exceeded':
          return 'Request timed out. Please try again';
        case 'resource-exhausted':
          return 'Too many requests. Please try again later';
        default:
          return 'An error occurred. Please try again';
      }
    }
    return error.message || 'An unexpected error occurred';
  },

  /**
   * Handle network errors
   */
  handleNetworkError: (error: any): NetworkError => {
    // If it's already a NetworkError, preserve its properties
    if (error instanceof NetworkError) {
      return error;
    }
    
    if (error.response) {
      const statusCode = error.response.status;
      const retryable = [408, 429, 500, 502, 503, 504].includes(statusCode);
      return new NetworkError(
        `Network error: ${error.response.statusText}`,
        statusCode,
        retryable
      );
    } else if (error.request) {
      return new NetworkError('Network request failed', undefined, true);
    }
    return new NetworkError(error.message || 'Network error', undefined, false);
  },

  /**
   * Retry mechanism for failed operations
   */
  retryOperation: async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        const networkError = errorHandlers.handleNetworkError(error);
        if (!networkError.retryable) {
          throw lastError;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }

    throw lastError!;
  },

  /**
   * Validate and sanitize user input
   */
  sanitizeInput: (input: string): string => {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 1000); // Limit length
  },

  /**
   * Validate file uploads
   */
  validateFileUpload: (file: File, options: {
    maxSize?: number;
    allowedTypes?: string[];
    maxDimensions?: { width: number; height: number };
  } = {}): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (options.maxSize && file.size > options.maxSize) {
      errors.push(new ValidationError(
        `File size must be less than ${options.maxSize / (1024 * 1024)}MB`,
        'fileSize',
        file.size
      ));
    }

    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(new ValidationError(
        `File type must be one of: ${options.allowedTypes.join(', ')}`,
        'fileType',
        file.type
      ));
    }

    return errors;
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceMonitor = {
  /**
   * Measure function execution time
   */
  measureTime: <T extends (...args: any[]) => any>(
    fn: T,
    name: string
  ): T => {
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.finally(() => {
            const duration = performance.now() - start;
            console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
          });
        } else {
          const duration = performance.now() - start;
          console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
          return result;
        }
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`[Performance] ${name} failed after ${duration.toFixed(2)}ms`);
        throw error;
      }
    }) as T;
  },

  /**
   * Debounce function calls
   */
  debounce: <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): T & { cancel: () => void } => {
    let timeoutId: NodeJS.Timeout;

    const debouncedFn = ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      return new Promise<ReturnType<T>>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(fn(...args));
        }, delay);
      });
    }) as T;

    (debouncedFn as any).cancel = () => clearTimeout(timeoutId);

    return debouncedFn as T & { cancel: () => void };
  },

  /**
   * Throttle function calls
   */
  throttle: <T extends (...args: any[]) => any>(
    fn: T,
    limit: number
  ): T => {
    let inThrottle: boolean;
    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    }) as T;
  }
};

/**
 * Export all utilities
 */
export default {
  validators,
  productValidators,
  orderValidators,
  subscriptionValidators,
  userValidators,
  errorHandlers,
  performanceMonitor,
  ValidationError,
  BusinessRuleError,
  NetworkError
};