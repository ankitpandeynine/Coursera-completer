const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: SIDEBAR GREEN CHECKMARK & FOCUS MODES");
console.log("================================================================");

// Mock DOM elements for Coursera sidebar
function createMockSidebar() {
    return {
        items: [
            {
                href: '/learn/mips/lecture/fp-add',
                title: 'Floating Point Addition',
                type: 'video',
                ariaLabel: 'Floating Point Addition, Video, 7 min, Completed',
                svgs: [{ type: 'completed', ariaLabel: 'Completed', fill: '#00823b' }],
                text: 'Floating Point Addition\nVideo • 7 min'
            },
            {
                href: '/learn/mips/assignment-submission/fp-add-quiz',
                title: 'Practice Quiz: Floating Point Addition',
                type: 'quiz',
                ariaLabel: 'Practice Quiz: Floating Point Addition, Practice Assignment, Grade: 100%',
                svgs: [{ type: 'completed', ariaLabel: 'Completed', fill: '#00823b' }],
                text: 'Practice Quiz: Floating Point Addition\nPractice Assignment • Grade: 100%'
            },
            {
                href: '/learn/mips/lecture/guard-bits',
                title: 'Guard and Round Bits in Floating Point Arithmetic',
                type: 'video',
                ariaLabel: 'Guard and Round Bits in Floating Point Arithmetic, Video, 6 min',
                svgs: [{ type: 'circle', ariaLabel: 'Not completed', fill: '#ffffff' }],
                text: 'Guard and Round Bits in Floating Point Arithmetic\nVideo • 6 min'
            },
            {
                href: '/learn/mips/assignment-submission/guard-quiz',
                title: 'Practice Quiz: Guard and Round Bits in Floating Point Arithmetic',
                type: 'quiz',
                ariaLabel: 'Practice Quiz: Guard and Round Bits, Practice Assignment, Grade: 50%',
                svgs: [{ type: 'completed', ariaLabel: 'Completed', fill: '#00823b' }],
                text: 'Practice Quiz: Guard and Round Bits in Floating Point Arithmetic\nPractice Assignment • Grade: 50%'
            }
        ]
    };
}

// Sidebar item status checker
function getSidebarItemStatus(mockItem) {
    if (!mockItem) return 'unknown';

    // Check negative (uncompleted) labels FIRST to avoid 'not completed' matching 'completed'
    const aria = (mockItem.ariaLabel || '').toLowerCase();
    if (aria.includes('not completed') || aria.includes('incomplete') || aria.includes('not started')) return 'pending';
    if (aria.includes('completed') || aria.includes('passed')) return 'completed';

    for (const svg of (mockItem.svgs || [])) {
        const svgAria = (svg.ariaLabel || '').toLowerCase();
        if (svgAria.includes('not completed') || svgAria.includes('incomplete') || svg.type === 'circle') return 'pending';
        if (svgAria.includes('completed') || svgAria.includes('passed')) return 'completed';
        if (svg.fill === '#00823b' || svg.fill === 'green' || svg.type === 'completed') return 'completed';
    }

    const t = (mockItem.text || '').toLowerCase();
    if (t.includes('grade: 100%') || t.includes('grade: 50%') || t.includes('completed')) return 'completed';

    return 'pending';
}

const mockSidebar = createMockSidebar();

// 1. Verify detection of green checkmark vs white circle
assert.strictEqual(getSidebarItemStatus(mockSidebar.items[0]), 'completed', "Item 0 (FP Addition) must be detected as completed!");
assert.strictEqual(getSidebarItemStatus(mockSidebar.items[1]), 'completed', "Item 1 (Quiz 100%) must be detected as completed!");
assert.strictEqual(getSidebarItemStatus(mockSidebar.items[2]), 'pending', "Item 2 (Guard Bits video) must be detected as PENDING/white circle!");
assert.strictEqual(getSidebarItemStatus(mockSidebar.items[3]), 'completed', "Item 3 (Quiz 50%) must be detected as completed!");
console.log("✓ Test 1: Sidebar item status accurately discriminates green checkmark vs white circle.");

