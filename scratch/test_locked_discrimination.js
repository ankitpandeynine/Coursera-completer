const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: LOCKED ITEM DISCRIMINATION & 20s TIMEOUT LOGIC");
console.log("================================================================");

// Case 1: Normal quiz page with sidebar lock icons (representing earlier problem)
const normalQuizWithSidebarLocks = {
    mainText: "Practice Quiz: Standard Performance Evaluation Corporation (SPEC) Benchmarks\n1. Consider the following performance measurements...",
    sidebarText: "Discussion and Assessment\nPerformance Detective: Analyzing Real-World Computing Scenarios\nTest Yourself: Computer System Performance [Locked icon]",
    quizInputs: [{ type: 'radio', value: 'Option A', checked: false }],
    hasStartButton: false
};

// Case 2: Normal quiz cover page with "Start assignment"
const normalQuizCover = {
    mainText: "Practice Quiz: Instruction Set Architecture\nPractice Assignment • 30 min\nKeep learning by starting your assignment.",
    sidebarText: "Module 2 [Locked icon]",
    quizInputs: [],
    hasStartButton: true
};

// Case 3: Genuine Screenshot 4 locked assignment
const screenshot4LockedAssignment = {
    mainText: "Test Yourself: Computer System Performance and Its Measurement\nDeadline: Oct 7, 11:59 PM IST\nYou still have some learning to complete\nThis item is locked until you complete all prior content in this module.\nTo continue learning, go back to where you left off.",
    sidebarText: "Test Yourself [Locked icon]",
    quizInputs: [],
    hasStartButton: false
};

// Test implementation of isItemLockedPage
function testIsItemLockedPage(mock) {
    if (mock.quizInputs.length > 0) return false;
    if (mock.hasStartButton) return false;

    // Check main text specifically (excluding sidebar)
    const text = mock.mainText.toLowerCase();
    const hasLockedHeading = text.includes("you still have some learning to complete");
    const hasLockedModuleMsg = text.includes("this item is locked until you complete all prior content");
    const hasLockedGoBack = text.includes("this item is locked") && text.includes("go back to where you left off");

    return hasLockedHeading || hasLockedModuleMsg || hasLockedGoBack;
}

// 1. Normal quiz with questions should NEVER be locked
assert.strictEqual(testIsItemLockedPage(normalQuizWithSidebarLocks), false, "Normal quiz with questions must NOT be locked!");
console.log("✓ Test 1: Normal quiz with questions is not locked (sidebar locks ignored).");

// 2. Normal quiz cover with Start button should NEVER be locked
assert.strictEqual(testIsItemLockedPage(normalQuizCover), false, "Normal quiz cover with start button must NOT be locked!");
console.log("✓ Test 2: Quiz cover with Start button is not locked.");

// 3. Screenshot 4 locked page MUST be recognized
assert.strictEqual(testIsItemLockedPage(screenshot4LockedAssignment), true, "Screenshot 4 locked page MUST be recognized as locked!");
console.log("✓ Test 3: Screenshot 4 locked banner ('You still have some learning to complete') recognized as locked.");

// 4. Test 20-second timeout decision
function evaluateQuizWaitOrSkip(timeOnPageMs, isLocked) {
    if (isLocked) return 'SKIP_LOCKED';
    if (timeOnPageMs < 20000) return 'WAIT_FOR_QUESTIONS';
    return 'SKIP_TIMEOUT_20S';
}

assert.strictEqual(evaluateQuizWaitOrSkip(5000, false), 'WAIT_FOR_QUESTIONS', "Under 20s must wait for questions to load.");
assert.strictEqual(evaluateQuizWaitOrSkip(15000, false), 'WAIT_FOR_QUESTIONS', "15s must still wait for questions to load.");
assert.strictEqual(evaluateQuizWaitOrSkip(21000, false), 'SKIP_TIMEOUT_20S', "After 20s must skip if questions never open.");
assert.strictEqual(evaluateQuizWaitOrSkip(1000, true), 'SKIP_LOCKED', "Screenshot 4 image-style lock skips immediately without waiting 20s.");
console.log("✓ Test 4: 20-second timeout waits when loading and only skips after 20s.");

console.log("================================================================");
console.log("🎉 ALL LOCKED DISCRIMINATION & TIMEOUT TESTS PASSED 100%!");
console.log("================================================================");
