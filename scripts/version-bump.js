const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function getCurrentVersions() {
    const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

    const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
    const versionNameMatch = buildGradle.match(/versionName\s+"([^"]+)"/);

    const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : 1;
    const versionName = versionNameMatch ? versionNameMatch[1] : '1.0.0';

    return { versionCode, versionName };
}

function parseVersion(versionName) {
    const parts = versionName.split('.');
    return {
        major: parseInt(parts[0]) || 1,
        minor: parseInt(parts[1]) || 0,
        patch: parseInt(parts[2]) || 0
    };
}

function incrementVersion(versionName, type) {
    const version = parseVersion(versionName);

    switch (type) {
        case 'patch':
            version.patch++;
            break;
        case 'minor':
            version.minor++;
            version.patch = 0;
            break;
        case 'major':
            version.major++;
            version.minor = 0;
            version.patch = 0;
            break;
    }

    return `${version.major}.${version.minor}.${version.patch}`;
}

function updateBuildGradle(newVersionCode, newVersionName) {
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

    buildGradle = buildGradle.replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
    );

    buildGradle = buildGradle.replace(
        /versionName\s+"[^"]+"/,
        `versionName "${newVersionName}"`
    );

    fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');
}

function updatePackageJson(newVersionName) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = newVersionName;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
}

async function main() {
    console.log('\n🔢 Automatic Version Manager\n');

    const current = getCurrentVersions();
    console.log(`Current Version:`);
    console.log(`  versionCode: ${current.versionCode}`);
    console.log(`  versionName: ${current.versionName}\n`);

    console.log('What type of update is this?');
    console.log('  1. Patch (bug fixes)     - e.g., 1.0.0 → 1.0.1');
    console.log('  2. Minor (new features)  - e.g., 1.0.0 → 1.1.0');
    console.log('  3. Major (breaking changes) - e.g., 1.0.0 → 2.0.0');
    console.log('  4. Custom version');
    console.log('  5. Cancel\n');

    const choice = await question('Enter choice (1-5): ');

    let newVersionCode = current.versionCode + 1;
    let newVersionName;

    switch (choice.trim()) {
        case '1':
            newVersionName = incrementVersion(current.versionName, 'patch');
            break;
        case '2':
            newVersionName = incrementVersion(current.versionName, 'minor');
            break;
        case '3':
            newVersionName = incrementVersion(current.versionName, 'major');
            break;
        case '4':
            newVersionName = await question('Enter new version name (e.g., 1.2.3): ');
            break;
        case '5':
            console.log('Cancelled.');
            rl.close();
            return;
        default:
            console.log('Invalid choice. Cancelled.');
            rl.close();
            return;
    }

    console.log(`\n📝 New Version:`);
    console.log(`  versionCode: ${current.versionCode} → ${newVersionCode}`);
    console.log(`  versionName: ${current.versionName} → ${newVersionName}\n`);

    const confirm = await question('Update versions? (y/n): ');

    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
        updateBuildGradle(newVersionCode, newVersionName);
        updatePackageJson(newVersionName);

        console.log('\n✅ Versions updated successfully!\n');
        console.log('📱 Updated files:');
        console.log('  - android/app/build.gradle');
        console.log('  - package.json\n');
        console.log('🚀 Next steps:');
        console.log('  1. npm run build');
        console.log('  2. npx cap sync android');
        console.log('  3. cd android && ./gradlew assembleRelease\n');
    } else {
        console.log('Cancelled.');
    }

    rl.close();
}

main().catch(error => {
    console.error('Error:', error);
    rl.close();
    process.exit(1);
});
