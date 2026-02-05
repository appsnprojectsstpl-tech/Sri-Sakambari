const https = require('https');
const fs = require('fs');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN;
const owner = 'appsnprojectsstpl-tech';
const repo = 'Sri-Sakambari';
const filePath = 'version.json';

if (!token) {
    console.error('Error: GITHUB_TOKEN not found in environment.');
    process.exit(1);
}

// Read local version.json and convert to Base64
const localContent = fs.readFileSync('version.json');
const contentBase64 = localContent.toString('base64');
const jsonContent = JSON.parse(localContent);

console.log(`Preparing to push version.json (v${jsonContent.latestVersion}) to GitHub...`);

// 1. Get current file SHA
const getOptions = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/contents/${filePath}`,
    method: 'GET',
    headers: {
        'User-Agent': 'NodeJS-Script',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    }
};

const req = https.request(getOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        if (res.statusCode === 404) {
            console.error('File not found on remote. Creating new not supported in this script version (needs different body).');
            process.exit(1);
        }

        if (res.statusCode !== 200) {
            console.error(`Failed to fetch info: ${res.statusCode} ${res.statusMessage}`);
            console.error(data);
            process.exit(1);
        }

        const json = JSON.parse(data);
        const sha = json.sha;
        console.log(`Found remote file. SHA: ${sha}`);

        // 2. Perform PUT to update
        const putBody = JSON.stringify({
            message: `Update version.json for v${jsonContent.latestVersion}`,
            content: contentBase64,
            sha: sha,
            branch: 'main'
        });

        const putOptions = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/contents/${filePath}`,
            method: 'PUT',
            headers: {
                'User-Agent': 'NodeJS-Script',
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(putBody)
            }
        };

        const putReq = https.request(putOptions, (putRes) => {
            let putData = '';
            putRes.on('data', (d) => putData += d);
            putRes.on('end', () => {
                if (putRes.statusCode === 200 || putRes.statusCode === 201) {
                    console.log('✅ version.json successfully updated on GitHub!');
                    console.log(`View at: https://github.com/${owner}/${repo}/blob/main/${filePath}`);
                } else {
                    console.error(`❌ Failed to update: ${putRes.statusCode}`);
                    console.error(putData);
                    process.exit(1);
                }
            });
        });

        putReq.on('error', (e) => {
            console.error('Request error:', e);
            process.exit(1);
        });

        putReq.write(putBody);
        putReq.end();
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
    process.exit(1);
});

req.end();
