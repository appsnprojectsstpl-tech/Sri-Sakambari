
import { Order } from '../lib/types';
import { Timestamp } from 'firebase/firestore';

// Mock Order to simulate payload size
const createMockOrder = (id: string): Order => ({
  id,
  customerId: `customer_${id}`,
  name: 'Test Customer',
  phone: '1234567890',
  address: '123 Test St',
  deliveryPlace: 'Home',
  items: [
    { productId: 'p1', qty: 2, priceAtOrder: 50, isCut: false, cutCharge: 0 },
    { productId: 'p2', qty: 1, priceAtOrder: 100, isCut: true, cutCharge: 10 },
  ],
  totalAmount: 200,
  paymentMode: 'ONLINE',
  orderType: 'ONE_TIME',
  area: 'Test Area',
  deliveryDate: '2023-01-01',
  deliverySlot: 'Morning',
  status: 'DELIVERED',
  createdAt: new Date(),
  deliveryPhotoUrl: 'https://example.com/photo.jpg',
});

function measurePayload() {
  const fullCollectionSize = 1000;
  const pageSize = 50;

  const fullData = Array.from({ length: fullCollectionSize }, (_, i) => createMockOrder(i.toString()));
  const pageData = Array.from({ length: pageSize }, (_, i) => createMockOrder(i.toString()));

  const fullJson = JSON.stringify(fullData);
  const pageJson = JSON.stringify(pageData);

  const fullSizeKB = fullJson.length / 1024;
  const pageSizeKB = pageJson.length / 1024;

  console.log(`Payload Size Baseline:`);
  console.log(`Full Collection (${fullCollectionSize} items): ${fullSizeKB.toFixed(2)} KB`);
  console.log(`Paginated Page (${pageSize} items): ${pageSizeKB.toFixed(2)} KB`);
  console.log(`Improvement: ${(fullSizeKB / pageSizeKB).toFixed(1)}x reduction in initial payload size`);
}

measurePayload();
