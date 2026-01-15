const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing Release Files...\n');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Read version code from build.gradle
const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : 1;

console.log(`📦 Version: ${version} (code: ${versionCode})`);

// Paths
const apkPath = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', `app-release-${version}.apk`);
const projectId = 'studio-1474537647-7252f';

// Check if APK exists
if (!fs.existsSync(apkPath)) {
    console.error(`\n❌ APK not found: ${apkPath}`);
    console.log('💡 Run "npm run release:apk" first to build the APK');
    process.exit(1);
}

const apkSize = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2);
console.log(`📱 APK found: ${apkSize} MB\n`);

// Prompt for release notes
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('📝 Enter release notes (or press Enter for default): ', (releaseNotes) => {
    rl.question('⚠️  Force update? (y/N): ', (forceUpdateInput) => {
        rl.close();

        const defaultNotes = releaseNotes.trim() || `• Version ${version} release\n• Bug fixes and improvements`;
        const forceUpdate = forceUpdateInput.toLowerCase() === 'y';

        // Generate download URL (user will need to replace token)
        const storagePath = `apk-releases/app-release-${version}.apk`;
        const encodedPath = encodeURIComponent(storagePath);
        const downloadUrlTemplate = `https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/${encodedPath}?alt=media`;

        // Create version.json
        const versionJson = {
            latestVersion: version,
            versionCode: versionCode,
            downloadUrl: downloadUrlTemplate,
            releaseNotes: defaultNotes,
            forceUpdate: forceUpdate
        };

        const versionJsonPath = path.join(__dirname, '..', 'version.json');
        fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
        console.log('\n✅ version.json created!');
        console.log(JSON.stringify(versionJson, null, 2));
        console.log('');

        // Success summary with instructions
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 MANUAL UPLOAD STEPS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('🔗 Firebase Storage Console:');
        console.log(`   https://console.firebase.google.com/project/${projectId}/storage`);
        console.log('');
        console.log('📤 Step 1: Upload APK');
        console.log('   1. Click "Upload file"');
        console.log(`   2. Select: ${apkPath}`);
        console.log(`   3. Upload to folder: apk-releases/`);
        console.log(`   4. File will be named: app-release-${version}.apk`);
        console.log('');
        console.log('📤 Step 2: Upload version.json');
        console.log('   1. Click "Upload file"');
        console.log(`   2. Select: ${versionJsonPath}`);
        console.log('   3. Upload to ROOT (not in any folder)');
        console.log('');
        console.log('✅ Step 3: Verify');
        console.log('   Open in browser:');
        console.log(`   https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/version.json?alt=media`);
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('📁 Files Ready:');
        console.log(`   APK: ${apkPath}`);
        console.log(`   version.json: ${versionJsonPath}`);
        console.log('');
        console.log('💡 TIP: Keep the Firebase Storage console open in your browser');
        console.log('');
    });
});
