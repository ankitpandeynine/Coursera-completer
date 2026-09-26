const assert = require('assert');

// Mock HTMLMediaElement simulation
class MockMediaElement {
    constructor() {
        this._nativePlaybackRate = 1.0;
        this.readyState = 4;
        this.paused = false;
        this.ended = false;
        this.duration = 100;
        this.currentTime = 10;
        this.seeking = false;
    }
}

// Emulate Main World speed engine with enable/disable toggle
function createMockSpeedEngine() {
    let speedInjectionEnabled = true;
    let targetSpeed = 3.0;
    let forceMode = 'hybrid';

    const mediaList = [new MockMediaElement(), new MockMediaElement()];

    function setNativeRate(media, rate) {
        media._nativePlaybackRate = rate;
    }

    const engine = {
        setEnabled(enabled) {
            speedInjectionEnabled = !!enabled;
            for (const m of mediaList) {
                if (!speedInjectionEnabled) {
                    setNativeRate(m, 1.0);
                } else if (forceMode !== 'virtual') {
                    setNativeRate(m, targetSpeed);
                }
            }
        },
        set(speed, mode, enabled) {
            if (enabled !== undefined) speedInjectionEnabled = !!enabled;
            targetSpeed = speed;
            if (mode) forceMode = mode;
            for (const m of mediaList) {
                if (!speedInjectionEnabled) {
                    setNativeRate(m, 1.0);
                } else if (forceMode !== 'virtual') {
                    setNativeRate(m, targetSpeed);
                }
            }
        },
        isEnabled() { return speedInjectionEnabled; },
        getSpeed() { return targetSpeed; },
        getMediaRate(index) { return mediaList[index]._nativePlaybackRate; },
        handlePropertyGet(media) {
            if (!speedInjectionEnabled) return media._nativePlaybackRate;
            return targetSpeed;
        },
        handlePropertySet(media, val) {
            if (!speedInjectionEnabled) {
                setNativeRate(media, val);
                return;
            }
            setNativeRate(media, targetSpeed);
        }
    };

    return { engine, mediaList };
}

console.log("================================================================");
console.log("🧪 TESTING: VIDEO SPEED INJECTION ON/OFF TOGGLE ENGINE");
console.log("================================================================");

const { engine, mediaList } = createMockSpeedEngine();

// Test 1: Initial state is enabled at 3x
engine.set(3.0, 'hybrid', true);
assert.strictEqual(engine.isEnabled(), true, "Speed injection should be enabled");
assert.strictEqual(engine.getMediaRate(0), 3.0, "Media 0 rate should be 3.0");
assert.strictEqual(engine.handlePropertyGet(mediaList[0]), 3.0, "Property get should return 3.0");
console.log("✓ Test 1: Enabled speed injection enforces target speed (3.0x).");

// Test 2: Toggle OFF speed injection
engine.setEnabled(false);
assert.strictEqual(engine.isEnabled(), false, "Speed injection should be disabled");
assert.strictEqual(engine.getMediaRate(0), 1.0, "Media 0 rate should immediately revert to native 1.0");
assert.strictEqual(engine.getMediaRate(1), 1.0, "Media 1 rate should immediately revert to native 1.0");
assert.strictEqual(engine.handlePropertyGet(mediaList[0]), 1.0, "Property get should return native 1.0");

// Test 3: Player sets speed to 1.5 while injection is OFF
engine.handlePropertySet(mediaList[0], 1.5);
assert.strictEqual(engine.getMediaRate(0), 1.5, "Media rate should allow native player 1.5x when toggle is OFF");
assert.strictEqual(engine.handlePropertyGet(mediaList[0]), 1.5, "Property get should return 1.5x when toggle is OFF");
console.log("✓ Test 2 & 3: Toggling OFF immediately restores native 1.0x and permits site player rate changes without override.");

// Test 4: Toggle back ON
engine.setEnabled(true);
assert.strictEqual(engine.isEnabled(), true, "Speed injection should be re-enabled");
assert.strictEqual(engine.getMediaRate(0), 3.0, "Media rate should immediately re-apply target speed 3.0x");
assert.strictEqual(engine.handlePropertyGet(mediaList[0]), 3.0, "Property get should return target speed 3.0x");
console.log("✓ Test 4: Toggling back ON immediately re-applies target speed (3.0x).");

console.log("================================================================");
console.log("🎉 ALL SPEED INJECTION TOGGLE TESTS PASSED 100%!");
console.log("================================================================");
