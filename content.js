let state = { playbackSpeed: 3, bgPlay: true, autoNavigate: true };

chrome.storage.local.get(['playbackSpeed', 'bgPlay', 'autoNavigate'], (data) => {
    if (data.playbackSpeed) state.playbackSpeed = data.playbackSpeed;
    if (data.bgPlay !== undefined) state.bgPlay = data.bgPlay;
    if (data.autoNavigate !== undefined) state.autoNavigate = data.autoNavigate;
    applyVisibilityOverrides();
    syncSpeedToMainWorld();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.playbackSpeed) { state.playbackSpeed = changes.playbackSpeed.newValue; syncSpeedToMainWorld(); }
    if (changes.bgPlay) { state.bgPlay = changes.bgPlay.newValue; applyVisibilityOverrides(); }
    if (changes.autoNavigate) state.autoNavigate = changes.autoNavigate.newValue;
});

function syncSpeedToMainWorld() {
    window.postMessage({ type: 'COURSERA_FORCE_SPEED', speed: state.playbackSpeed }, '*');
}

// ==========================================
// BACKGROUND PLAY OVERRIDES
// ==========================================
function applyVisibilityOverrides() {
    if (state.bgPlay) {
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    }
}
document.addEventListener('visibilitychange', (e) => { if (state.bgPlay) e.stopImmediatePropagation(); }, true);
window.addEventListener('blur', (e) => { if (state.bgPlay) e.stopImmediatePropagation(); }, true);

// ==========================================
// MASTER AUTO-NAVIGATOR (Fixed Visibility Logic)
// ==========================================
function handleAutoPilot() {
    if (!state.autoNavigate) return;

    const video = document.querySelector('video');
    
    // 💥 CRITICAL FIX: Only scan buttons that are ACTUALLY visible on the screen
    // (Coursera hides old buttons instead of deleting them, which caused it to freeze)
    const visibleInteractables = Array.from(document.querySelectorAll('button, a')).filter(el => 
        el.offsetWidth > 0 || el.offsetHeight > 0
    );
    
    let isReadingTimerRunning = false;
    let shouldGoNext = false;

    // 1. AUTO-PLAY VIDEO
    if (video && video.paused && !video.ended) {
        video.play().catch(() => {
            const playBtn = visibleInteractables.find(btn => btn.getAttribute('aria-label') === 'Play' || btn.title === 'Play');
            if (playBtn) playBtn.click();
        });
    }

    // 2. SCAN VISIBLE BUTTONS
    visibleInteractables.forEach(btn => {
        const text = btn.innerText ? btn.innerText.trim().toLowerCase() : '';
        const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';

        // A. Skip mid-video popups
        if (text === 'skip' && !isDisabled) {
            btn.click();
        }

        // B. Handle Reading Pages - Detect if "Mark as completed" is actively visible
        if (text === 'mark as completed') {
            isReadingTimerRunning = true; 
            if (!isDisabled) {
                btn.click(); // Timer finished, click it!
            }
        }

        // C. Close Error Banners
        if (btn.parentElement && btn.parentElement.innerText.includes('Skipping forward is only available')) {
            btn.click();
        }
    });

    // 3. LOGIC FOR "GO TO NEXT ITEM"
    if (video) {
        // If it's a video, wait until it reaches the end
        if (!isNaN(video.duration) && video.duration > 0) {
            if (video.ended || video.currentTime >= video.duration - 1) {
                shouldGoNext = true;
            }
        }
    } else {
        // If we are on a reading/quiz page and the "Mark as completed" button is NO LONGER visible, 
        // it means we successfully completed it and we are cleared to go to the next item.
        if (!isReadingTimerRunning) {
            shouldGoNext = true;
        }
    }

    // 4. EXECUTE NAVIGATION
    if (shouldGoNext) {
        visibleInteractables.forEach(btn => {
            const text = btn.innerText ? btn.innerText.trim().toLowerCase() : '';
            if (text.includes('go to next item')) {
                const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
                if (!isDisabled) {
                    btn.click();
                }
            }
        });
    }
}

// Run the loop every 1 second
setInterval(() => {
    syncSpeedToMainWorld();
    handleAutoPilot();
}, 1000);