// ============================================================================
// Coursera AI AutoPilot - Main World Speed & Visibility Engine
// Adopts the exact proven spoofing mechanism:
// - Native descriptor captured directly at document_start (main world)
// - Spoofs getter to 1.0x when speed > 2.0x so Coursera's player never resets it
// - Transparent native speed for <= 2.0x
// - Continuous enforcement loop (250ms) to ensure video stays at target speed
// - Unlocks full 0.25x to 16x speed range
// - Background play & visibility overrides
// ============================================================================

(function() {
    'use strict';

    if (window.__coursera_speed_engine_installed__) return;
    window.__coursera_speed_engine_installed__ = true;

    let forcedSpeed = 3.0;
    let spoofingActive = true;

    // 1. Capture pristine native descriptors directly from HTMLMediaElement prototype
    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!nativeDescriptor || !nativeDescriptor.get || !nativeDescriptor.set) {
        console.error('[Coursera Speed Engine] Failed to obtain native playbackRate descriptor');
        return;
    }

    // Also capture defaultPlaybackRate descriptor if available
    const nativeDefaultDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'defaultPlaybackRate');

    // 2. Override playbackRate on HTMLMediaElement prototype
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        get: function() {
            // When forced speed is above Coursera's 2.0x limit, report 1.0x to the site
            if (spoofingActive && forcedSpeed > 2.0) {
                return 1.0;
            }
            return nativeDescriptor.get.call(this);
        },
        set: function(val) {
            // If spoofing is active and forced speed > 1.0, redirect to forced speed
            if (spoofingActive && forcedSpeed > 1.0) {
                nativeDescriptor.set.call(this, forcedSpeed);
            } else {
                nativeDescriptor.set.call(this, val);
            }
        },
        configurable: true,
        enumerable: true
    });

    // 3. Helper to apply speed and pitch preservation to all media
    function applySpeedToMedia(media) {
        if (!media) return;
        try {
            const target = spoofingActive ? forcedSpeed : 1.0;
            nativeDescriptor.set.call(media, target);
            if (nativeDefaultDesc && nativeDefaultDesc.set) {
                nativeDefaultDesc.set.call(media, target);
            }
            if (media.preservesPitch !== undefined) media.preservesPitch = true;
            if (media.mozPreservesPitch !== undefined) media.mozPreservesPitch = true;
            if (media.webkitPreservesPitch !== undefined) media.webkitPreservesPitch = true;
        } catch (e) {}
    }

    function applySpeedToAll() {
        document.querySelectorAll('video, audio').forEach(applySpeedToMedia);
    }

    // 4. Fast enforcement interval (every 250ms)
    // When forcedSpeed > 2.0, media.playbackRate returns 1.0, so media.playbackRate !== forcedSpeed is always true
    // This guarantees the media stays pinned to forcedSpeed even if site tries to change it.
    setInterval(() => {
        if (spoofingActive && forcedSpeed > 1.0) {
            document.querySelectorAll('video, audio').forEach(media => {
                const currentActual = nativeDescriptor.get.call(media);
                if (Math.abs(currentActual - forcedSpeed) > 0.05) {
                    nativeDescriptor.set.call(media, forcedSpeed);
                }
            });
        }
    }, 250);

    // 5. Hook media play/playing events so speed is locked immediately on play
    ['play', 'playing', 'canplay', 'loadedmetadata'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (e.target && (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO')) {
                if (spoofingActive && forcedSpeed > 1.0) {
                    applySpeedToMedia(e.target);
                }
            }
        }, true);
    });

    // 6. Listen for speed updates from content script via window postMessage
    window.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'COURSERA_FORCE_SPEED' || event.data.type === 'COURSERA_SET_SPEED') {
            const speed = parseFloat(event.data.speed);
            const enabled = event.data.enabled !== undefined ? !!event.data.enabled : true;

            if (!enabled || isNaN(speed) || speed <= 1.0) {
                forcedSpeed = 1.0;
                spoofingActive = false;
                applySpeedToAll();
            } else {
                // Clamp between 0.25 and 16.0 (browser hardware limit)
                forcedSpeed = Math.min(16.0, Math.max(0.25, speed));
                spoofingActive = true;
                applySpeedToAll();
            }
        }
    });

    // 7. Background play & visibility overrides
    function applyVisibilityOverrides() {
        try {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        } catch (e) {}
    }
    applyVisibilityOverrides();

    ['visibilitychange', 'webkitvisibilitychange'].forEach(evt => {
        window.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
        document.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
    });
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);

    // 8. Auto-dismiss "Skipping forward is only available on video sections you have already watched"
    setInterval(() => {
        document.querySelectorAll('button, [role="button"]').forEach(btn => {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            const parentText = (btn.parentElement ? btn.parentElement.innerText || '' : '').toLowerCase();
            if (parentText.includes('skipping forward is only available') || text === 'dismiss') {
                try { btn.click(); } catch(e) {}
            }
        });
    }, 1000);

    // 9. Read initial configuration from dataset / sessionStorage if present at document_start
    try {
        const ds = document.documentElement?.dataset?.courseraSpeed;
        if (ds) forcedSpeed = parseFloat(ds) || forcedSpeed;
        const ss = sessionStorage.getItem('coursera_speed');
        if (ss) forcedSpeed = parseFloat(ss) || forcedSpeed;

        const de = document.documentElement?.dataset?.courseraSpeedEnabled;
        const se = sessionStorage.getItem('coursera_speed_enabled');
        if (de === 'false' || se === 'false') {
            spoofingActive = false;
        } else if (forcedSpeed > 1.0) {
            spoofingActive = true;
        }
    } catch (e) {}

    // Initial pass on existing media
    applySpeedToAll();

    // 10. Expose window.courseraPlaybackSpeed for direct control / debugging
    window.courseraPlaybackSpeed = {
        set(speed, enabled = true) {
            if (!enabled || speed <= 1.0) {
                forcedSpeed = 1.0;
                spoofingActive = false;
                applySpeedToAll();
            } else {
                forcedSpeed = Math.min(16.0, Math.max(0.25, parseFloat(speed) || 1.0));
                spoofingActive = true;
                applySpeedToAll();
            }
        },
        get() { return forcedSpeed; },
        isSpoofing() { return spoofingActive; },
        getNativeRate() {
            const v = document.querySelector('video');
            return v ? nativeDescriptor.get.call(v) : null;
        }
    };

    console.log(`[Coursera Speed Engine] Initialized. Speed: ${forcedSpeed}x, Spoofing: ${spoofingActive}`);
})();