
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, Product } from './types';
import { getProductName, type Language } from './translations';
import { Timestamp } from 'firebase/firestore';

export function generateSalesOrderPDF(order: Order, products: Product[], language: Language) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Sri Sakambari Devi Vegetable Market', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Quality and supply is our prime motive', doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Order', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });
  
  // Order Info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let orderDate: Date;
  if (order.createdAt instanceof Timestamp) {
      orderDate = order.createdAt.toDate();
  } else if (order.createdAt instanceof Date) {
      orderDate = order.createdAt;
  } else {
      orderDate = new Date(order.createdAt as any);
  }

  doc.text(`Order ID: ${order.id}`, 14, 45);
  doc.text(`Order Date: ${orderDate.toLocaleDateString()}`, 14, 50);

  // Customer Info
  const customerX = 14;
  const deliveryX = doc.internal.pageSize.getWidth() / 2 + 10;
  const infoY = 60;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', customerX, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(order.name, customerX, infoY + 5);
  doc.text(order.address.split(',').map(s => s.trim()), customerX, infoY + 10);
  doc.text(order.phone, customerX, infoY + 25);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Deliver To:', deliveryX, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(order.deliveryPlace.split(',').map(s => s.trim()), deliveryX, infoY + 5);
  doc.text(`Area: ${order.area}`, deliveryX, infoY + 20);
  doc.text(`Slot: ${order.deliverySlot}`, deliveryX, infoY + 25);

  // Items Table
  const tableData = order.items.map((item, index) => {
    const product = products.find(p => p.id === item.productId);
    const itemName = product ? `${getProductName(product, language)}${item.isCut ? ' (Cut)' : ''}` : 'Unknown Item';
    const totalItemPrice = item.qty * item.priceAtOrder + (item.cutCharge || 0) * item.qty;
    return [
      index + 1,
      itemName,
      item.qty,
      item.priceAtOrder.toFixed(2),
      item.cutCharge.toFixed(2),
      totalItemPrice.toFixed(2)
    ];
  });

  autoTable(doc, {
    startY: infoY + 35,
    head: [['#', 'Item', 'Qty', 'Price', 'Cut Charge', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [93, 61, 48] }
  });

  // Total
  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Amount: ${order.totalAmount.toFixed(2)}`, 14, finalY + 10);
  doc.setFontSize(10);
  doc.text(`Payment Mode: ${order.paymentMode}`, 14, finalY + 15);


  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Thank you for your business!', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  // Open in new tab to print/save
  doc.output('pdfobjectnewwindow');
}
