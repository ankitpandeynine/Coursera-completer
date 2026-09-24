const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: COURSERA AI DIALOGUE & LOCKED ITEM SKIP FLOW");
console.log("================================================================");

// 1. TEST DIALOGUE STAGE 1: Start Dialogue
const stage1Mock = {
    url: 'https://www.coursera.org/learn/mips/coach/OWqGC/performance-detective...',
    bodyText: "Performance Detective: Analyzing Real-World Computing Scenarios\nWelcome! I'm Coursera AI, your personalized guide. During this Dialogue...\nWhen you're ready, click Start Dialogue",
    buttons: [
        { text: 'Start Dialogue', disabled: false }
    ]
};

function isDialogueOrCoachItem(url, text) {
    if (url.includes('/coach/') || url.includes('/dialogue')) return true;
    const t = text.toLowerCase();
    return t.includes('start dialogue') || t.includes('end dialogue') || t.includes("welcome! i'm coursera ai");
}

assert.strictEqual(isDialogueOrCoachItem(stage1Mock.url, stage1Mock.bodyText), true, "Stage 1 must be detected as Dialogue item!");
const startBtn = stage1Mock.buttons.find(b => b.text.toLowerCase() === 'start dialogue');
assert(startBtn !== undefined, "Start Dialogue button must be present!");
console.log("✓ Test 1: Stage 1 (Start Dialogue) correctly identified.");

// 2. TEST DIALOGUE STAGE 2: Chat extraction & prompt generation
const stage2Chat = {
    paragraphs: [
        "Great! Let's dive into our first scenario.",
        "Imagine you're an IT consultant for a small design firm. They're currently struggling with slow rendering times on their desktop workstations when working with high-resolution 3D models. The firm is considering either upgrading the CPU or adding more RAM to these machines.",
        "Based on what you know about computer system performance, what is the first step you would take to determine which upgrade would actually improve their rendering performance?"
    ]
};

function formatDialoguePrompt(questionText) {
    return `You are a knowledgeable university student participating in an interactive Coursera learning dialogue with an AI coach.
Answer the following scenario or question thoughtfully, accurately, and naturally.

CRITICAL INSTRUCTIONS FOR A HUMANIZED STUDENT RESPONSE:
1. Write like an actual smart human college student typing an answer.
2. DO NOT use generic AI filler phrases (never say "Certainly!", "As an AI language model...", "Here is the solution:", "In summary", etc.).
3. Directly answer the question with technical depth, reasoning, and practical steps.
4. Keep the response to 1-2 well-structured paragraphs (about 3-6 sentences), concise yet thorough.
5. Do not use markdown headers, bullet lists, or bold asterisks. Use plain, conversational, academic text.

QUESTION / SCENARIO FROM COURSERA:
${questionText}`;
}

const qText = stage2Chat.paragraphs.slice(-2).join('\n\n');
const builtPrompt = formatDialoguePrompt(qText);
assert(builtPrompt.includes("Imagine you're an IT consultant"), "Prompt must include the scenario details!");
assert(builtPrompt.includes("CRITICAL INSTRUCTIONS FOR A HUMANIZED STUDENT RESPONSE"), "Prompt must instruct for humanized output!");
console.log("✓ Test 2: Stage 2 (Dialogue scenario extracted and humanized prompt constructed).");

// 3. TEST DIALOGUE STAGE 3: Summary page detection & Go to next item
const stage3Summary = {
    url: 'https://www.coursera.org/learn/mips/coach/OWqGC/performance-detective...',
    bodyText: "Performance Detective: Analyzing Real-World Computing Scenarios\nYour strengths:\n• Analytical Rigor: You demonstrated a strong ability...\n• Quantitative Application: You correctly applied Amdahl's Law...\nAreas for improvement:\n• You have demonstrated an Advanced level of understanding...\nDialogue is powered by AI, so check for mistakes...",
    buttons: [
        { text: 'Go to next item →', disabled: false }
    ]
};

function isDialogueCompletedPage(text) {
    const t = text.toLowerCase();
    return (t.includes('your strengths') || t.includes('areas for improvement') || t.includes("during today's session")) &&
           (t.includes('dialogue is powered by ai') || t.includes('tell us what you think') || t.includes('strengths:'));
}

assert.strictEqual(isDialogueCompletedPage(stage3Summary.bodyText), true, "Stage 3 summary page must be recognized as completed!");
const nextBtn = stage3Summary.buttons.find(b => b.text.toLowerCase().includes('next item'));
assert(nextBtn !== undefined, "Next item button must be found on summary page!");
console.log("✓ Test 3: Stage 3 (Dialogue completed summary page detected & 'Go to next item →' found).");

// 4. TEST LOCKED PAGE (PIC 4): Skip and Go to Next
const stage4Locked = {
    url: 'https://www.coursera.org/learn/mips/assignment-submission/BBITe/test-yourself...',
    bodyText: "Test Yourself: Computer System Performance and Its Measurement\nYou still have some learning to complete\nThis item is locked until you complete all prior content in this module.\nTo continue learning, go back to where you left off.",
    buttons: [
        { text: 'Go to next item →', disabled: false }
    ]
};

function isItemLockedPage(text) {
    const t = text.toLowerCase();
    return t.includes("you still have some learning to complete") ||
           t.includes("this item is locked until you complete") ||
           t.includes("this item is locked") ||
           (t.includes("locked") && t.includes("go back to where you left off"));
}

assert.strictEqual(isItemLockedPage(stage4Locked.bodyText), true, "Locked page must be detected immediately!");
const skipNextBtn = stage4Locked.buttons.find(b => b.text.toLowerCase().includes('next item'));
assert(skipNextBtn !== undefined, "'Go to next item →' button must be found to skip locked page!");
console.log("✓ Test 4: Pic 4 Locked page ('You still have some learning to complete') recognized and skip button identified.");

console.log("================================================================");
console.log("🎉 ALL DIALOGUE & LOCKED ITEM UNIT TESTS PASSED 100%!");
console.log("================================================================");
