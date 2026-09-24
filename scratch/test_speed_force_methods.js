// Test Suite: Comprehensive Video & Audio Speed Force Methods Evaluation
// Simulates Coursera player's hostile environment:
// 1. Player attaches ratechange listener and resets playbackRate to 1.0
// 2. Player checks video.playbackRate in getter and throws/pauses if > 2.0
// 3. Player re-defines properties or re-renders
// 4. Test Native Prototype + Instance Hook vs Virtual Micro-stepping

const assert = require('assert');

// Mock HTMLMediaElement environment
class MockMediaElement {
    constructor(type = 'video') {
        this.tagName = type.toUpperCase();
        this._nativePlaybackRate = 1.0;
        this._currentTime = 0;
        this.duration = 300; // 5 min video
        this.paused = false;
        this.ended = false;
        this.listeners = {};
    }

    addEventListener(event, fn, capture = false) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push({ fn, capture });
    }

    removeEventListener(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l.fn !== fn);
    }

    dispatchEvent(event) {
        const list = this.listeners[event.type] || [];
        for (const l of list) {
            if (event._stopped) break;
            l.fn.call(this, event);
        }
    }

    play() {
        this.paused = false;
        this.dispatchEvent({ type: 'play', _stopped: false, stopImmediatePropagation() { this._stopped = true; } });
    }

    // Native internal hardware setter
    _setNativeRate(r) {
        this._nativePlaybackRate = r;
    }

    _getNativeRate() {
        return this._nativePlaybackRate;
    }
}

// Default prototype playbackRate descriptor
const originalDescriptor = {
    get: function() {
        return this._nativePlaybackRate;
    },
    set: function(val) {
        this._nativePlaybackRate = Number(val) || 1.0;
        this.dispatchEvent({
            type: 'ratechange',
            _stopped: false,
            stopImmediatePropagation() { this._stopped = true; }
        });
    },
    configurable: true,
    enumerable: true
};

Object.defineProperty(MockMediaElement.prototype, 'playbackRate', originalDescriptor);

console.log('--- TEST 1: Baseline Failure (Coursera Reset Trap) ---');
{
    const video = new MockMediaElement('video');
    
    // Coursera attaches ratechange listener: if rate != 1, reset to 1
    video.addEventListener('ratechange', (e) => {
        if (video.playbackRate !== 1.0) {
            // Coursera resets it!
            video.playbackRate = 1.0;
        }
    });

    // Extension tries simple set:
    video.playbackRate = 3.0;

    console.log(`Video playbackRate after simple set: ${video.playbackRate} (Expected failure: resets to 1.0)`);
    assert.strictEqual(video.playbackRate, 1.0, 'Baseline confirmed: Coursera resets rate to 1.0');
}

console.log('\n--- TEST 2: Multi-Layer Force Method (Prototype + Instance + Event Trap) ---');
{
    const video = new MockMediaElement('video');
    const targetSpeed = 3.5;

    // Layer 1: Event Trap on capture phase
    video.addEventListener('ratechange', (e) => {
        // Shield extension-initiated rate changes from site listeners
        if (video._forcingSpeed) {
            e.stopImmediatePropagation();
        }
    }, true);

    // Coursera attaches site listener in bubble phase
    let courseraCaughtRateChange = false;
    video.addEventListener('ratechange', (e) => {
        courseraCaughtRateChange = true;
        if (video.playbackRate !== 1.0) {
            video.playbackRate = 1.0;
        }
    }, false);

    // Layer 2: Instance-Level Lock with Getter Spoofing
    Object.defineProperty(video, 'playbackRate', {
        get: function() {
            // Returns spoofed 1.0 to site scripts if requested, or targetSpeed
            return this._spoofForSite ? 1.0 : targetSpeed;
        },
        set: function(siteAttemptedRate) {
            // Site tries to set rate back to 1.0
            // We ignore or re-enforce targetSpeed on native rate
            video._forcingSpeed = true;
            originalDescriptor.set.call(this, targetSpeed);
            video._forcingSpeed = false;
        },
        configurable: true
    });

    // Apply speed natively
    video._forcingSpeed = true;
    originalDescriptor.set.call(video, targetSpeed);
    video._forcingSpeed = false;

    // Verify native rate is 3.5
    assert.strictEqual(video._getNativeRate(), 3.5, 'Native hardware rate locked at 3.5');
    assert.strictEqual(courseraCaughtRateChange, false, 'Coursera ratechange was shielded');

    // Simulate Coursera attempting to reset speed to 1.0
    video.playbackRate = 1.0;

    // Verify Coursera's reset failed and native rate remains 3.5!
    assert.strictEqual(video._getNativeRate(), 3.5, 'Coursera reset defeated: native rate remains 3.5');
    console.log(`SUCCESS: Native hardware rate remained ${video._getNativeRate()}x despite Coursera reset attempt!`);
}

console.log('\n--- TEST 3: Virtual Micro-Stepping Acceleration Method ---');
{
    // For DRM / video players where native rate is capped at 1.0x or 2.0x
    const video = new MockMediaElement('video');
    video._setNativeRate(1.0); // Native player capped at 1x
    const targetSpeed = 4.0; // User wants 4x
    
    // Virtual step engine
    function tickVirtualSpeed(media, deltaRealSec, desiredSpeed) {
        const actualRate = media._getNativeRate();
        // Media naturally advanced deltaRealSec * actualRate
        media._currentTime += deltaRealSec * actualRate;
        
        // If desiredSpeed > actualRate, micro-step the difference
        if (desiredSpeed > actualRate && !media.paused && !media.ended) {
            const extraSkip = deltaRealSec * (desiredSpeed - actualRate);
            media._currentTime += extraSkip;
        }
    }

    // Simulate 5 seconds of real-time playback
    const deltaRealSec = 0.5; // tick every 500ms
    for (let t = 0; t < 5.0; t += deltaRealSec) {
        tickVirtualSpeed(video, deltaRealSec, targetSpeed);
    }

    console.log(`Real time elapsed: 5.0s | Video currentTime: ${video._currentTime.toFixed(1)}s (Target: 20.0s for 4x)`);
    assert.strictEqual(Math.round(video._currentTime), 20, 'Virtual speed completed 20s of video in 5s real time (4x speed)');
    console.log('SUCCESS: Virtual Micro-stepping achieves 4x playback even on a 1x-locked player!');
}

console.log('\n--- TEST 4: Audio Element Speed Forcing ---');
{
    const audio = new MockMediaElement('audio');
    const targetSpeed = 2.5;

    // Instance lock on audio
    Object.defineProperty(audio, 'playbackRate', {
        get: () => targetSpeed,
        set: (v) => { originalDescriptor.set.call(audio, targetSpeed); },
        configurable: true
    });

    originalDescriptor.set.call(audio, targetSpeed);
    assert.strictEqual(audio._getNativeRate(), 2.5);

    // Audio narration attempts reset
    audio.playbackRate = 1.0;
    assert.strictEqual(audio._getNativeRate(), 2.5, 'Audio speed lock maintained at 2.5x');
    console.log('SUCCESS: Audio element successfully locked at forced speed!');
}

console.log('\n>>> ALL TEST SUITES PASSED! <<<');
