
import { z } from 'genkit';
import type { Timestamp } from 'firebase/firestore';

export type Role = 'customer' | 'admin' | 'restricted_admin' | 'delivery' | 'guest';

export interface AdminPermissions {
  canAccessDashboard: boolean;
  canAccessInventory: boolean;
  canAccessProducts: boolean;
  canAccessOrders: boolean;
  canAccessSubscriptions: boolean;
  canAccessUsers: boolean;
  canAccessCoupons: boolean;
  canAccessWhatsApp: boolean;
}

export interface Address {
  id: string;
  label: string; // e.g., "Home", "Work", "Parents"
  line1: string;
  line2?: string;
  area: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface User {
  id: string; // This will be the Firebase Auth UID
  name: string;
  phone: string;
  email: string;
  role: Role;
  addresses: Address[]; // New array for multiple addresses
  // Legacy fields kept for backward compatibility, will sync with default address
  area: string;
  address: string;
  pincode: string;
  landmark?: string;
  createdAt: Date;
  preference?: 'vegetables' | 'fruits' | 'both';
  notifications?: NotificationPreferences;
}

export interface ProductVariant {
  id: string;
  unit: string;
  price: number;
  stock: number;
  image?: string; // New: Specific image for this variant
}

export interface Product {
  id: string;
  name: string;
  name_te?: string; // Telugu name
  category: string;
  subCategory?: string; // For fruits grouping
  pricePerUnit: number; // Base price
  unit: string; // Base unit
  isActive: boolean;
  imageUrl: string; // Primary image for backward compatibility
  images?: string[]; // New: Multiple images support
  imageHint: string;
  displayOrder: number;
  createdAt: Date;
  isCutVegetable?: boolean;
  cutCharge: number;
  stockQuantity: number;
  lastRestocked?: Date | Timestamp;
  trackInventory: boolean;
  variants?: ProductVariant[]; // New: Support for multiple weight/price variants
  costPrice?: number; // Internal Cost
  originalPrice?: number; // MRP (for strike-through)
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  isSeasonal?: boolean; // New: Flag for seasonal products
  isFeatured?: boolean; // New: Flag for featured/best-seller products
  manageStockBy?: 'count' | 'weight' | 'volume'; // New: Master Stock Logic
}

export interface Area {
  id: string;
  name: string;
  defaultSlots: string[];
  pincode?: string; // Pincode for the area
}

export interface OrderItem {
  productId: string;
  qty: number;
  priceAtOrder: number;
  isCut: boolean;
  cutCharge: number;
  // Denormalized fields for performance
  name?: string;
  name_te?: string;
  unit?: string;
  variantId?: string; // New: Selected variant ID
  variantUnit?: string; // New: Selected variant unit
  selectedVariant?: ProductVariant | null; // For UI display if full object is saved
}

export interface Order {
  id: string;
  customerId: string;
  name: string; // From sales order form
  phone: string; // From sales order form
  address: string; // From sales order form
  deliveryPlace: string; // From sales order form
  deliveryPartnerId?: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMode: 'COD' | 'ONLINE';
  orderType: 'ONE_TIME' | 'SUBSCRIPTION_GENERATED';
  area: string;
  deliveryDate: string;
  deliverySlot: string;
  status: 'PENDING' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  createdAt: Date | Timestamp;
  deliveryPhotoUrl?: string;
  agreedToTerms?: boolean;
  subscriptionId?: string;
  pincode?: string;
  landmark?: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planName: string;
  items: { productId: string; qty: number }[];
  frequency: 'DAILY' | 'ALTERNATE' | 'WEEKEND' | 'CUSTOM';
  customDays?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  area: string;
  deliverySlot: string;
  startDate: Date;
  endDate?: Date | null;
  isActive: boolean;
  notes?: string;
}

export interface DeliveryRun {
  id: string;
  deliveryDate: string;
  area: string;
  slot: string;
  orderIds: string[];
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface CartItem {
  product: Product;
  quantity: number;
  isCut: boolean;
  selectedVariant?: ProductVariant | null; // New: Selected variant
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface OrderCounter {
  lastId: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'upi';
  last4?: string;
  upiId?: string;
  isDefault: boolean;
  brand?: string;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  deliveryAlerts: boolean;
  emailNotifications: boolean;
}

export interface Coupon {
  id: string; // Document ID (usually same as code)
  code: string; // Uppercase, unique
  type: 'PERCENTAGE' | 'FLAT';
  value: number; // e.g., 20 for 20% or 20 flats
  minOrderValue: number;
  maxDiscount?: number; // Only for PERCENTAGE
  usageLimit?: number; // Global limit
  usedCount: number;
  startDate: string; // ISO
  expiryDate: string; // ISO
  isActive: boolean;
  description?: string;
  createdAt?: any;
}

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  type: 'ADD' | 'REMOVE' | 'SET' | 'SALE' | 'CANCEL';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  orderId?: string;
  timestamp: Date;
  userId: string;
  userName?: string;
  variantId?: string;
}

// Genkit Flow Types
export const TranslateProductInputSchema = z.object({
  productName: z.string().describe('The name of the product in English.'),
});
export type TranslateProductInput = z.infer<typeof TranslateProductInputSchema>;

export const TranslateProductOutputSchema = z.object({
  translatedName: z.string().describe('The translated product name in Telugu.'),
});
export type TranslateProductOutput = z.infer<typeof TranslateProductOutputSchema>;


export const AutomaticOrderCreationInputSchema = z.object({});
export type AutomaticOrderCreationInput = z.infer<typeof AutomaticOrderCreationInputSchema>;

export const AutomaticOrderCreationOutputSchema = z.object({
  ordersCreated: z.number().describe('The number of orders created during the process.'),
});
export type AutomaticOrderCreationOutput = z.infer<typeof AutomaticOrderCreationOutputSchema>;


export const GenerateOrderIdInputSchema = z.object({});
export type GenerateOrderIdInput = z.infer<typeof GenerateOrderIdInputSchema>;

export const GenerateOrderIdOutputSchema = z.object({
  orderId: z.string().describe('The newly generated, formatted order ID.'),
});
export type GenerateOrderIdOutput = z.infer<typeof GenerateOrderIdOutputSchema>;

export interface Category {
  id: string; // Document ID
  name: string; // Display Name
  icon: string; // Emoji
  color: string; // Tailwind class string
  displayOrder: number;
  isActive: boolean;
  slug?: string;
  description?: string; // Optional description
  createdAt?: any;
}
