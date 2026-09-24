// Test Suite: Full End-to-End Simulation of Coursera Video & Audio Player
// with Multi-Layer Speed Forcer (Prototype + Instance + Event Trap + Smart Drift Assist)

const assert = require('assert');

class SimulatedCourseraVideo {
    constructor() {
        this.tagName = 'VIDEO';
        this._nativeRate = 1.0;
        this.currentTime = 0;
        this.duration = 600; // 10 minutes
        this.paused = false;
        this.ended = false;
        this.listeners = { capture: {}, bubble: {} };
    }

    addEventListener(type, fn, capture = false) {
        const bucket = capture ? this.listeners.capture : this.listeners.bubble;
        if (!bucket[type]) bucket[type] = [];
        bucket[type].push(fn);
    }

    dispatchEvent(event) {
        // Capture phase
        const cap = this.listeners.capture[event.type] || [];
        for (const fn of cap) {
            if (event._stopped) break;
            fn.call(this, event);
        }
        // Bubble phase
        if (!event._stopped) {
            const bub = this.listeners.bubble[event.type] || [];
            for (const fn of bub) {
                if (event._stopped) break;
                fn.call(this, event);
            }
        }
    }

    _nativeSetRate(r) {
        this._nativeRate = r;
        const evt = {
            type: 'ratechange',
            target: this,
            _stopped: false,
            stopImmediatePropagation() { this._stopped = true; }
        };
        this.dispatchEvent(evt);
    }

    _nativeGetRate() {
        return this._nativeRate;
    }
}

// 1. Setup Prototype
const nativeDescriptor = {
    get: function() { return this._nativeGetRate(); },
    set: function(val) { this._nativeSetRate(Number(val) || 1.0); },
    configurable: true,
    enumerable: true
};
Object.defineProperty(SimulatedCourseraVideo.prototype, 'playbackRate', nativeDescriptor);

console.log('--- TEST E2E: Testing Multi-Layer Speed Forcer on Hostile Coursera Player ---');

// Hostile Coursera Player setup
const video = new SimulatedCourseraVideo();

// Coursera player attaches its internal ratechange monitor
let resetAttempts = 0;
video.addEventListener('ratechange', function() {
    // Coursera sees rate change and tries to force it back to 1.0!
    resetAttempts++;
    this.playbackRate = 1.0;
}, false);

// EXTENSION INJECTION (simulating main_world.js v8.7)
let targetSpeed = 4.0;
let forceMode = 'hybrid';
let isInternalSetting = false;

// 1. Prototype Monkey-Patch
Object.defineProperty(SimulatedCourseraVideo.prototype, 'playbackRate', {
    configurable: true,
    enumerable: true,
    get: function() {
        return targetSpeed;
    },
    set: function(val) {
        if (forceMode !== 'virtual') {
            nativeDescriptor.set.call(this, targetSpeed);
        } else {
            nativeDescriptor.set.call(this, val);
        }
    }
});

// 2. Event Capture Shield
video.addEventListener('ratechange', function(e) {
    if (isInternalSetting) {
        e.stopImmediatePropagation();
        return;
    }
    // Prevent site listeners from firing
    e.stopImmediatePropagation();
}, true);

// 3. Instance Hook
Object.defineProperty(video, 'playbackRate', {
    configurable: true,
    enumerable: true,
    get: () => targetSpeed,
    set: (v) => {
        if (forceMode !== 'virtual') {
            isInternalSetting = true;
            nativeDescriptor.set.call(video, targetSpeed);
            isInternalSetting = false;
        }
    }
});

// 4. Apply initial speed
isInternalSetting = true;
nativeDescriptor.set.call(video, targetSpeed);
isInternalSetting = false;

// Verification:
console.log(`Initial Native Rate: ${video._nativeGetRate()}x | Expected: ${targetSpeed}x`);
assert.strictEqual(video._nativeGetRate(), targetSpeed);
assert.strictEqual(resetAttempts, 0, 'Coursera ratechange handler was completely blocked from firing');

// Simulate Coursera script trying to do: video.playbackRate = 1.0
video.playbackRate = 1.0;
console.log(`Native Rate after Coursera tried setting 1.0: ${video._nativeGetRate()}x`);
assert.strictEqual(video._nativeGetRate(), targetSpeed, 'Coursera reset attempt was thwarted');

// 5. Test Smart Micro-Step Assist when DRM/Codec caps hardware rate at 1.0x
console.log('\n--- TEST E2E: Smart Micro-Step Assist when Hardware is Capped at 1.0x ---');
const drmVideo = new SimulatedCourseraVideo();
drmVideo._nativeSetRate(1.0); // Hardware caps at 1.0x

// Tracker
let tracker = { lastTime: 0, lastTimestamp: 0 };
function simulatePlaybackTick(media, realTimeElapsed, desiredSpeed) {
    // Normal 1x playback advancement
    media.currentTime += realTimeElapsed * media._nativeGetRate();
    
    // Smart Assist:
    const deltaRealSec = realTimeElapsed;
    const deltaVideoSec = media.currentTime - tracker.lastTime;
    const expected = deltaRealSec * desiredSpeed;
    const lag = expected - deltaVideoSec;
    
    if (lag > 0.01) {
        media.currentTime += lag;
    }
    tracker.lastTime = media.currentTime;
}

tracker.lastTime = drmVideo.currentTime;
// Simulate 10 seconds of playback in 1-second ticks
for (let s = 1; s <= 10; s++) {
    simulatePlaybackTick(drmVideo, 1.0, 4.0);
}

console.log(`DRM Video currentTime after 10 real seconds: ${drmVideo.currentTime}s | Target: 40s (4x)`);
assert.strictEqual(drmVideo.currentTime, 40, 'Smart Assist achieved 4x speed despite 1x DRM lock');

console.log('\n>>> ALL END-TO-END TESTS PASSED SUCCESSFULLY! <<<');
