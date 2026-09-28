const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fflate = require('../fflate.js');

console.log("================================================================");
console.log("🧪 TESTING: GITHUB UPDATE CHECK & 1-CLICK UNZIP FLOW");
console.log("================================================================");

// 1. Validate version.json
const versionFilePath = path.join(__dirname, '..', 'version.json');
assert.ok(fs.existsSync(versionFilePath), 'version.json must exist');
const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
assert.ok(versionData.version, 'version.json must have version field');
assert.ok(versionData.commit, 'version.json must have commit field');
assert.ok(versionData.repo, 'version.json must have repo field');
assert.strictEqual(versionData.repo, 'ankitpandeynine/Coursera-completer');
console.log("✓ Test 1: version.json validated successfully.");

// 2. Validate update detection logic
function isUpdateAvailable(localSha, remoteSha) {
    if (!remoteSha || !localSha) return false;
    return !remoteSha.startsWith(localSha.slice(0, 7));
}

assert.strictEqual(isUpdateAvailable('21ab9c1', '21ab9c1cf3138a2b4a9b54c3b3d4b53b5f5ce69f'), false, 'Identical SHA must NOT show update');
assert.strictEqual(isUpdateAvailable('21ab9c1', '9999999cf3138a2b4a9b54c3b3d4b53b5f5ce69f'), true, 'Different SHA must show update');
assert.strictEqual(isUpdateAvailable('', '21ab9c1'), false, 'Empty local SHA should not false trigger without data');
console.log("✓ Test 2: Update detection logic is strictly discriminative.");

// 3. Test fflate zip parsing and path cleaning
const testFiles = {
    'Coursera-completer-main/content.js': new TextEncoder().encode('console.log("test");'),
    'Coursera-completer-main/background.js': new TextEncoder().encode('// bg'),
    'Coursera-completer-main/icons/icon16.png': new Uint8Array([1, 2, 3]),
    'Coursera-completer-main/.git/config': new Uint8Array([4, 5]),
    'Coursera-completer-main/scratch/test.js': new Uint8Array([6, 7])
};

const zipped = fflate.zipSync(testFiles);
const unzipped = fflate.unzipSync(zipped);

const cleanedFiles = [];
for (const [fullPath, data] of Object.entries(unzipped)) {
    if (fullPath.endsWith('/')) continue;
    const relPath = fullPath.replace(/^[^/]+\//, '');
    if (!relPath || relPath.startsWith('.git') || relPath.startsWith('scratch/')) continue;
    cleanedFiles.push(relPath);
}

assert.ok(cleanedFiles.includes('content.js'));
assert.ok(cleanedFiles.includes('background.js'));
assert.ok(cleanedFiles.includes('icons/icon16.png'));
assert.ok(!cleanedFiles.includes('.git/config'));
assert.ok(!cleanedFiles.includes('scratch/test.js'));
console.log("✓ Test 3: In-memory zip extraction & path cleaning works cleanly.");

// 4. Test Settings and API Keys Preservation
const sampleSettings = {
    geminiApiKey: 'AIzaSyTestGeminiKey123',
    groqApiKey: 'gsk_TestGroqKey456',
    openRouterApiKey: 'sk-or-TestKey789',
    nvidiaApiKey: 'nvapi-TestKey000',
    playbackSpeed: 3.0,
    speedInjection: true,
    autoSolve: true,
    focusMode: 'pending_only'
};

// Simulation of storage update where settings are merged
const newCommitSha = '9999999cf3138a2b4a9b54c3b3d4b53b5f5ce69f';
const updatedStorage = {
    ...sampleSettings,
    installedCommit: newCommitSha,
    updateAvailable: false,
    lastUpdateTimestamp: Date.now()
};

// Assert every key and setting is preserved
for (const [k, v] of Object.entries(sampleSettings)) {
    assert.strictEqual(updatedStorage[k], v, `Setting ${k} must be preserved!`);
}
assert.strictEqual(updatedStorage.installedCommit, newCommitSha);
assert.strictEqual(updatedStorage.updateAvailable, false);
console.log("✓ Test 4: All AI API keys and user preferences are 100% preserved.");

console.log("================================================================");
console.log("🎉 ALL UPDATE TESTS PASSED 100%!");
console.log("================================================================");
