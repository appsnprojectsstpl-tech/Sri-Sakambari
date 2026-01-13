# How to Activate Firebase Billing (Blaze Plan)

To fully utilize Firebase features (like increased SMS limits, Cloud Functions, or removal of "Billing not enabled" errors), you need to upgrade your project to the **Blaze (Pay as you go)** plan.

> **Note:** This does not cost money immediately. It just enables a payment method. You still get a generous free tier.

## Steps

1.  **Go to Firebase Console**
    *   Open [https://console.firebase.google.com/](https://console.firebase.google.com/)
    *   Select your project: `studio-1474537647-7252f` (or similar).

2.  **Open Usage and Billing**
    *   Click the **Gear Icon** (Settings) next to "Project Overview" in the left sidebar.
    *   Select **Usage and Billing**.
    *   Click the **Details & Settings** tab (or "Modify Plan").

3.  **Upgrade to Blaze**
    *   You will see your current plan is "Spark" (Free).
    *   Click **Modify Plan** or **Upgrade**.
    *   Select the **Blaze (Pay as you go)** plan.

4.  **Add Payment Method**
    *   Follow the Google Cloud prompts to add a Credit/Debit card.
    *   **India Specific:** You may need to verify your card with a small transaction (₹2) which is refunded.

5.  **Set Budget Alert (Recommended)**
    *   Set a budget alert (e.g., ₹500 or $10) so you are notified if usage accidentally spikes.

## Why is this needed?
*   **SMS Authentication:** Essential for verifying real phone numbers beyond the small daily free test limit.
*   **Cloud Storage/Functions:** Some advanced features require a billing account attached.
*   **Production Deployment:** Ensures your app doesn't stop working if it gets popular suddenly.

## Want Online Payments (Razorpay/PhonePe)?
If you actually meant you want to **accept payments from customers** (UPI, Cards) in the app:
*   We need to sign up for a **Razorpay** or **PhonePe** merchant account.
*   I can then write the code to integrate it.
*   *Current app status:* Only 'Cash on Delivery' (COD) is enabled in the code.
