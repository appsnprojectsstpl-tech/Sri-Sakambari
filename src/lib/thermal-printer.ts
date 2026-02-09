import { Order, Product } from "./types";
import { getProductName } from "./translations";

export const generateThermalReceipt = (order: Order, products: Product[]) => {
  // 58mm width is approx 200-220px visible, but for HTML print we can use 100% with a max-width container
  // Standard thermal printers ignore margins if configured right, but we'll force basic CSS.

  const shopName = "Sri Sakambari";
  const shopPhone = "9876543210"; // Replace with config
  const date = new Date(order.createdAt as any).toLocaleString('en-IN');

  let itemsHtml = '';
  let totalQty = 0;

  order.items.forEach(item => {
    // Attempt to find product to get Telugu name if needed, though order item usually has it.
    // The OrderItem type has name_te.
    const product = products?.find(p => p?.id === item?.productId);
    const displayName = item?.name || product?.name || 'Item';
    const displayUnit = item?.unit || product?.unit || '';
    const price = (item?.priceAtOrder ?? 0) * (item?.qty ?? 1);
    const cutCharge = item?.cutCharge || 0;
    const finalPrice = price + cutCharge;

    totalQty += item.qty;

    itemsHtml += `
      <div class="item-row">
        <div class="item-name">${displayName} ${item.isCut ? '(Cut)' : ''}</div>
        <div class="item-details">
          <span>${item.qty} x ${item.priceAtOrder}</span>
          <span>${finalPrice.toFixed(2)}</span>
        </div>
      </div>
    `;
  });

  const htmlContent = `
    <html>
      <head>
        <title>Receipt ${order.id}</title>
        <style>
          @page { margin: 0; }
          body { 
            font-family: 'Courier New', monospace; 
            width: 58mm; 
            margin: 0; 
            padding: 5px; 
            font-size: 12px;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .shop-name { font-size: 16px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .item-row { margin-bottom: 4px; }
          .item-name { font-weight: bold; }
          .item-details { display: flex; justify-content: space-between; }
          .totals { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${shopName}</div>
          <div>Ph: ${shopPhone}</div>
          <div class="divider"></div>
          <div>Order: #${order.id.slice(-4)}</div>
          <div>${date}</div>
          <div style="text-align:left; margin-top:5px;">To: ${order.name}</div>
        </div>

        <div class="items">
          ${itemsHtml}
        </div>

        <div class="divider"></div>

        <div class="totals">
          <div class="total-row">
            <span>Total Items:</span>
            <span>${totalQty}</span>
          </div>
          <div class="total-row" style="margin-top:5px; font-size:16px;">
            <span>GRAND TOTAL:</span>
            <span>Rs. ${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <div>Thank You! Visit Again</div>
        </div>
      </body>
    </html>
  `;

  try {
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) {
      console.error('Failed to open print window. Popup may be blocked.');
      alert('Please allow popups to print receipts.');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      try {
        printWindow.print();
        printWindow.close();
      } catch (error) {
        console.error('Print failed:', error);
      }
    }, 250);
  } catch (error) {
    console.error('Failed to generate receipt:', error);
    alert('Failed to print receipt. Please try again.');
  }
};
