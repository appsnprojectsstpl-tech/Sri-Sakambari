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

// Check for auto flag
const isAuto = process.argv.includes('--auto');

if (isAuto) {
    console.log('🤖 AUTO MODE ENABLED: Patch bump, default notes, no force update.');
    runRelease('patch', 'Auto-generated release', false);
} else {
    // Interactive Mode
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
            case '1': bumpType = 'patch'; break;
            case '2': bumpType = 'minor'; break;
            case '3': bumpType = 'major'; break;
            case '4': bumpType = 'skip'; break;
            default:
                console.log('❌ Invalid choice. Exiting.');
                rl.close();
                process.exit(1);
        }

        rl.question('\n📝 Enter release notes: ', (releaseNotes) => {
            rl.question('⚠️  Force update? (y/N): ', (forceUpdateInput) => {
                rl.close();
                const forceUpdate = forceUpdateInput.toLowerCase() === 'y';
                runRelease(bumpType, releaseNotes, forceUpdate);
            });
        });
    });
}

function runRelease(bumpType, releaseNotes, forceUpdate) {
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

        // Step 5: Upload to GitHub Releases
        console.log('☁️  Step 5/5: Initiating GitHub Release...');

        // Executes the verified GitHub automation script
        execSync('node scripts/publish-github.js', { stdio: 'inherit' });
    } catch (error) {
        console.error('\n❌ Release failed:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Make sure Firebase CLI is installed: npm install -g firebase-tools');
        console.log('   2. Make sure you are logged in: firebase login');
        console.log('   3. Check that all dependencies are installed: npm install');
        process.exit(1);
    }
}
