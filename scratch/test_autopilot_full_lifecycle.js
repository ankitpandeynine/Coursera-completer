const assert = require('assert');

// Simulate the complete user workflow from the screenshot
class MockCourseraPage {
    constructor() {
        this.url = 'https://www.coursera.org/learn/mips-computer-architecture-performance-optimization-bits/assignment-submission/1XRix/practice-quiz-defining-computer-performance-equations';
        this.title = 'Practice Quiz: Defining Computer Performance: Performance Equations';
        this.attemptStarted = false;
        this.clickCount = 0;
        this.questionsLoaded = false;
        this.completed = false;
    }

    querySelectorAll(sel) {
        if ((sel === 'input' || sel.includes('input[type="radio"]')) && !this.questionsLoaded) {
            return [];
        }
        if (!this.attemptStarted) {
            // Landing screen from the user's screenshot
            const startBtn = {
                tagName: 'BUTTON',
                innerText: 'Start assignment',
                className: 'cds-button cds-button-primary',
                disabled: false,
                getAttribute: (attr) => attr === 'data-testid' ? 'action-button' : null,
                querySelector: (s) => ({ innerText: 'Start assignment' }),
                click: () => {
                    this.clickCount++;
                    this.attemptStarted = true;
                    // Simulate questions appearing after a brief delay
                    setTimeout(() => {
                        this.questionsLoaded = true;
                    }, 500);
                }
            };

            const helpBtn = {
                tagName: 'BUTTON',
                innerText: 'Help me practice',
                className: 'cds-button cds-button-secondary',
                disabled: false,
                getAttribute: () => null,
                click: () => { throw new Error('Clicked Help me practice!'); }
            };

            const nextItemBtn = {
                tagName: 'BUTTON',
                innerText: 'Go to next item →',
                disabled: false,
                getAttribute: () => null,
                click: () => {
                    if (!this.completed) throw new Error('Should not advance to next item before test is completed!');
                }
            };

            return [startBtn, helpBtn, nextItemBtn];
        } else if (!this.questionsLoaded) {
            // Loading attempt dialog
            return [];
        } else {
            // Questions active
            return [
                {
                    tagName: 'INPUT',
                    type: 'radio',
                    id: 'q1_opt0',
                    name: 'q1',
                    disabled: false,
                    checked: false,
                    getAttribute: () => null
                }
            ];
        }
    }
}

// Clean helper
function cleanText(str) {
    return (str || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function isExcludedButton(text, aria) {
    const combined = (text + ' ' + aria).toLowerCase();
    return /help\s+me\s+practice|review\s+learning|report\s+an\s+issue|go\s+to\s+next|next\s+item|next\s+question|cancel|back|close|dismiss|download|notes|transcript/i.test(combined);
}

function isStartMatch(text, aria, testId) {
    if (isExcludedButton(text, aria)) return false;

    const tid = (testId || '').toLowerCase();
    if (tid.includes('start-assignment') || tid.includes('start-quiz') || 
        tid.includes('resume-assignment') || tid.includes('resume-quiz') ||
        tid.includes('take-quiz') || tid.includes('start-attempt') ||
        tid.includes('practice-again') || tid.includes('try-again')) {
        return true;
    }

    const t = cleanText(text);
    const a = cleanText(aria);

    const startRegex = /^(?:start|resume|continue|begin|take|retake)\s+(?:assignment|quiz|practice|attempt|test|exam)\b/i;
    if (startRegex.test(t) || startRegex.test(a)) return true;

    const directRegex = /^(?:practice\s+again|try\s+again|retake\s+quiz|retake\s+assignment|retake|start\s+now|start)$/i;
    if (directRegex.test(t) || directRegex.test(a)) return true;

    if (t.includes('start assignment') || t.includes('resume assignment') ||
        t.includes('start quiz') || t.includes('resume quiz') ||
        t.includes('take quiz') || t.includes('start attempt') ||
        t.includes('resume attempt') || t.includes('start practice') ||
        t.includes('practice again') || t.includes('try again')) {
        return true;
    }

    return false;
}

function findStartTestButton(doc) {
    const candidates = Array.from(
        doc.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], div[tabindex="0"]')
    ).filter(el => {
        if (!el || el.disabled || (el.getAttribute && el.getAttribute('aria-disabled') === 'true')) return false;
        const id = (el.id || '').toLowerCase();
        if (id.includes('coursera-speed') || id.includes('coursera-ai')) return false;
        return true;
    });

    for (const btn of candidates) {
        const text = btn.innerText || btn.textContent || '';
        const aria = btn.getAttribute ? (btn.getAttribute('aria-label') || '') : '';
        const testId = btn.getAttribute ? (btn.getAttribute('data-testid') || '') : '';
        if (isStartMatch(text, aria, testId)) return btn;

        const labelEl = btn.querySelector ? btn.querySelector('.cds-button-label, [class*="label"], [class*="text"], span') : null;
        if (labelEl) {
            const lText = labelEl.innerText || labelEl.textContent || '';
            if (isStartMatch(lText, '', '')) return btn;
        }
    }

    return null;
}

// Simulate autopilot loop execution
console.log('Testing Autopilot Full Lifecycle on Assignment Landing Page...');
const page = new MockCourseraPage();

let pageArrivalTime = Date.now() - 1000;
let lastStartClickTime = 0;
let lastStartClickUrl = '';
let solverTriggered = false;

// Tick 1: User arrives on landing page
{
    const quizInputs = page.querySelectorAll('input');
    if (quizInputs.length === 0) {
        const startTestBtn = findStartTestButton(page);
        assert.ok(startTestBtn, 'Must find start test button');
        const now = Date.now();
        if (lastStartClickUrl === page.url && (now - lastStartClickTime < 6000)) {
            // Cooldown active
        } else if (now - pageArrivalTime > 600) {
            lastStartClickTime = now;
            lastStartClickUrl = page.url;
            startTestBtn.click();
            console.log('  -> Tick 1: Clicked Start assignment');
        }
    }
}

assert.strictEqual(page.clickCount, 1, 'Button must be clicked exactly once');
assert.strictEqual(page.attemptStarted, true, 'Attempt must be started');

// Tick 2 (1 second later): Questions still loading, button may still be in DOM or fading
{
    const quizInputs = page.querySelectorAll('input');
    if (quizInputs.length === 0) {
        const startTestBtn = findStartTestButton(page);
        const now = Date.now() + 1000;
        if (lastStartClickUrl === page.url && (now - lastStartClickTime < 6000)) {
            console.log('  -> Tick 2: Cooldown protected - no duplicate click issued');
        } else {
            if (startTestBtn) startTestBtn.click();
        }
    }
}

assert.strictEqual(page.clickCount, 1, 'Must NOT double-click while questions are loading');

// Tick 3 (Questions finish loading)
setTimeout(() => {
    const quizInputs = page.querySelectorAll('input');
    assert.strictEqual(quizInputs.length, 1, 'Questions loaded');
    if (quizInputs.length > 0) {
        solverTriggered = true;
        console.log('  -> Tick 3: Questions detected! AI Solver triggered.');
    }
    assert.strictEqual(solverTriggered, true, 'Solver must be triggered');
    console.log('\n✅ LIFECYCLE TEST PASSED: Perfectly starts quiz and transitions to AI solver without duplicate clicks!');
}, 600);