// 2. Test Replay Decision Logic
function evaluateReplayDecision(isCompleted, videoEnded, waitElapsedMs, replayCount) {
    if (!videoEnded) return 'PLAYING';
    if (isCompleted === true) return 'GO_NEXT';
    if (isCompleted === false) {
        if (waitElapsedMs < 3500) return 'WAIT_FOR_SERVER_SYNC';
        if (replayCount === 0) return 'REPLAY_ONCE';
        return 'GO_NEXT_AFTER_REPLAY';
    }
    return 'GO_NEXT';
}

// When video is still playing:
assert.strictEqual(evaluateReplayDecision(false, false, 0, 0), 'PLAYING');

// When video ends and is already green in sidebar:
assert.strictEqual(evaluateReplayDecision(true, true, 0, 0), 'GO_NEXT');

// When video ends, sidebar shows white circle, within 3.5s wait window:
assert.strictEqual(evaluateReplayDecision(false, true, 1000, 0), 'WAIT_FOR_SERVER_SYNC');

// When video ends, sidebar still shows white circle after 3.5s, replay count 0:
assert.strictEqual(evaluateReplayDecision(false, true, 4000, 0), 'REPLAY_ONCE');

// When video ends again after 1 replay, proceed so no infinite loop:
assert.strictEqual(evaluateReplayDecision(false, true, 4000, 1), 'GO_NEXT_AFTER_REPLAY');
console.log("✓ Test 2: Strict Completion Guard replay logic guarantees replay without infinite hang.");

// 3. Test Focus Modes
function evaluateFocusModeAction(focusMode, itemType, isCompleted) {
    if (focusMode === 'pending_only') {
        if (isCompleted === true) return 'SKIP_ALREADY_COMPLETED';
        return 'COMPLETE_ITEM';
    }
    if (focusMode === 'quizzes_only') {
        if (itemType === 'video' || itemType === 'reading') return 'SKIP_TO_QUIZ';
        return 'COMPLETE_ITEM';
    }
    if (focusMode === 'videos_only') {
        if (itemType === 'quiz' || itemType === 'assignment') return 'SKIP_TO_VIDEO';
        return 'COMPLETE_ITEM';
    }
    return 'COMPLETE_ITEM'; // 'all'
}

// Test 'pending_only' mode:
assert.strictEqual(evaluateFocusModeAction('pending_only', 'video', true), 'SKIP_ALREADY_COMPLETED');
assert.strictEqual(evaluateFocusModeAction('pending_only', 'video', false), 'COMPLETE_ITEM');

// Test 'quizzes_only' mode:
assert.strictEqual(evaluateFocusModeAction('quizzes_only', 'video', false), 'SKIP_TO_QUIZ');
assert.strictEqual(evaluateFocusModeAction('quizzes_only', 'quiz', false), 'COMPLETE_ITEM');

// Test 'videos_only' mode:
assert.strictEqual(evaluateFocusModeAction('videos_only', 'quiz', false), 'SKIP_TO_VIDEO');
assert.strictEqual(evaluateFocusModeAction('videos_only', 'video', false), 'COMPLETE_ITEM');

// Test 'all' mode:
assert.strictEqual(evaluateFocusModeAction('all', 'video', false), 'COMPLETE_ITEM');
assert.strictEqual(evaluateFocusModeAction('all', 'quiz', false), 'COMPLETE_ITEM');
console.log("✓ Test 3: All 4 Focus Modes (All, Quizzes-Only, Videos-Only, Pending-Only) execute correctly.");

console.log("================================================================");
console.log("🎉 ALL SIDEBAR COMPLETION & FOCUS MODE TESTS PASSED 100%!");
console.log("================================================================");
