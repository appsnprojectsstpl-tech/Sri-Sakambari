const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// CONFIGURATION
const GITHUB_USER = 'appsnprojectsstpl-tech';
const GITHUB_REPO = 'Sri-Sakambari';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''; // Best to set as env var, or verify file

console.log('🚀 Starting GitHub Release Automation...\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const apkName = `Sri-Sakambari-v${version}.apk`;
const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk', 'release', apkName);

// 1. Check Prerequisites
function checkPrerequisites() {
    if (!fs.existsSync(apkPath)) {
        console.error(`❌ APK not found at: ${apkPath}`);
        console.log('💡 Run "npm run release:apk" first.');
        process.exit(1);
    }
    // We will ask for token/repo if not configured
}

async function createRelease(token, user, repo, notes) {
    console.log('☁️  Creating GitHub Release...');

    const tagName = `v${version}`;
    const releaseData = {
        tag_name: tagName,
        target_commitish: 'main', // or master
        name: `Version ${version}`,
        body: notes,
        draft: false,
        prerelease: false,
        generate_release_notes: true
    };

    const response = await fetch(`https://api.github.com/repos/${user}/${repo}/releases`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Release-Script'
        },
        body: JSON.stringify(releaseData)
    });

    if (!response.ok) {
        throw new Error(`Failed to create release: ${response.statusText} - ${await response.text()}`);
    }

    const release = await response.json();
    console.log(`✅ Release created: ${release.html_url}`);
    return release;
}

async function uploadAsset(token, uploadUrl, filePath, fileName) {
    console.log(`📤 Uploading ${fileName}...`);
    const stats = fs.statSync(filePath);
    const fileStream = fs.readFileSync(filePath);

    // upload_url comes like https://uploads.github.com/repos/hubot/singularity/releases/1/assets{?name,label}
    const cleanUrl = uploadUrl.replace('{?name,label}', `?name=${fileName}`);

    const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Length': stats.size,
            'User-Agent': 'Release-Script'
        },
        body: fileStream
    });

    if (!response.ok) {
        throw new Error(`Failed to upload asset: ${response.statusText}`);
    }

    const asset = await response.json();
    console.log(`✅ Upload success: ${asset.browser_download_url}`);
    return asset.browser_download_url;
}

// Main Flow
// 94. Main Flow
(async () => {
    require('dotenv').config(); // Load environment variables
    checkPrerequisites();

    console.log(`📦 Prepare release for v${version}`);

    // Use Env Vars or Defaults if available to skip prompts
    let token = process.env.GITHUB_TOKEN;
    let user = process.env.GITHUB_USER || GITHUB_USER;
    let repo = process.env.GITHUB_REPO || GITHUB_REPO;
    let notes = `• Version ${version} Release (Automated)`;

    // Simple helper to ask only if missing
    const ask = (query) => new Promise(resolve => rl.question(query, resolve));

    try {
        if (!token) {
            token = await ask('🔑 Enter GitHub Personal Access Token (classic): ');
            if (!token.trim()) { console.error('Token required'); process.exit(1); }
        } else {
            console.log('🔑 Token loaded from environment.');
        }

        if (!user) user = await ask('👤 Enter GitHub Username: ');
        if (!repo) repo = await ask('📂 Enter GitHub Repo Name: ');

        // Always ask for notes unless auto flag? For now, we'll default if not interactive, but here we can just auto-fill
        // But the user might want custom notes.
        // Let's check process.argv for --auto flag passed from release-complete.js?
        // release-complete.js doesn't pass flags to this script yet.
        // But for "Zero Touch", let's just use a default note or ask with a timeout?
        // Better: Just use default notes for now to achieve the goal.

        console.log(`📝 Notes: ${notes}`);

        rl.close();

        // 1. Create Release
        const release = await createRelease(token, user, repo, notes);

        // 2. Upload APK
        const downloadUrl = await uploadAsset(token, release.upload_url, apkPath, apkName);

        // 3. Update version.json
        const buildGradle = fs.readFileSync('android/app/build.gradle', 'utf8');
        const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
        const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : 1;

        const versionJson = {
            latestVersion: version,
            versionCode: versionCode,
            downloadUrl: downloadUrl,
            releaseNotes: notes,
            forceUpdate: false
        };

        fs.writeFileSync('version.json', JSON.stringify(versionJson, null, 2));
        console.log('\n✅ version.json updated locally.');

        console.log('\n⚠️  IMPORTANT STEPS TO FINISH:');
        console.log('1. Commit and push version.json to GitHub:');
        console.log('   git add version.json');
        console.log(`   git commit -m "Update version.json for v${version}"`);
        console.log('   git push origin main');
        console.log('\n🎉 Once pushed, users will detect the update!');

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
})();
