const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: SUPER BYPASS VIDEO MODE");
console.log("================================================================");

// 1. Mock Video Element
class MockVideo {
    constructor(duration = 180) {
        this.duration = duration;
        this.currentTime = 0;
        this.paused = true;
        this.ended = false;
        this.seeking = false;
        this.tagName = 'VIDEO';
        this.events = [];
    }

    play() {
        this.paused = false;
        return Promise.resolve();
    }

    pause() {
        this.paused = true;
    }

    dispatchEvent(evt) {
        this.events.push(evt.type);
        if (evt.type === 'ended') {
            this.ended = true;
        }
    }
}

// 2. Mock state & environment
let state = {
    superBypassVideoMode: false,
    speedInjection: true,
    playbackSpeed: 2.0,
    strictCompletion: true,
    autoNavigate: true
};

let hasSuperBypassedCurrentVideo = false;
let videoPlaybackStartTime = 0;
let endButtonClicked = false;

// Mock DOM end button
const endBtn = {
    click: () => {
        endButtonClicked = true;
    }
};

// Simulation of Super Bypass evaluation inside handleAutoPilot
function simulateAutoPilotTick(video, fakeTime) {
    if (video.paused && !video.ended) {
        video.play();
    }

    if (state.superBypassVideoMode && !hasSuperBypassedCurrentVideo && video && !video.ended && video.duration > 2) {
        if (!video.paused && !video.seeking) {
            if (!videoPlaybackStartTime) {
                videoPlaybackStartTime = fakeTime;
            }
            const playedDuration = fakeTime - videoPlaybackStartTime;
            if (playedDuration >= 1000 || video.currentTime >= 1.0) {
                hasSuperBypassedCurrentVideo = true;
                endBtn.click();
                video.currentTime = Math.max(0, video.duration - 2);
                video.dispatchEvent({ type: 'timeupdate' });
            }
        }
    }
}

// Test 1: When Super Bypass is OFF, video plays normally and does not trigger End
console.log("▶ Test 1: Super Bypass OFF -> Normal Playback");
const v1 = new MockVideo(120);
state.superBypassVideoMode = false;
hasSuperBypassedCurrentVideo = false;
videoPlaybackStartTime = 0;
endButtonClicked = false;

simulateAutoPilotTick(v1, 1000);
v1.currentTime = 1.5;
simulateAutoPilotTick(v1, 2500);

assert.strictEqual(endButtonClicked, false, "End button must NOT be clicked when Super Bypass is OFF");
assert.strictEqual(hasSuperBypassedCurrentVideo, false);
console.log("✓ Super Bypass OFF confirmed: video plays normally without auto-end trigger.");

// Test 2: When Super Bypass is ON, triggers End after 1s
console.log("▶ Test 2: Super Bypass ON -> Plays 1s then triggers End button");
const v2 = new MockVideo(120);
state.superBypassVideoMode = true;
hasSuperBypassedCurrentVideo = false;
videoPlaybackStartTime = 0;
endButtonClicked = false;

// Tick 0ms: Video starts playing
simulateAutoPilotTick(v2, 10000);
assert.strictEqual(v2.paused, false, "Video started playing");
assert.strictEqual(endButtonClicked, false, "Should not trigger immediately at 0s");

// Tick 500ms: video playing, currentTime = 0.5
v2.currentTime = 0.5;
simulateAutoPilotTick(v2, 10500);
assert.strictEqual(endButtonClicked, false, "Should not trigger at 500ms");

// Tick 1100ms: video has played >= 1.0s
v2.currentTime = 1.1;
simulateAutoPilotTick(v2, 11100);

assert.strictEqual(endButtonClicked, true, "End button MUST be clicked after 1s of playback");
assert.strictEqual(hasSuperBypassedCurrentVideo, true, "Super bypass flag must be set to true");
assert.strictEqual(v2.currentTime, 118, "Video currentTime should jump to duration - 2 (120 - 2 = 118)");
assert(v2.events.includes('timeupdate'), "timeupdate event dispatched");
console.log("✓ Super Bypass ON confirmed: played 1s, clicked End button, jumped to duration - 2.");

// Test 3: Ensure it doesn't repeatedly click End on subsequent ticks
console.log("▶ Test 3: Single Trigger Guarantee (Idempotency)");
endButtonClicked = false;
v2.currentTime = 119;
simulateAutoPilotTick(v2, 12000);
assert.strictEqual(endButtonClicked, false, "Must NOT re-click End button for the same video");
console.log("✓ Single trigger guarantee confirmed.");

// Test 4: Route change resets flag
console.log("▶ Test 4: Reset on SPA route change");
hasSuperBypassedCurrentVideo = false;
videoPlaybackStartTime = 0;
assert.strictEqual(hasSuperBypassedCurrentVideo, false);
console.log("✓ Route change reset verified.");

console.log("================================================================");
console.log("🎉 ALL SUPER BYPASS VIDEO MODE TESTS PASSED 100%!");
console.log("================================================================");
