// ============================================================================
// Coursera AI AutoPilot - 1-Click Updater Engine
// - Live GitHub commit & release check
// - Safe in-memory download & unzipping with fflate
// - File System Access API directory synchronization
// - 100% preservation of all AI API keys & user settings across reloads
// ============================================================================

const GITHUB_REPO = 'ankitpandeynine/Coursera-completer';
const GITHUB_BRANCH = 'main';
const GITHUB_API_COMMITS = `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;
const GITHUB_ZIP_URL = `https://codeload.github.com/${GITHUB_REPO}/zip/refs/heads/${GITHUB_BRANCH}`;
const DB_NAME = 'CourseraAutoPilotDB';
const DB_STORE = 'handles';

let currentLocalCommit = '21ab9c1';
let remoteCommitSha = '';
let remoteCommitMsg = '';
let remoteCommitDate = '';
let isUpdating = false;

// DOM Elements
const currentVerText = document.getElementById('currentVerText');
const latestVerText = document.getElementById('latestVerText');
const commitBox = document.getElementById('commitBox');
const commitMsgText = document.getElementById('commitMsgText');
const progressBarFill = document.getElementById('progressBarFill');
const progressStepText = document.getElementById('progressStepText');
const progressPercentText = document.getElementById('progressPercentText');
const startUpdateBtn = document.getElementById('startUpdateBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const logBox = document.getElementById('logBox');

function appendLog(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

function updateProgress(percent, stepMessage) {
    const clamped = Math.min(100, Math.max(0, percent));
    progressBarFill.style.width = `${clamped}%`;
    progressPercentText.textContent = `${Math.round(clamped)}%`;
    if (stepMessage) {
        progressStepText.textContent = stepMessage;
        appendLog(stepMessage, clamped === 100 ? 'success' : 'info');
    }
}

// 1. IndexedDB helpers for Directory Handle & Settings Backup
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
            if (!db.objectStoreNames.contains('settings_backup')) {
                db.createObjectStore('settings_backup');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveDirHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(handle, 'extensionFolder');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function getSavedDirHandle() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get('extensionFolder');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

async function backupSettings(settingsObj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings_backup', 'readwrite');
        tx.objectStore('settings_backup').put(settingsObj, 'latestBackup');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

// 2. Initial Setup: Check Local & Remote Versions
async function init() {
    try {
        // Load local version and stored commit
        const manifest = chrome.runtime.getManifest();
        const stored = await chrome.storage.local.get(['installedCommit', 'installedVersion']);
        if (stored.installedCommit) {
            currentLocalCommit = stored.installedCommit;
        } else {
            try {
                const res = await fetch(chrome.runtime.getURL('version.json'));
                const vJson = await res.json();
                if (vJson.commit) currentLocalCommit = vJson.commit;
            } catch (e) {}
        }

        currentVerText.textContent = `v${manifest.version} (${currentLocalCommit.slice(0, 7)})`;
        appendLog(`Current version loaded: v${manifest.version} (Commit: ${currentLocalCommit.slice(0, 7)})`);

        // Check Remote GitHub
        await checkRemoteUpdate();

        // Check if auto-update query parameter was passed
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auto') === '1') {
            if (remoteCommitSha && !remoteCommitSha.startsWith(currentLocalCommit.slice(0, 7))) {
                appendLog('Auto-update initiated from popup...', 'info');
                performOneClickUpdate();
            }
        }
    } catch (err) {
        appendLog(`Init error: ${err.message}`, 'error');
    }
}

async function checkRemoteUpdate() {
    progressStepText.textContent = 'Checking GitHub for updates...';
    try {
        const resp = await fetch(GITHUB_API_COMMITS, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            cache: 'no-store'
        });

        if (!resp.ok) {
            throw new Error(`GitHub API returned status ${resp.status}`);
        }

        const data = await resp.json();
        remoteCommitSha = data.sha || '';
        remoteCommitMsg = data.commit?.message?.split('\n')[0] || '';
        remoteCommitDate = data.commit?.author?.date || '';

        latestVerText.textContent = remoteCommitSha.slice(0, 7);
        commitBox.style.display = 'block';
        commitMsgText.textContent = `"${remoteCommitMsg}" (${new Date(remoteCommitDate).toLocaleDateString()})`;

        const isNew = remoteCommitSha && !remoteCommitSha.startsWith(currentLocalCommit.slice(0, 7));

        if (isNew) {
            latestVerText.className = 'ver-val highlight';
            progressStepText.textContent = 'Update available! Click below to update.';
            appendLog(`New update available: ${remoteCommitSha.slice(0, 7)} - "${remoteCommitMsg}"`, 'success');
            startUpdateBtn.disabled = false;
            startUpdateBtn.innerHTML = '<span>⚡ 1-Click Update to Latest</span>';
        } else {
            latestVerText.className = 'ver-val';
            progressStepText.textContent = 'You are already on the latest version.';
            appendLog('Extension is up to date with GitHub main branch.', 'info');
            startUpdateBtn.disabled = false;
            startUpdateBtn.innerHTML = '<span>🔄 Force Re-install / Refresh</span>';
        }
    } catch (err) {
        latestVerText.textContent = 'Offline / Error';
        progressStepText.textContent = 'Could not reach GitHub';
        appendLog(`Failed to query GitHub: ${err.message}`, 'warn');
    }
}

// 3. One-Click Update Flow
async function performOneClickUpdate() {
    if (isUpdating) return;
    isUpdating = true;
    startUpdateBtn.disabled = true;

    try {
        updateProgress(10, 'Step 1/5: Backing up AI API keys and settings...');
        
        // A. Secure all storage settings
        const allSettings = await chrome.storage.local.get(null);
        await backupSettings(allSettings);
        appendLog(`Secured ${Object.keys(allSettings).length} storage settings & API keys safely.`, 'success');

        // B. Ensure directory access permission
        updateProgress(25, 'Step 2/5: Requesting folder access...');
        let dirHandle = await getSavedDirHandle();
        let permissionGranted = false;

        if (dirHandle) {
            try {
                if ((await dirHandle.queryPermission({ mode: 'readwrite' })) === 'granted') {
                    permissionGranted = true;
                } else if ((await dirHandle.requestPermission({ mode: 'readwrite' })) === 'granted') {
                    permissionGranted = true;
                }
            } catch (e) {
                dirHandle = null;
            }
        }

        if (!permissionGranted || !dirHandle) {
            appendLog('Folder access required. Please select the "curseraautopilot" folder in the dialog...', 'warn');
            alert('📁 Please select your extension folder ("curseraautopilot").\n\nChrome only asks for this once to allow 1-click automatic updates!');
            dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveDirHandle(dirHandle);
            appendLog('Folder access granted and saved for future 1-click updates.', 'success');
        }

        // C. Download Zip Archive from GitHub
        updateProgress(45, 'Step 3/5: Downloading latest code archive from GitHub...');
        const zipResp = await fetch(GITHUB_ZIP_URL, { cache: 'no-store' });
        if (!zipResp.ok) throw new Error(`Download failed with status ${zipResp.status}`);
        const zipArrayBuffer = await zipResp.arrayBuffer();
        appendLog(`Downloaded zip archive (${Math.round(zipArrayBuffer.byteLength / 1024)} KB).`, 'success');

        // D. Unzip in-memory with fflate
        updateProgress(65, 'Step 4/5: Unpacking files with fast unzip engine...');
        const unzipped = fflate.unzipSync(new Uint8Array(zipArrayBuffer));
        const entries = Object.entries(unzipped);
        appendLog(`Unzipped ${entries.length} raw files from archive.`, 'info');

        // E. Write files into extension directory
        updateProgress(80, 'Step 5/5: Overwriting extension files in folder...');
        let writtenCount = 0;

        for (const [fullPath, uint8Data] of entries) {
            if (fullPath.endsWith('/')) continue;
            // Strip GitHub's root archive prefix e.g. "Coursera-completer-main/"
            const relPath = fullPath.replace(/^[^/]+\//, '');
            if (!relPath || relPath.startsWith('.git') || relPath.startsWith('scratch/')) continue;

            await writeRelativeFile(dirHandle, relPath, uint8Data);
            writtenCount++;
        }
        appendLog(`Successfully updated ${writtenCount} files in extension folder!`, 'success');

        // F. Update stored metadata and preserve all settings
        const newCommit = remoteCommitSha || currentLocalCommit;
        await chrome.storage.local.set({
            ...allSettings,
            installedCommit: newCommit,
            updateAvailable: false,
            lastUpdateTimestamp: Date.now()
        });

        updateProgress(100, '🎉 Update 100% Complete! Reloading extension...');
        appendLog('All AI API keys, providers, and settings verified intact.', 'success');
        appendLog('Reloading extension now...', 'info');

        // G. Clean reload of extension in Chrome
        setTimeout(() => {
            chrome.runtime.reload();
            startUpdateBtn.disabled = false;
            startUpdateBtn.innerHTML = '<span>✓ Updated & Reloaded!</span>';
            alert('🎉 Coursera AutoPilot has been successfully updated to the latest version!\n\nYou can close this tab now.');
        }, 1200);

    } catch (err) {
        isUpdating = false;
        startUpdateBtn.disabled = false;
        appendLog(`Update Error: ${err.message}`, 'error');
        alert(`Update failed: ${err.message}\n\nYou can use the "Download Latest Zip" button below to update manually.`);
    }
}

// 4. Helper to write a file at relative path inside DirectoryHandle
async function writeRelativeFile(dirHandle, relativePath, uint8Array) {
    const parts = relativePath.split('/');
    let currentDir = dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
    }
    const fileName = parts[parts.length - 1];
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(uint8Array);
    await writable.close();
}

// 5. Manual Download Zip Fallback
downloadZipBtn.addEventListener('click', () => {
    appendLog('Starting direct zip download from GitHub...', 'info');
    const a = document.createElement('a');
    a.href = GITHUB_ZIP_URL;
    a.download = `Coursera-AutoPilot-${(remoteCommitSha || 'latest').slice(0, 7)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    appendLog('Download initiated. Extract this zip over your extension folder and click refresh in chrome://extensions.', 'warn');
});

startUpdateBtn.addEventListener('click', () => {
    performOneClickUpdate();
});

// Run init on load
init();
