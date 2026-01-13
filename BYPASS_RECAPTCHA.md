# How to Bypass Recaptcha (Test Numbers)

The "Select squares..." popup is Google's security check. It appears frequently on `localhost` or for real numbers to prevent SMS spam.

**To login WITHOUT Recaptcha and WITHOUT sending real SMS:**

1.  **Go to Firebase Console** -> **Authentication** -> **Sign-in method**.
2.  Click **Phone**.
3.  Scroll down to **"Phone numbers for testing"**.
4.  Add a number:
    *   **Phone number**: `+91 9999999999` (or any dummy number)
    *   **Verification code**: `123456`
5.  **Save**.

## How to use in App:
1.  Enter `9999999999` in the login screen.
2.  Click "Get OTP".
    *   **Recaptcha will be skipped automatically**, or solve it once and it remembers you.
    *   No real SMS is sent.
3.  Enter `123456` as the OTP.

This is the standard way to develop without getting blocked by Captchas.
