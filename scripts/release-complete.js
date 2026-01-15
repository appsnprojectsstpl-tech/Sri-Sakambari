const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('🚀 Complete Release Automation\n');
console.log('This will:');
console.log('  1. Bump version');
console.log('  2. Build web app');
console.log('  3. Sync with Capacitor');
console.log('  4. Build signed APK');
console.log('  5. Upload to Firebase Storage');
console.log('  6. Generate and upload version.json');
console.log('');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Ask for version bump type
console.log('Select version bump type:');
console.log('  1. Patch (1.0.1 → 1.0.2) - Bug fixes');
console.log('  2. Minor (1.0.1 → 1.1.0) - New features');
console.log('  3. Major (1.0.1 → 2.0.0) - Breaking changes');
console.log('  4. Skip version bump (use current version)');
console.log('');

rl.question('Enter choice (1-4): ', (choice) => {
    let bumpType = '';

    switch (choice.trim()) {
        case '1':
            bumpType = 'patch';
            break;
        case '2':
            bumpType = 'minor';
            break;
        case '3':
            bumpType = 'major';
            break;
        case '4':
            bumpType = 'skip';
            break;
        default:
            console.log('❌ Invalid choice. Exiting.');
            rl.close();
            process.exit(1);
    }

    rl.question('\n📝 Enter release notes: ', (releaseNotes) => {
        rl.question('⚠️  Force update? (y/N): ', (forceUpdateInput) => {
            rl.close();

            const forceUpdate = forceUpdateInput.toLowerCase() === 'y';

            console.log('\n🔨 Starting build process...\n');

            try {
                // Step 1: Bump version (if not skipped)
                if (bumpType !== 'skip') {
                    console.log(`📈 Step 1/5: Bumping version (${bumpType})...`);
                    execSync(`node scripts/version-bump.js ${bumpType}`, { stdio: 'inherit' });
                    console.log('✅ Version bumped\n');
                } else {
                    console.log('⏭️  Step 1/5: Skipping version bump\n');
                }

                // Step 2: Build web app
                console.log('🌐 Step 2/5: Building web app...');
                execSync('npm run build', { stdio: 'inherit' });
                console.log('✅ Web app built\n');

                // Step 3: Sync with Capacitor
                console.log('🔄 Step 3/5: Syncing with Capacitor...');
                execSync('npx cap sync android', { stdio: 'inherit' });
                console.log('✅ Capacitor synced\n');

                // Step 4: Build APK
                console.log('📱 Step 4/5: Building signed APK...');
                execSync('cd android && gradlew.bat assembleRelease', { stdio: 'inherit', shell: true });
                console.log('✅ APK built\n');

                // Step 5: Upload to Firebase
                console.log('☁️  Step 5/5: Uploading to Firebase Storage...');

                // Read current version
                const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
                const version = packageJson.version;

                const buildGradle = fs.readFileSync('android/app/build.gradle', 'utf8');
                const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
                const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : 1;

                const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk', 'release', `app-release-${version}.apk`);
                const storagePath = `apk-releases/app-release-${version}.apk`;
                const projectId = 'studio-1474537647-7252f';

                // Upload APK
                execSync(
                    `npx firebase-tools storage:upload "${apkPath}" "${storagePath}" --project ${projectId}`,
                    { stdio: 'inherit' }
                );

                // Generate download URL
                const encodedPath = encodeURIComponent(storagePath);
                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/${encodedPath}?alt=media`;

                // Create version.json
                const defaultNotes = releaseNotes.trim() || `• Version ${version} release\n• Bug fixes and improvements`;
                const versionJson = {
                    latestVersion: version,
                    versionCode: versionCode,
                    downloadUrl: downloadUrl,
                    releaseNotes: defaultNotes,
                    forceUpdate: forceUpdate
                };

                fs.writeFileSync('version.json', JSON.stringify(versionJson, null, 2));

                // Upload version.json
                execSync(
                    `npx firebase-tools storage:upload version.json version.json --project ${projectId}`,
                    { stdio: 'inherit' }
                );

                console.log('\n✅ Upload complete!\n');

                // Success summary
                console.log('═══════════════════════════════════════');
                console.log('🎉 RELEASE COMPLETE!');
                console.log('═══════════════════════════════════════');
                console.log(`📦 Version: ${version} (code: ${versionCode})`);
                console.log(`📱 APK: ${storagePath}`);
                console.log(`🔗 Download: ${downloadUrl}`);
                console.log(`⚠️  Force Update: ${forceUpdate ? 'Yes' : 'No'}`);
                console.log('═══════════════════════════════════════');
                console.log('');
                console.log('✅ Users will now see the update notification!');
                console.log('');

            } catch (error) {
                console.error('\n❌ Release failed:', error.message);
                console.log('\n💡 Troubleshooting:');
                console.log('   1. Make sure Firebase CLI is installed: npm install -g firebase-tools');
                console.log('   2. Make sure you are logged in: firebase login');
                console.log('   3. Check that all dependencies are installed: npm install');
                process.exit(1);
            }
        });
    });
});
