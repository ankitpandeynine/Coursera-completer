const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: TEXT FIELD QUESTIONS, DIALOGUE MULTI-TURN & WATCHDOG");
console.log("================================================================");

// 1. Test Free-Text Input Detection and Prompt Generation
function buildQuestionPrompt(q, idx) {
    let p = `=== QUESTION ${idx} ===\n`;
    if (q.type === 'text') {
        p += `Type: text_input (type the exact word, number, or short phrase required)\n`;
        p += `Prompt: ${q.context || 'Enter the correct answer'}\n`;
        p += `Options: None (Free-text input field)\n`;
    } else if (q.type === 'checkbox') {
        p += `Type: multiple_choice (select all that apply)\n`;
        p += `Prompt: ${q.context}\n`;
        p += `Options:\n`;
        q.options.forEach((opt, oIdx) => { p += `[Index ${oIdx}]: ${opt.text}\n`; });
    } else {
        p += `Type: single_choice (select exactly one)\n`;
        p += `Prompt: ${q.context}\n`;
        p += `Options:\n`;
        q.options.forEach((opt, oIdx) => { p += `[Index ${oIdx}]: ${opt.text}\n`; });
    }
    return p;
}

const mockQ5 = {
    type: 'text',
    isText: true,
    context: 'What is the term for a component that performs arithmetic operations in a CPU? Please answer in all lowercase.',
    options: []
};

const q5Prompt = buildQuestionPrompt(mockQ5, 4);
assert.ok(q5Prompt.includes('Type: text_input'), "Q5 must be identified as text_input");
assert.ok(q5Prompt.includes('arithmetic operations in a CPU'), "Q5 context must be present");
console.log("✓ Test 1: Free-text question format in AI prompt verified.");

// 2. Test Text Input Answer Resolution & Lowercase Handling
function resolveTextAnswer(ans, context) {
    let ansText = '';
    if (ans.answerTexts && ans.answerTexts.length > 0) {
        ansText = String(ans.answerTexts[0]).trim();
    } else if (typeof ans.answer === 'string') {
        ansText = ans.answer.trim();
    } else if (typeof ans.text === 'string') {
        ansText = ans.text.trim();
    }
    ansText = ansText.replace(/^["']|["']$/g, '');
    if (context && context.toLowerCase().includes('all lowercase')) {
        ansText = ansText.toLowerCase();
    }
    return ansText;
}

const mockAiAns = {
    id: 4,
    rationale: "The component within a CPU that performs arithmetic and logic operations is the arithmetic logic unit (or alu).",
    answerIndices: [0],
    answerTexts: ["ALU"]
};

const resolvedText = resolveTextAnswer(mockAiAns, mockQ5.context);
assert.strictEqual(resolvedText, 'alu', "Should resolve to 'alu' in lowercase per prompt instructions");
console.log("✓ Test 2: Free-text answer resolution and lowercase normalization verified.");

// 3. Test Dialogue Protection Against Quiz Solver Hijacking
function isDialogueOrCoachItem(url, hasCoachElements = false) {
    try {
        const u = new URL(url);
        const p = u.pathname.toLowerCase();
        if (p.includes('/coach/') || p.includes('/dialogue') || p.includes('/guided-discussion')) {
            return true;
        }
    } catch (e) {}
    return hasCoachElements;
}

function getQuizInputs(url, inputsOnPage) {
    if (isDialogueOrCoachItem(url)) return [];
    return inputsOnPage.filter(inp => !inp.inCoach);
}

const dialogueUrl = "https://www.coursera.org/learn/introduction-to-computing-systems-public/coach/6m5WJ/boolean-logic-mastery";
assert.strictEqual(isDialogueOrCoachItem(dialogueUrl), true, "Dialogue URL must be recognized immediately");

const mockInputsOnDialogue = [{ type: 'textarea', inCoach: true }];
const quizInputsOnDialogue = getQuizInputs(dialogueUrl, mockInputsOnDialogue);
assert.strictEqual(quizInputsOnDialogue.length, 0, "Quiz solver inputs must be empty on dialogue page so it never hijacks");
console.log("✓ Test 3: Dialogue page completely isolated from quiz solver.");

// 4. Test Multi-Turn Dialogue Extraction
function extractLatestCoachMessage(chatTurns) {
    const coachMessages = chatTurns.filter(t => t.sender === 'coach');
    if (coachMessages.length === 0) return '';
    return coachMessages[coachMessages.length - 1].text;
}

const turns = [
    { sender: 'coach', text: "Consider the expression: F = A + A'B. Using distributive law, how would you rewrite this?" },
    { sender: 'student', text: "By distributive law, A + A'B = (A + A')(A + B). Since A + A' = 1, it simplifies to A + B." },
    { sender: 'coach', text: "No problem! Think about the distributive law, which states that A + BC = (A + B)(A + C). If you apply that to A + A'B, how would you rewrite the expression?" }
];

let lastAnswered = turns[0].text;
let latestCoach = extractLatestCoachMessage(turns);
assert.notStrictEqual(latestCoach, lastAnswered, "Latest coach message must differ from turn 1");
assert.ok(latestCoach.includes('Think about the distributive law'), "Should pick up Turn 2 coach question");
console.log("✓ Test 4: Multi-turn dialogue detects new coach question on Turn 2 without getting stuck on Turn 1.");

// 5. Test 2-Minute Watchdog
function evaluateWatchdog(timeOnPageMs, lastNavElapsedMs) {
    if (timeOnPageMs > 120000 && lastNavElapsedMs > 3000) {
        return 'TRIGGER_WATCHDOG_SKIP';
    }
    return 'WAIT';
}

assert.strictEqual(evaluateWatchdog(60000, 5000), 'WAIT', "60s should wait normally");
assert.strictEqual(evaluateWatchdog(125000, 5000), 'TRIGGER_WATCHDOG_SKIP', "125s (>2 min) must trigger watchdog skip");
console.log("✓ Test 5: 2-minute stuck watchdog triggers auto-skip as required.");

// 6. Test Green Tick Confirmation & Reattempt Once
function evaluateCompletion(isCompleted, reattemptCount) {
    if (isCompleted === true) return 'ADVANCE_NEXT';
    if (isCompleted === false) {
        if (reattemptCount === 0) return 'REATTEMPT_ONCE';
        return 'PROCEED_AFTER_REATTEMPT';
    }
    return 'ADVANCE_NEXT';
}

assert.strictEqual(evaluateCompletion(true, 0), 'ADVANCE_NEXT');
assert.strictEqual(evaluateCompletion(false, 0), 'REATTEMPT_ONCE');
assert.strictEqual(evaluateCompletion(false, 1), 'PROCEED_AFTER_REATTEMPT');
console.log("✓ Test 6: Green tick confirmation reattempts once and advances without loops.");

console.log("================================================================");
console.log("🎉 ALL TESTS PASSED 100%!");
console.log("================================================================");
