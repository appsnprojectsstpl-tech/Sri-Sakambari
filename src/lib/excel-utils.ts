import * as XLSX from 'xlsx';
import type { Order, User } from './types';

export function exportOrdersToExcel(orders: Order[], users: User[]) {
  // 1. Create a mapping of user IDs to names for quick lookup
  const userMap = new Map<string, string>();
  users.forEach(user => {
    userMap.set(user.id, user.name);
  });

  // 2. Format the data for the Excel sheet
  const dataToExport = orders.map(order => ({
    'Order ID': order.id,
    'Customer': userMap.get(order.customerId) || order.customerId,
    'Area': order.area,
    'Amount': order.totalAmount,
    'Status': order.status,
    'Delivery Partner': userMap.get(order.deliveryPartnerId || '') || 'Not Assigned',
  }));

  // 3. Create a worksheet from the formatted data
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Optional: Adjust column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Order ID
    { wch: 20 }, // Customer
    { wch: 15 }, // Area
    { wch: 10 }, // Amount
    { wch: 15 }, // Status
    { wch: 20 }, // Delivery Partner
  ];

  // 4. Create a workbook and append the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

  // 5. Write the workbook and trigger a download
  XLSX.writeFile(workbook, 'orders.xlsx');
}
