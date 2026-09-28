const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: VIDEO GREEN TICK & SIDEBAR ACCURACY");
console.log("================================================================");

// 1. URL key extractor
function extractCourseItemKey(urlOrPath) {
    if (!urlOrPath) return '';
    try {
        const path = (urlOrPath.includes('://') ? new URL(urlOrPath).pathname : urlOrPath).toLowerCase();
        const m = path.match(/\/(lecture|supplement|assignment-submission|exam|quiz|discussionprompt|graded-assignment|ungradedlti|reading|coach|dialogue|item|peer)\/([a-z0-9_-]+)/i);
        if (m) {
            return `${m[1]}/${m[2]}`.toLowerCase();
        }
    } catch(e) {}
    return '';
}

assert.strictEqual(extractCourseItemKey('/learn/deep-learning/lecture/3V9sA/what-is-dl'), 'lecture/3v9sa');
assert.strictEqual(extractCourseItemKey('https://www.coursera.org/learn/deep-learning/lecture/3v9sa'), 'lecture/3v9sa');
assert.strictEqual(extractCourseItemKey('/learn/deep-learning'), '');
assert.strictEqual(extractCourseItemKey('/learn/deep-learning/quiz/xyz12/quiz-1'), 'quiz/xyz12');
console.log("✓ extractCourseItemKey works accurately.");

// 2. Sidebar Item Status Checker Simulation
function getSidebarItemStatusMock(item) {
    if (!item) return 'unknown';

    const aria = (item.ariaLabel || '').toLowerCase();
    if (aria.includes('not completed') || aria.includes('incomplete') || aria.includes('not started') ||
        aria.includes('in progress') || aria.includes('failed') || aria.includes('try again') || aria.includes('grade: 0%')) {
        return 'pending';
    }

    for (const svg of (item.svgs || [])) {
        const svgAria = (svg.ariaLabel || '').toLowerCase();
        const svgTitle = (svg.title || '').toLowerCase();
        const combined = `${svgAria} ${svgTitle}`;

        if (combined.includes('not completed') || combined.includes('incomplete') || combined.includes('not started') || combined.includes('failed')) {
            return 'pending';
        }

        if (svg.isCircle && !svg.isCheckmark && !svg.isGreen) {
            return 'pending';
        }

        if (combined.includes('completed') || combined.includes('passed') || svg.isGreen || svg.isCheckmark) {
            return 'completed';
        }
    }

    if (aria.includes('completed') || aria.includes('passed')) {
        return 'completed';
    }

    if (item.hasCompletedBadge) return 'completed';

    const text = (item.text || '').toLowerCase();
    if (text.includes('grade: 100%') || text.includes('grade: 9') || text.includes('passed')) {
        if (!text.includes('not completed') && !text.includes('incomplete')) {
            return 'completed';
        }
    }

    return 'pending';
}

// Test case A: Incomplete item with data-testid="item-completion-icon" and grey circle
const incompleteItemWithIconContainer = {
    ariaLabel: 'Video 1: Overview, 5 min',
    svgs: [{ isCircle: true, isCheckmark: false, isGreen: false, ariaLabel: '' }],
    text: 'Video 1: Overview\n5 min'
};
assert.strictEqual(getSidebarItemStatusMock(incompleteItemWithIconContainer), 'pending', "Incomplete video with empty circle must be pending!");

// Test case B: Incomplete item with explicit 'Not completed' aria label
const incompleteItemWithAria = {
    ariaLabel: 'Video 2: Architecture, 10 min, Not completed',
    svgs: [],
    text: 'Video 2: Architecture\n10 min'
};
assert.strictEqual(getSidebarItemStatusMock(incompleteItemWithAria), 'pending', "Item with Not completed in aria must be pending!");

// Test case C: Completed item with green checkmark
const completedItemGreenSvg = {
    ariaLabel: 'Video 3: Loss Function, 8 min, Completed',
    svgs: [{ isCircle: false, isCheckmark: true, isGreen: true, ariaLabel: 'Completed' }],
    text: 'Video 3: Loss Function\n8 min'
};
assert.strictEqual(getSidebarItemStatusMock(completedItemGreenSvg), 'completed', "Completed item with green checkmark must be completed!");

console.log("✓ Sidebar item status detection accurately discriminates incomplete vs completed.");

// 3. Test video completion and replay decision logic
function evaluateVideoAction({ duration, currentTime, ended, isCompleted, waitElapsed, reattempts }) {
    const isNearEnd = duration > 0 && (currentTime >= duration - 0.5 || ended);
    
    // Early skip check (requires >= 80% duration)
    if (!isNearEnd && duration > 0 && currentTime >= 15 && (currentTime >= duration * 0.80)) {
        if (isCompleted === true) {
            return 'EARLY_SKIP';
        }
    }

    if (!isNearEnd) {
        return 'KEEP_PLAYING';
    }

    // Video is at end
    if (isCompleted === true) {
        return 'GO_NEXT';
    }

    // Waiting for server sync (up to 5s)
    if (waitElapsed < 5000) {
        return 'WAIT_FOR_SYNC';
    }

    // 5s passed and not completed
    if (reattempts === 0) {
        return 'REPLAY_ONCE';
    }

    return 'PROCEED_AFTER_REPLAY';
}

// Scenario 1: Video just started (0s)
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 0, ended: false, isCompleted: false, waitElapsed: 0, reattempts: 0 }), 'KEEP_PLAYING');

// Scenario 2: Video at 15s (incomplete)
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 15, ended: false, isCompleted: false, waitElapsed: 0, reattempts: 0 }), 'KEEP_PLAYING');

// Scenario 3: Video at 40s out of 300s (even if false positive was present, currentTime < 80%)
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 40, ended: false, isCompleted: true, waitElapsed: 0, reattempts: 0 }), 'KEEP_PLAYING');

// Scenario 4: Video at 250s out of 300s (83%) and green tick confirmed early
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 250, ended: false, isCompleted: true, waitElapsed: 0, reattempts: 0 }), 'EARLY_SKIP');

// Scenario 5: Video finished (300s), green tick confirmed immediately
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 300, ended: true, isCompleted: true, waitElapsed: 100, reattempts: 0 }), 'GO_NEXT');

// Scenario 6: Video finished, green tick not synced yet, 2 seconds elapsed
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 300, ended: true, isCompleted: false, waitElapsed: 2000, reattempts: 0 }), 'WAIT_FOR_SYNC');

// Scenario 7: Video finished, green tick not synced after 5s, reattempts = 0 -> Replay once!
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 300, ended: true, isCompleted: false, waitElapsed: 5100, reattempts: 0 }), 'REPLAY_ONCE');

// Scenario 8: Video replayed once, finished again, still no green tick after 5s -> Proceed safely
assert.strictEqual(evaluateVideoAction({ duration: 300, currentTime: 300, ended: true, isCompleted: false, waitElapsed: 5100, reattempts: 1 }), 'PROCEED_AFTER_REPLAY');

console.log("✓ All video playback, early skip, sync wait, and soft replay rules passed 100%!");
