
import { products } from '@/lib/seed-data';

// This script simulates the size of the products collection payload
// to establish a baseline for the performance optimization.

console.log('Calculating payload size for products collection...');

const payload = JSON.stringify(products);
const sizeInBytes = Buffer.byteLength(payload, 'utf8');
const sizeInKB = sizeInBytes / 1024;

console.log(`Number of products in seed data: ${products.length}`);
console.log(`Estimated payload size: ${sizeInBytes} bytes (${sizeInKB.toFixed(2)} KB)`);
console.log('This is the amount of data saved per load of DeliveryView by removing the products fetch.');
