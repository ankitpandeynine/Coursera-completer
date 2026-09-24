// Coursera AI AutoPilot - Main World Script v8.7 (Optimized & Crash-Proof)
// High-performance video & audio speed force engine (0.25x - 16x)

(function() {
    'use strict';

    // 1. Strict Singleton Guard: Prevents double-injection and recursion
    if (window.__coursera_speed_engine_installed__) return;
    window.__coursera_speed_engine_installed__ = true;

    const clamp = (value) => Math.min(16, Math.max(0.25, Number(value) || 1));

    // 2. Safe Synchronous Bootstrap
    function getInitialSpeed() {
        try {
            const ds = document.documentElement?.dataset?.courseraSpeed;
            if (ds) return clamp(ds);
            const ss = sessionStorage.getItem('coursera_speed');
            if (ss) return clamp(ss);
        } catch (e) {}
        return 3.0;
    }

    function getInitialMode() {
        try {
            const dm = document.documentElement?.dataset?.courseraForceMode;
            if (dm && ['hybrid', 'native', 'virtual'].includes(dm)) return dm;
            const sm = sessionStorage.getItem('coursera_force_mode');
            if (sm && ['hybrid', 'native', 'virtual'].includes(sm)) return sm;
        } catch (e) {}
        return 'hybrid';
    }

    let targetSpeed = getInitialSpeed();
    let forceMode = getInitialMode();

    // 3. Cache original native descriptors before any site scripts run
    const nativeRateDesc = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "playbackRate"
    );
    const nativeDefaultRateDesc = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "defaultPlaybackRate"
    );

    const hookedInstances = new WeakSet();
    const mediaTrackers = new WeakMap();

    function setNativeRate(media, rate) {
        if (!media || !(media instanceof HTMLMediaElement)) return;
        try {
            if (nativeRateDesc?.set) {
                nativeRateDesc.set.call(media, rate);
            }
            if (nativeDefaultRateDesc?.set) {
                nativeDefaultRateDesc.set.call(media, rate);
            }
        } catch (e) {}
    }

    /* ========================================================================
       ENGINE 1: PROTOTYPE PROPERTY INTERCEPTION
       Intercepts all Coursera / React / Video.js attempts to reset playbackRate
       ======================================================================== */
    if (nativeRateDesc?.set) {
        try {
            Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
                configurable: true,
                enumerable: true,
                get: function() {
                    return targetSpeed;
                },
                set: function(val) {
                    if (forceMode === 'virtual') {
                        setNativeRate(this, val);
                    } else {
                        setNativeRate(this, targetSpeed);
                    }
                }
            });

            if (nativeDefaultRateDesc?.set) {
                Object.defineProperty(HTMLMediaElement.prototype, 'defaultPlaybackRate', {
                    configurable: true,
                    enumerable: true,
                    get: function() {
                        return targetSpeed;
                    },
                    set: function(val) {
                        setNativeRate(this, targetSpeed);
                    }
                });
            }
        } catch (e) {
            console.warn('[Coursera Speed] Prototype notice:', e);
        }
    }

    /* ========================================================================
       ENGINE 2: CAPTURE-PHASE EVENT SHIELD
       Silences ratechange events so Coursera's player never triggers a reset.
       (Pure stopImmediatePropagation without recursive setter calls)
       ======================================================================== */
    function handleRateChangeCapture(e) {
        // Prevent Coursera's event listeners from detecting the rate change
        e.stopImmediatePropagation();
    }

    window.addEventListener('ratechange', handleRateChangeCapture, true);

    /* ========================================================================
       ENGINE 3: INSTANCE-LEVEL ENFORCEMENT & PITCH PRESERVATION
       ======================================================================== */
    function hookMediaInstance(media) {
        if (!media || !(media instanceof HTMLMediaElement)) return;
        if (hookedInstances.has(media)) return;
        hookedInstances.add(media);

        try {
            media.preservesPitch = true;
            media.mozPreservesPitch = true;
            media.webkitPreservesPitch = true;
        } catch (e) {}

        const applySpeed = () => {
            if (forceMode !== 'virtual') {
                setNativeRate(media, targetSpeed);
            }
        };

        applySpeed();

        // Re-enforce on user or player interactions
        media.addEventListener('play', applySpeed, true);
        media.addEventListener('playing', applySpeed, true);
        media.addEventListener('loadeddata', applySpeed, true);
        media.addEventListener('seeked', applySpeed, true);

        // Assist on timeupdate
        media.addEventListener('timeupdate', () => {
            applySpeed();
            checkAndAssistDrift(media);
        }, true);
    }

    /* ========================================================================
       ENGINE 4: SMART DRIFT ASSIST (Alternative Force)
       Smoothly steps currentTime forward if hardware caps playback velocity
       ======================================================================== */
    function checkAndAssistDrift(media) {
        if (!media || media.paused || media.ended) return;
        if (forceMode === 'native') return;

        const now = performance.now();
        let tracker = mediaTrackers.get(media);

        if (!tracker) {
            mediaTrackers.set(media, {
                lastTime: media.currentTime,
                lastTimestamp: now
            });
            return;
        }

        const deltaRealSec = (now - tracker.lastTimestamp) / 1000;
        tracker.lastTimestamp = now;

        // Only evaluate on realistic playback time slices (150ms to 1200ms)
        if (deltaRealSec < 0.15 || deltaRealSec > 1.2) {
            tracker.lastTime = media.currentTime;
            return;
        }

        const deltaVideoSec = media.currentTime - tracker.lastTime;
        tracker.lastTime = media.currentTime;

        // Skip check if paused, seeking, or still buffering
        if (deltaVideoSec < 0 || media.seeking || media.readyState < 2) return;

        const expectedAdvancement = deltaRealSec * targetSpeed;
        const lag = expectedAdvancement - deltaVideoSec;

        // Micro-advance if lagging behind target by more than 0.08s
        if (lag > 0.08 && lag < 1.5 && media.duration && media.currentTime + lag < media.duration) {
            media.currentTime = Math.min(media.duration - 0.5, media.currentTime + lag);
            tracker.lastTime = media.currentTime;
        }
    }

    /* ========================================================================
       LIGHTWEIGHT WATCHDOG & OBSERVER
       Relaxed 800ms scan - near-zero CPU footprint
       ======================================================================== */
    function scanMedia() {
        const list = document.querySelectorAll("video, audio");
        for (let i = 0; i < list.length; i++) {
            hookMediaInstance(list[i]);
        }
    }

    setInterval(() => {
        scanMedia();
    }, 800);

    /* ========================================================================
       PUBLIC API & IPC CONTROLS
       ======================================================================== */
    window.courseraPlaybackSpeed = {
        set(speed, mode) {
            targetSpeed = clamp(speed);
            if (mode && ['hybrid', 'native', 'virtual'].includes(mode)) {
                forceMode = mode;
            }
            try {
                sessionStorage.setItem('coursera_speed', String(targetSpeed));
                sessionStorage.setItem('coursera_force_mode', forceMode);
                if (document.documentElement) {
                    document.documentElement.dataset.courseraSpeed = String(targetSpeed);
                    document.documentElement.dataset.courseraForceMode = forceMode;
                }
            } catch (e) {}

            scanMedia();
            const list = document.querySelectorAll("video, audio");
            for (let i = 0; i < list.length; i++) {
                if (forceMode !== 'virtual') {
                    setNativeRate(list[i], targetSpeed);
                }
            }
        },
        get() {
            return targetSpeed;
        },
        getMode() {
            return forceMode;
        }
    };

    window.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'COURSERA_FORCE_SPEED' || event.data.type === 'COURSERA_SET_SPEED') {
            const parsedSpeed = parseFloat(event.data.speed);
            const mode = event.data.forceMode || event.data.mode;
            if (!isNaN(parsedSpeed) && parsedSpeed > 0) {
                window.courseraPlaybackSpeed.set(parsedSpeed, mode);
            }
        }
    });

    /* ========================================================================
       SAFE BACKGROUND PLAY SPOOFING
       ======================================================================== */
    try {
        if (Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')?.configurable) {
            Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
        }
        if (Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')?.configurable) {
            Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
        }
    } catch (e) {}

    ['visibilitychange', 'webkitvisibilitychange'].forEach((evt) => {
        window.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
    });

    scanMedia();
    console.log(`[Coursera Speed Engine v8.7] Active & Optimized (${targetSpeed}x, ${forceMode}).`);
})();