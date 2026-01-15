# Automatic Version Management

## 🚀 Quick Release Commands

### Option 1: Interactive Version Bump
```bash
npm run version:bump
```
This will:
1. Show current version
2. Ask what type of update (bug fix/feature/major)
3. Auto-increment versions
4. Update both `build.gradle` and `package.json`

### Option 2: One-Command Release Build
```bash
npm run release:build
```
This will:
1. Run version bump (interactive)
2. Build web app
3. Sync with Capacitor
4. Ready for APK build

### Option 3: Build Release APK
```bash
npm run release:apk
```
Builds the signed release APK.

---

## 📋 Complete Release Workflow

### Step 1: Update Version
```bash
npm run version:bump
```

**You'll see**:
```
🔢 Automatic Version Manager

Current Version:
  versionCode: 1
  versionName: 1.0.0

What type of update is this?
  1. Patch (bug fixes)     - e.g., 1.0.0 → 1.0.1
  2. Minor (new features)  - e.g., 1.0.0 → 1.1.0
  3. Major (breaking changes) - e.g., 1.0.0 → 2.0.0
  4. Custom version
  5. Cancel

Enter choice (1-5):
```

**Choose**:
- `1` for bug fixes (1.0.0 → 1.0.1)
- `2` for new features (1.0.0 → 1.1.0)
- `3` for major updates (1.0.0 → 2.0.0)
- `4` to enter custom version

**Confirm**:
```
📝 New Version:
  versionCode: 1 → 2
  versionName: 1.0.0 → 1.0.1

Update versions? (y/n):
```

Type `y` and press Enter.

**Result**:
```
✅ Versions updated successfully!

📱 Updated files:
  - android/app/build.gradle
  - package.json

🚀 Next steps:
  1. npm run build
  2. npx cap sync android
  3. cd android && ./gradlew assembleRelease
```

---

### Step 2: Build & Release

**Quick way** (all in one):
```bash
npm run release:build
npm run release:apk
```

**Manual way** (step by step):
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

---

## 📊 Version Examples

### Bug Fix Release
```bash
npm run version:bump
# Choose: 1 (Patch)
# Result: 1.0.0 → 1.0.1, versionCode: 1 → 2
```

### New Feature Release
```bash
npm run version:bump
# Choose: 2 (Minor)
# Result: 1.0.1 → 1.1.0, versionCode: 2 → 3
```

### Major Update Release
```bash
npm run version:bump
# Choose: 3 (Major)
# Result: 1.1.0 → 2.0.0, versionCode: 3 → 4
```

---

## ✅ What Gets Updated Automatically

1. **android/app/build.gradle**:
   - `versionCode` (increments by 1)
   - `versionName` (based on your choice)

2. **package.json**:
   - `version` (matches versionName)

---

## 🎯 Best Practices

### When to Bump Versions

**Patch (1.0.0 → 1.0.1)**:
- Bug fixes
- Performance improvements
- Small UI tweaks

**Minor (1.0.0 → 1.1.0)**:
- New features
- New functionality
- Backward compatible changes

**Major (1.0.0 → 2.0.0)**:
- Breaking changes
- Complete redesign
- Major new features

---

## 📝 Version History Tracking

The script automatically updates both files, so you can track versions in:
- Git commits
- Release notes
- Firebase App Distribution
- Google Play Store

---

## 🔄 Rollback

If you made a mistake:

1. **Git reset** (if not committed):
```bash
git checkout android/app/build.gradle package.json
```

2. **Manual edit**:
Edit `android/app/build.gradle` and `package.json` manually

---

## 💡 Pro Tips

1. **Always run version:bump before building**
2. **Commit version changes** before building APK
3. **Tag releases** in git:
   ```bash
   git tag v1.0.1
   git push --tags
   ```

4. **Keep a CHANGELOG.md** to track what changed in each version

---

## 🚀 Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run version:bump` | Update version numbers |
| `npm run release:build` | Bump version + build web app |
| `npm run release:apk` | Build signed APK |

**Full release**:
```bash
npm run version:bump && npm run release:build && npm run release:apk
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`
