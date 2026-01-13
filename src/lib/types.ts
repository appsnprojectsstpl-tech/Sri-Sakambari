
import { z } from 'genkit';
import type { Timestamp } from 'firebase/firestore';

export type Role = 'customer' | 'admin' | 'delivery' | 'guest';

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
}

export interface Product {
  id: string;
  name: string;
  name_te?: string; // Telugu name
  category: string;
  subCategory?: string; // For fruits grouping
  pricePerUnit: number;
  unit: string;
  isActive: boolean;
  imageUrl: string; // Primary image for backward compatibility
  images?: string[]; // New: Multiple images support
  imageHint: string;
  displayOrder: number;
  createdAt: Date;
  isCutVegetable?: boolean;
  cutCharge?: number;
  description?: string;
}

export interface Area {
  id: string;
  name: string;
  defaultSlots: string[];
}

export interface OrderItem {
  productId: string;
  qty: number;
  priceAtOrder: number;
  isCut: boolean;
  cutCharge: number;
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
}

export interface Subscription {
  id: string;
  customerId: string;
  planName: string;
  items: { productId: string; qty: number }[];
  frequency: 'DAILY' | 'ALTERNATE' | 'WEEKEND' | 'CUSTOM';
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
