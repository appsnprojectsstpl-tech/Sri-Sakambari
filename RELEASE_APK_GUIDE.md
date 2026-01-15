# Release APK Build Guide - Sri Sakambari

## 🎯 Quick Start

Follow these steps to build a signed release APK:

---

## Step 1: Generate Keystore (One-Time Setup)

Run this command in your project root:

```bash
keytool -genkey -v -keystore sakambari-release.keystore -alias sakambari -keyalg RSA -keysize 2048 -validity 10000
```

**You'll be prompted for**:
- Keystore password: (choose strong password - **SAVE THIS!**)
- Key password: (can be same as keystore password)
- Name: Your name
- Organization: Sri Sakambari
- City, State, Country: Your location

**CRITICAL**: 
- ✅ Save the password in a secure place
- ✅ Keep the keystore file safe (backup it!)
- ❌ NEVER commit keystore to git
- ❌ NEVER share the password

The keystore file will be created at: `e:/Sakambari/sakambari-release.keystore`

---

## Step 2: Configure Signing (Already Done!)

The `android/app/build.gradle` has been configured with signing setup.

**You need to create**: `android/keystore.properties`

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=sakambari
storeFile=../../sakambari-release.keystore
```

**Replace**:
- `YOUR_KEYSTORE_PASSWORD` with your keystore password
- `YOUR_KEY_PASSWORD` with your key password

---

## Step 3: Build Release APK

```bash
# 1. Build web app
npm run build

# 2. Sync with Capacitor
npx cap sync android

# 3. Build release APK
cd android
./gradlew assembleRelease
```

**APK Location**: `android/app/build/outputs/apk/release/app-release.apk`

---

## Step 4: Install & Test

```bash
# Install on connected device
adb install android/app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to your phone and install manually.

---

## 🔄 APK Updates - Firebase App Distribution

### Setup (One-Time)

1. **Enable App Distribution** in Firebase Console:
   - Go to https://console.firebase.google.com/project/studio-1474537647-7252f
   - Click "App Distribution" in left menu
   - Click "Get Started"

2. **Install Firebase CLI** (if not already):
```bash
npm install -g firebase-tools
```

### Distribute Updates

Every time you build a new version:

```bash
# Upload APK to Firebase
firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app 1:354300085126:android:YOUR_ANDROID_APP_ID \
  --groups testers \
  --release-notes "Version 1.0.1 - Bug fixes and improvements"
```

**Users will**:
- Get notification about new version
- Download and install update
- Automatic version tracking

---

## 📊 Version Management

### Before Each Release:

1. **Update version in `package.json`**:
```json
{
  "version": "1.0.1"
}
```

2. **Update version in `android/app/build.gradle`**:
```gradle
defaultConfig {
    versionCode 2  // Increment by 1
    versionName "1.0.1"
}
```

3. **Build and distribute**

---

## 🚨 Troubleshooting

### "Keystore not found"
- Make sure `sakambari-release.keystore` is in project root
- Check path in `keystore.properties`

### "Wrong password"
- Double-check password in `keystore.properties`
- Make sure no extra spaces

### "APK not installing"
- Uninstall old debug version first
- Enable "Install from Unknown Sources"

---

## ✅ Checklist

- [ ] Generate keystore
- [ ] Create keystore.properties
- [ ] Update version numbers
- [ ] Build release APK
- [ ] Test on device
- [ ] Upload to Firebase App Distribution
- [ ] Share with testers

**App Name**: ✅ Sri Sakambari (updated)  
**Ready to build**: ✅ Yes
