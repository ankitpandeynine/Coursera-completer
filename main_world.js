// ============================================================================
// Coursera AI AutoPilot - Main World Speed & Visibility Engine
// - Native descriptor captured directly at document_start (main world)
// - Capture-phase ratechange event shield to prevent Coursera's player reset
// - Spoofs getter to 2.0x when speed > 2.0x (Coursera's maximum native supported rate)
// - Allows Coursera native speeds (0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x) with zero spoofing
// - Turbo forced speeds from 3x up to 16x without buffer crashes or player errors
// - Safe application: only enforces when media is ready (readyState >= 1)
// - Automatic error & stall recovery: recovers seamlessly if buffer underruns
// - Background play & visibility overrides
// ============================================================================

(function() {
    'use strict';

    if (window.__coursera_speed_engine_installed__) return;
    window.__coursera_speed_engine_installed__ = true;

    let forcedSpeed = 2.0;
    let spoofingActive = false; // Only true when forcedSpeed > 2.0

    // 1. Capture pristine native descriptors directly from HTMLMediaElement prototype
    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!nativeDescriptor || !nativeDescriptor.get || !nativeDescriptor.set) {
        console.error('[Coursera Speed Engine] Failed to obtain native playbackRate descriptor');
        return;
    }

    // 2. Event Shield: suppress ratechange in capture phase when forced speed > 2.0x
    // This stops Coursera's player ratechange listeners from firing and resetting the speed to 1.0!
    ['ratechange'].forEach(evt => {
        window.addEventListener(evt, (e) => {
            if (spoofingActive && forcedSpeed > 2.0) {
                e.stopImmediatePropagation();
            }
        }, true);
        document.addEventListener(evt, (e) => {
            if (spoofingActive && forcedSpeed > 2.0) {
                e.stopImmediatePropagation();
            }
        }, true);
    });

    // 3. Override playbackRate on HTMLMediaElement prototype
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        get: function() {
            // When forced speed is above Coursera's 2.0x limit, report 2.0x (Coursera's native max)
            // This satisfies Coursera's player state completely without raising flags
            if (spoofingActive && forcedSpeed > 2.0) {
                return 2.0;
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

    // 4. Hook each media element instance
    function hookMediaElement(media) {
        if (!media || media.__coursera_speed_hooked__) return;
        media.__coursera_speed_hooked__ = true;

        // Instance capture-phase ratechange shield
        media.addEventListener('ratechange', (e) => {
            if (spoofingActive && forcedSpeed > 2.0) {
                e.stopImmediatePropagation();
            }
        }, true);

        // Instance error handler: prevent player crashing, auto-recover to safe speed
        media.addEventListener('error', (e) => {
            console.warn('[Coursera Speed Engine] Media error caught. Falling back to safe 2.0x native rate.', media.error);
            if (forcedSpeed > 2.0) {
                forcedSpeed = 2.0;
                spoofingActive = false;
                try { nativeDescriptor.set.call(media, 2.0); } catch(err) {}
            }
            try {
                media.play().catch(() => {});
            } catch(err) {}
        }, true);

        // Instance property descriptor override (prevents Coursera from shadowing prototype on the instance)
        try {
            Object.defineProperty(media, 'playbackRate', {
                configurable: true,
                enumerable: true,
                get: function() {
                    if (spoofingActive && forcedSpeed > 2.0) return 2.0;
                    return nativeDescriptor.get.call(this);
                },
                set: function(val) {
                    if (spoofingActive && forcedSpeed > 1.0) {
                        nativeDescriptor.set.call(this, forcedSpeed);
                    } else {
                        nativeDescriptor.set.call(this, val);
                    }
                }
            });
        } catch(err) {}

        applySpeedSafely(media);
    }

    // 5. Helper to apply speed safely only when media has loaded metadata
    function applySpeedSafely(media) {
        if (!media) return;
        try {
            const target = (spoofingActive && forcedSpeed > 1.0) ? forcedSpeed : (forcedSpeed || 1.0);
            if (media.readyState >= 1) {
                nativeDescriptor.set.call(media, target);
            }
        } catch (e) {}
    }

    function applySpeedToAll() {
        document.querySelectorAll('video, audio').forEach(media => {
            hookMediaElement(media);
            applySpeedSafely(media);
        });
    }

    // 6. Enforcement interval (every 500ms) - only applies when media is ready and playing
    setInterval(() => {
        if (forcedSpeed > 1.0) {
            document.querySelectorAll('video, audio').forEach(media => {
                hookMediaElement(media);
                if (media.readyState >= 1 && !media.seeking && !media.paused) {
                    const currentActual = nativeDescriptor.get.call(media);
                    if (Math.abs(currentActual - forcedSpeed) > 0.05) {
                        nativeDescriptor.set.call(media, forcedSpeed);
                    }
                }
            });
        }
    }, 500);

    // 7. Hook play/playing events so speed is applied when user or autopilot starts video
    ['play', 'playing'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (e.target && (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO')) {
                hookMediaElement(e.target);
                applySpeedSafely(e.target);
            }
        }, true);
    });

    // 8. Listen for speed updates from content script via window postMessage
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
                forcedSpeed = Math.min(16.0, Math.max(0.25, speed));
                // Spoofing is ONLY active when speed exceeds Coursera's native 2.0x limit!
                // For speeds <= 2.0x (e.g. 1.25x, 1.5x, 1.75x, 2.0x), no spoofing is needed!
                spoofingActive = forcedSpeed > 2.0;
                applySpeedToAll();
            }
        }
    });

    // 9. Background play & visibility overrides
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

    // 10. Auto-dismiss "Skipping forward is only available on video sections you have already watched"
    setInterval(() => {
        document.querySelectorAll('button, [role="button"]').forEach(btn => {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            const parentText = (btn.parentElement ? btn.parentElement.innerText || '' : '').toLowerCase();
            if (parentText.includes('skipping forward is only available') || text === 'dismiss') {
                try { btn.click(); } catch(e) {}
            }
        });
    }, 1000);

    // 11. Read initial configuration from dataset / sessionStorage if present at document_start
    try {
        const ds = document.documentElement?.dataset?.courseraSpeed;
        if (ds) forcedSpeed = parseFloat(ds) || forcedSpeed;
        const ss = sessionStorage.getItem('coursera_speed');
        if (ss) forcedSpeed = parseFloat(ss) || forcedSpeed;

        const de = document.documentElement?.dataset?.courseraSpeedEnabled;
        const se = sessionStorage.getItem('coursera_speed_enabled');
        if (de === 'false' || se === 'false') {
            forcedSpeed = 1.0;
            spoofingActive = false;
        } else {
            spoofingActive = forcedSpeed > 2.0;
        }
    } catch (e) {}

    // Initial pass on existing media
    applySpeedToAll();

    // 12. Expose window.courseraPlaybackSpeed for direct inspection & verification
    window.courseraPlaybackSpeed = {
        set(speed, enabled = true) {
            if (!enabled || speed <= 1.0) {
                forcedSpeed = 1.0;
                spoofingActive = false;
                applySpeedToAll();
            } else {
                forcedSpeed = Math.min(16.0, Math.max(0.25, parseFloat(speed) || 1.0));
                spoofingActive = forcedSpeed > 2.0;
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

    console.log(`[Coursera Speed Engine v11.0] Ready. Target Speed: ${forcedSpeed}x, Spoofing Active: ${spoofingActive}`);
})();