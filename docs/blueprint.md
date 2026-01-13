# **App Name**: Sri Sanjivi Veg Market

## Core Features:

- User Authentication: Implement phone and email OTP login using Firebase Authentication. The database saves all users' data to Firestore, as well as which user roles and addresses.
- Role-Based Access Control: Implement role-based access control (customer, admin, delivery) using Firebase Security Rules to restrict access to specific functionalities and data.  User roles are stored in Firestore and enforced on the UI.
- Product Catalog: Display products grouped by category. Customers can only see active products.  Admin can CRUD (create, read, update, delete) products including uploading images to Firebase Storage.
- Shopping Cart and Checkout: Implement a shopping cart for customers to add products and a checkout process with address and delivery slot selection.  Ensure product prices are stored at the time of order to prevent price changes.
- Order Management: Customers can view their order history. Admin can view and filter orders by date, status, and area, and can generate delivery sheets.
- Subscription Management: Customers can create, edit, and pause subscriptions. Automatic order creation for subscriptions is handled by Cloud Functions. Admin can oversee the status of active and paused subscriptions.
- Delivery Runs Management: Cloud Functions automatically group orders into delivery runs. Delivery staff can view today's delivery runs, expand orders, and mark delivery status using the delivery staff app.
- Automatic Order Creation Tool: This is a scheduled Cloud Function. It creates an order every day based on subscriptions from each active user. The tool considers the indicated platform frequency of the subscription to decide when or whether to add the item to the order.
- Notifications: On order status change, generate WhatsApp/SMS text messages and store notifications for manual sending.

## Style Guidelines:

- Primary color: Fresh green (#74B72E) to evoke nature and health.
- Background color: Very light desaturated green (#E2EBD9).
- Accent color: Earthy orange (#C96A2F), for highlights and calls to action, a hue that will work with green.
- Headline font: 'Poppins', a contemporary sans-serif for headings and short text.
- Body font: 'PT Sans', a modern humanist sans-serif for the body of the text.
- Use simple, line-based icons representing each vegetable and grocery item.
- Clean, grid-based layout with clear sections for products, cart, and checkout.
- Subtle animations for product loading and cart updates.