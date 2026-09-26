const assert = require('assert');

console.log("🧪 TESTING: VIDEO SPEED PLAYBACKRATE SPOOFING & BACKGROUND PLAY TRICK");

// 1. Setup mock environment
let underlyingPlaybackRate = 1.0;
let underlyingDefaultPlaybackRate = 1.0;

class MockHTMLMediaElement {
    constructor() {
        this.preservesPitch = false;
        this.events = {};
    }
    addEventListener(name, handler) {
        if (!this.events[name]) this.events[name] = [];
        this.events[name].push(handler);
    }
    removeEventListener(name, handler) {}
}

const nativeDescriptor = {
    get: function() {
        return underlyingPlaybackRate;
    },
    set: function(val) {
        underlyingPlaybackRate = val;
    },
    configurable: true,
    enumerable: true
};

Object.defineProperty(MockHTMLMediaElement.prototype, 'playbackRate', nativeDescriptor);

global.HTMLMediaElement = MockHTMLMediaElement;
global.Document = class {};
global.document = {
    documentElement: { dataset: { courseraSpeed: '3.0' } },
    querySelectorAll: (sel) => [videoInstance],
    addEventListener: () => {}
};
global.sessionStorage = {
    getItem: (k) => k === 'coursera_speed' ? '3.0' : null,
    setItem: () => {}
};

const messageListeners = [];
global.window = {
    addEventListener: (type, handler) => {
        if (type === 'message') messageListeners.push(handler);
    },
    postMessage: (data) => {
        for (const h of messageListeners) {
            h({ data });
        }
    }
};

const videoInstance = new MockHTMLMediaElement();

// 2. Load main_world.js
require('../main_world.js');

// 3. Test Spoofing when forcedSpeed = 3.0 (> 2.0)
console.log("Testing playbackRate getter spoofing at 3.0x...");
// What Coursera's player reads:
const siteVisibleRate = videoInstance.playbackRate;
assert.strictEqual(siteVisibleRate, 1.0, "Coursera player MUST read 1.0x to prevent speed blocks and errors!");
console.log("✓ Site reads spoofed rate: 1.0x (Coursera is satisfied)");

// What the hardware media player is actually running:
const realNativeRate = nativeDescriptor.get.call(videoInstance);
assert.strictEqual(realNativeRate, 3.0, "Actual underlying media playback must be running at 3.0x!");
console.log("✓ Real underlying hardware playback rate: 3.0x");

// 4. Test Coursera trying to overwrite playbackRate
console.log("Testing setter interception when Coursera tries resetting to 1.0x...");
videoInstance.playbackRate = 1.0;
assert.strictEqual(nativeDescriptor.get.call(videoInstance), 3.0, "Setter must force underlying rate to forcedSpeed (3.0x)!");
assert.strictEqual(videoInstance.playbackRate, 1.0, "Getter must still return 1.0x to site scripts");
console.log("✓ Coursera attempt to reset to 1.0x successfully intercepted and kept at 3.0x.");

// 5. Test IPC message update
console.log("Testing COURSERA_FORCE_SPEED IPC message...");
global.window.postMessage({ type: 'COURSERA_FORCE_SPEED', speed: 4.0, enabled: true });
assert.strictEqual(nativeDescriptor.get.call(videoInstance), 4.0, "Real underlying playback rate must now be 4.0x!");
assert.strictEqual(videoInstance.playbackRate, 1.0, "Getter must still return spoofed 1.0x to site scripts!");
console.log("✓ IPC message updated speed to 4.0x with spoofing intact.");

// 6. Test disabling speed injection
console.log("Testing disabling speed injection...");
global.window.postMessage({ type: 'COURSERA_FORCE_SPEED', speed: 1.0, enabled: false });
assert.strictEqual(nativeDescriptor.get.call(videoInstance), 1.0, "Real underlying playback rate must revert to 1.0x when disabled!");
console.log("✓ Disabling speed injection cleanly reverts to native 1.0x.");

console.log("\n🎉 ALL VIDEO SPEED SPOOFING TESTS PASSED 100%!");
process.exit(0);
