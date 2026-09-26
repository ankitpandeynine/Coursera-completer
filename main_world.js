// ============================================================================
// Coursera AI AutoPilot - Main World Speed & Visibility Engine (v10.0)
// High-precision video playbackRate spoofing (runs at 3x+ while spoofing 1.0x to site)
// ============================================================================

(function() {
    'use strict';

    if (window.__coursera_speed_engine_installed__) return;
    window.__coursera_speed_engine_installed__ = true;

    let forcedSpeed = 3.0;
    let spoofingActive = true;
    let speedInjectionEnabled = true;

    // 1. Read initial values from dataset / sessionStorage if present
    try {
        const ds = document.documentElement?.dataset?.courseraSpeed;
        if (ds) forcedSpeed = parseFloat(ds) || 3.0;
        const ss = sessionStorage.getItem('coursera_speed');
        if (ss) forcedSpeed = parseFloat(ss) || 3.0;

        const de = document.documentElement?.dataset?.courseraSpeedEnabled;
        if (de !== undefined) speedInjectionEnabled = de !== 'false';
        const se = sessionStorage.getItem('coursera_speed_enabled');
        if (se !== undefined && se !== null) speedInjectionEnabled = se !== 'false';

        spoofingActive = speedInjectionEnabled && forcedSpeed > 1.0;
    } catch (e) {}

    // 2. Cache original native descriptors before any site scripts run
    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!nativeDescriptor) return;

    const nativeDefaultDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'defaultPlaybackRate');

    // 3. Define spoofed playbackRate property
    // TRICK: When forcedSpeed > 2.0, return 1.0 to Coursera's player so it never blocks or warns about skipping forward!
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        get: function() {
            if (spoofingActive && forcedSpeed > 2.0) return 1.0;
            return nativeDescriptor.get.call(this);
        },
        set: function(val) {
            if (spoofingActive && forcedSpeed > 1.0) {
                nativeDescriptor.set.call(this, forcedSpeed);
            } else {
                nativeDescriptor.set.call(this, val);
            }
        },
        configurable: true,
        enumerable: true
    });

    if (nativeDefaultDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, 'defaultPlaybackRate', {
            get: function() {
                if (spoofingActive && forcedSpeed > 2.0) return 1.0;
                return nativeDefaultDescriptor.get.call(this);
            },
            set: function(val) {
                if (spoofingActive && forcedSpeed > 1.0) {
                    nativeDefaultDescriptor.set.call(this, forcedSpeed);
                } else {
                    nativeDefaultDescriptor.set.call(this, val);
                }
            },
            configurable: true,
            enumerable: true
        });
    }

    // Helper: Enforce speed on all video and audio elements
    function enforceSpeedOnMedia(media) {
        if (!media) return;
        try {
            media.preservesPitch = true;
            media.webkitPreservesPitch = true;
            media.mozPreservesPitch = true;
        } catch (e) {}

        try {
            const target = (spoofingActive && forcedSpeed > 1.0) ? forcedSpeed : 1.0;
            const currentRealRate = nativeDescriptor.get.call(media);
            if (currentRealRate !== target) {
                nativeDescriptor.set.call(media, target);
            }
            if (nativeDefaultDescriptor) {
                const currentDefault = nativeDefaultDescriptor.get.call(media);
                if (currentDefault !== target) {
                    nativeDefaultDescriptor.set.call(media, target);
                }
            }
        } catch (e) {}
    }

    function enforceAllMedia() {
        document.querySelectorAll('video, audio').forEach(enforceSpeedOnMedia);
    }

    // 4. Listen for IPC messages from content script
    window.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'COURSERA_FORCE_SPEED' || event.data.type === 'COURSERA_SET_SPEED') {
            const enabled = event.data.enabled !== undefined ? !!event.data.enabled : true;
            speedInjectionEnabled = enabled;

            if (!enabled) {
                forcedSpeed = 1.0;
                spoofingActive = false;
            } else {
                forcedSpeed = parseFloat(event.data.speed) || 3.0;
                spoofingActive = forcedSpeed > 1.0;
            }

            try {
                sessionStorage.setItem('coursera_speed', String(forcedSpeed));
                sessionStorage.setItem('coursera_speed_enabled', String(speedInjectionEnabled));
            } catch (e) {}

            enforceAllMedia();
        }
    });

    // 5. Periodic 500ms enforcement interval
    setInterval(() => {
        if (spoofingActive) {
            document.querySelectorAll('video, audio').forEach(media => {
                try {
                    if (nativeDescriptor.get.call(media) !== forcedSpeed) {
                        nativeDescriptor.set.call(media, forcedSpeed);
                    }
                } catch (e) {}
            });
        }
    }, 500);

    // 6. Hook lifecycle events on media elements dynamically
    const observedMedia = new WeakSet();
    function hookMediaEvents(media) {
        if (!media || observedMedia.has(media)) return;
        observedMedia.add(media);

        const onEvent = () => {
            if (spoofingActive) enforceSpeedOnMedia(media);
        };

        ['play', 'playing', 'canplay', 'loadeddata', 'seeked'].forEach(evt => {
            media.addEventListener(evt, onEvent, { passive: true });
        });

        if (spoofingActive) enforceSpeedOnMedia(media);
    }

    setInterval(() => {
        document.querySelectorAll('video, audio').forEach(hookMediaEvents);
    }, 800);

    // 7. Background Play Overrides
    try {
        if (Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')?.configurable) {
            Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
        }
        if (Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')?.configurable) {
            Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
        }
    } catch (e) {}

    ['visibilitychange', 'webkitvisibilitychange'].forEach(evt => {
        window.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
        document.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
    });
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);

    // 8. Public API on window for DevTools inspection
    window.courseraPlaybackSpeed = {
        set(speed, enabled = true) {
            speedInjectionEnabled = !!enabled;
            forcedSpeed = parseFloat(speed) || 1.0;
            spoofingActive = speedInjectionEnabled && forcedSpeed > 1.0;
            enforceAllMedia();
        },
        get() {
            return forcedSpeed;
        },
        isSpoofing() {
            return spoofingActive;
        }
    };

    enforceAllMedia();
    console.log(`[Coursera Speed Engine v10.0] Active with PlaybackRate Spoofing (${forcedSpeed}x, Spoofing: ${spoofingActive}).`);
})();