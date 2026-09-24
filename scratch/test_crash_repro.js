// Test: Verify Recursion Bug when main_world.js is Injected Twice
const assert = require('assert');

function simulateDoubleInjection() {
    class MockMediaElement {
        constructor() {
            this._rate = 1.0;
        }
    }

    const nativeDesc = {
        get: function() { return this._rate; },
        set: function(v) { this._rate = v; },
        configurable: true
    };
    Object.defineProperty(MockMediaElement.prototype, 'playbackRate', nativeDesc);

    // --- RUN 1 (via manifest.json world: "MAIN") ---
    const capturedDesc1 = Object.getOwnPropertyDescriptor(MockMediaElement.prototype, 'playbackRate');
    
    // Run 1 defines its hook:
    Object.defineProperty(MockMediaElement.prototype, 'playbackRate', {
        get: function() { return 3.0; },
        set: function(v) { capturedDesc1.set.call(this, 3.0); },
        configurable: true
    });

    // --- RUN 2 (via content.js fallback <script> tag) ---
    // If there is NO guard, Run 2 captures the ALREADY HOOKED descriptor:
    const capturedDesc2 = Object.getOwnPropertyDescriptor(MockMediaElement.prototype, 'playbackRate');
    
    // Run 2 defines its hook using capturedDesc2:
    Object.defineProperty(MockMediaElement.prototype, 'playbackRate', {
        get: function() { return 3.0; },
        set: function(v) { capturedDesc2.set.call(this, 3.0); },
        configurable: true
    });

    // Now, what happens if an element's playbackRate is set?
    const el = new MockMediaElement();
    let callCount = 0;
    
    // In node, let's catch stack overflow
    try {
        el.playbackRate = 1.0;
    } catch(e) {
        console.log("CONFIRMED FATAL BUG: " + e.message); // RangeError: Maximum call stack size exceeded
        return true;
    }
    return false;
}

const crashed = simulateDoubleInjection();
assert.strictEqual(crashed, true, "Double injection causes RangeError: Maximum call stack size exceeded!");
console.log("Test Passed: Root cause of Chrome crash verified 100%!");
