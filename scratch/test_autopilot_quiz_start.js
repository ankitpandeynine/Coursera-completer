// Test Suite: Auto-Pilot Quiz Landing & Start Assignment Integration Test
const assert = require('assert');

// Simulate the exact Coursera landing page from the user screenshot
class MockCourseraLandingPage {
    constructor() {
        this.url = 'https://www.coursera.org/learn/mips-computer-architecture-performance-optimization-bits/assignment-submission/1XRix/practice-quiz-defining-computer-performance-equations';
        this.title = 'Practice Quiz: Defining Computer Performance: Performance Equations';
        this.hasStarted = false;
        this.quizInputsPresent = false;
    }

    getButtons() {
        if (!this.hasStarted) {
            return [
                {
                    tagName: 'BUTTON',
                    innerText: 'Start assignment',
                    disabled: false,
                    getAttribute: () => null,
                    click: () => {
                        this.hasStarted = true;
                        this.quizInputsPresent = true;
                    }
                },
                {
                    tagName: 'BUTTON',
                    innerText: 'Help me practice',
                    disabled: false,
                    getAttribute: () => null,
                    click: () => { throw new Error('Clicked Help me practice instead of Start assignment!'); }
                },
                {
                    tagName: 'BUTTON',
                    innerText: 'Go to next item →',
                    disabled: false,
                    getAttribute: () => null,
                    click: () => { throw new Error('Clicked Next item before quiz was completed!'); }
                }
            ];
        } else {
            // Once started, questions appear
            return [
                {
                    tagName: 'BUTTON',
                    innerText: 'Submit assignment',
                    disabled: false,
                    getAttribute: () => null,
                    click: () => {}
                }
            ];
        }
    }
}

function findStartTestButton(doc) {
    const candidates = Array.from(doc.getButtons()).filter(el => {
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        return true;
    });

    return candidates.find(btn => {
        const t = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        const a = (btn.getAttribute('aria-label') || '').trim().toLowerCase();

        if (t.includes('help me practice') || t.includes('review learning objectives') || t.includes('report an issue')) {
            return false;
        }

        return t === 'start assignment' || t === 'resume assignment' ||
               t === 'start quiz' || t === 'resume quiz' || t === 'take quiz' ||
               t === 'start attempt' || t === 'resume attempt' || t === 'continue attempt' ||
               t === 'start practice' || t === 'resume practice' ||
               t === 'practice again' || t === 'try again' || t === 'retake quiz' ||
               t === 'retake assignment' || t === 'start' || t === 'begin assignment' ||
               t === 'begin quiz' || t === 'continue assignment' || t === 'continue quiz' ||
               a === 'start assignment' || a === 'resume assignment' ||
               a === 'start quiz' || a === 'resume quiz' || a === 'take quiz';
    });
}

console.log('--- TEST: Auto-start test from /assignment-submission landing page ---');
const page = new MockCourseraLandingPage();

// Autopilot state
let pageArrivalTime = Date.now() - 1000; // arrived 1s ago
let actionTaken = '';

// Step 1: Check inputs
const quizInputs = page.quizInputsPresent ? [{ id: 'q1_opt1' }] : [];

// Step 2: Auto-start check
if (quizInputs.length === 0) {
    const startTestBtn = findStartTestButton(page);
    if (startTestBtn) {
        if (Date.now() - pageArrivalTime > 800) {
            startTestBtn.click();
            actionTaken = 'CLICKED_START_ASSIGNMENT';
        }
    }
}

assert.strictEqual(actionTaken, 'CLICKED_START_ASSIGNMENT', 'Autopilot must click Start assignment');
assert.strictEqual(page.hasStarted, true, 'Test has successfully started');
assert.strictEqual(page.quizInputsPresent, true, 'Questions are now ready for AI solver');

console.log('✅ TEST PASSED: Auto-starts quiz on assignment landing page with 100% precision!');
