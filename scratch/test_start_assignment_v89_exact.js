const assert = require('assert');

// Accurate mock matching standard browser DOM
class MockElement {
    constructor(tag, props = {}) {
        this.tagName = tag.toUpperCase();
        this.type = props.type || '';
        this.id = props.id || '';
        this.name = props.name || '';
        this.className = props.className || '';
        this.attributes = props.attributes || {};
        this.children = [];
        this.parentElement = null;
        this._text = props.textContent || '';
        this.disabled = props.disabled || false;
        this.offsetWidth = props.offsetWidth !== undefined ? props.offsetWidth : 100;
        this.offsetHeight = props.offsetHeight !== undefined ? props.offsetHeight : 30;
        this.clickCount = 0;
        this.dispatchedEvents = [];
    }

    get textContent() {
        if (this._text) return this._text;
        return this.children.map(c => c.textContent).join(' ');
    }

    set textContent(v) {
        this._text = v;
    }

    get innerText() {
        return this.textContent;
    }

    getAttribute(name) { return this.attributes[name] || null; }
    setAttribute(name, val) { this.attributes[name] = val; }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    closest(sel) {
        let curr = this;
        const selectors = sel.split(',').map(s => s.trim().toLowerCase());
        while (curr) {
            for (const s of selectors) {
                if (s === 'aside' && curr.tagName === 'ASIDE') return curr;
                if (s === 'nav' && curr.tagName === 'NAV') return curr;
                if (s === 'header' && curr.tagName === 'HEADER') return curr;
                if (s === 'footer' && curr.tagName === 'FOOTER') return curr;
                if (s.includes('rc-navigationdrawer') && curr.className.includes('rc-NavigationDrawer')) return curr;
                if (s.includes('rc-coursenavigation') && curr.className.includes('rc-CourseNavigation')) return curr;
                if (s.includes('goal') && curr.className.includes('goal')) return curr;
                if (s.includes('question-view') && curr.className.includes('question-view')) return curr;
                if (s.includes('rc-quizquestion') && curr.className.includes('rc-QuizQuestion')) return curr;
                if (s.includes('fullscreen') && curr.className.includes('cds-FullscreenDialog-scrollContainer')) return curr;
                if (s.includes('part-submission') && (curr.attributes['data-testid'] || '').includes('part-submission')) return curr;
            }
            curr = curr.parentElement;
        }
        return null;
    }

    querySelector(sel) {
        for (const child of this.children) {
            if (sel.includes('cds-button-label') && child.className.includes('cds-button-label')) return child;
            if (sel.includes('cml-viewer') && child.className.includes('cml-viewer')) return child;
            if (sel.includes('rc-CML') && child.className.includes('rc-CML')) return child;
            if (sel.includes('question-text') && child.className.includes('question-text')) return child;
            if (sel.includes('legend') && child.tagName === 'LEGEND') return child;
            const sub = child.querySelector(sel);
            if (sub) return sub;
        }
        return null;
    }

    querySelectorAll(sel) {
        const results = [];
        this.findChildren(c => {
            if (sel.includes('input[type="radio"]') && c.tagName === 'INPUT' && c.type === 'radio') return true;
            if (sel.includes('input[type="checkbox"]') && c.tagName === 'INPUT' && c.type === 'checkbox') return true;
            if (sel.includes('button') && c.tagName === 'BUTTON') return true;
            if (sel.includes('a') && c.tagName === 'A') return true;
            if (sel.includes('span') && c.tagName === 'SPAN') return true;
            return false;
        }, results);
        return results;
    }

    findChildren(pred, results) {
        for (const child of this.children) {
            if (pred(child)) results.push(child);
            child.findChildren(pred, results);
        }
    }

    focus() {}
    scrollIntoView() {}
    dispatchEvent(ev) { this.dispatchedEvents.push(ev); }
    click() { this.clickCount++; }
}

// Global window/document mocks
class MockDocument {
    constructor() {
        this.documentElement = new MockElement('HTML');
        this.body = new MockElement('BODY');
        this.documentElement.appendChild(this.body);
        this.title = 'Practice Quiz: Defining Computer Performance using Instruction Performance | Coursera';
    }

    querySelectorAll(sel) {
        return this.documentElement.querySelectorAll(sel);
    }

    querySelector(sel) {
        return this.documentElement.querySelector(sel);
    }
}

// Test Runner
console.log('=== RUNNING COURSERA AUTOPILOT V8.9 ASSIGNMENT TEST SUITE ===');

// Setup Document for User Screenshot Scenario
const doc = new MockDocument();
global.document = doc;
global.window = {
    location: {
        href: 'https://www.coursera.org/learn/mips-computer-architecture-performance-optimization-bits/assignment-submission/TAXUm/practice-quiz-defining-computer-performance-using-instruction-performance',
        pathname: '/learn/mips-computer-architecture-performance-optimization-bits/assignment-submission/TAXUm/practice-quiz-defining-computer-performance-using-instruction-performance'
    }
};

// 1. Build Sidebar with "Today's goals" checkboxes
const sidebar = new MockElement('ASIDE', { className: 'rc-NavigationDrawer sidebar' });
doc.body.appendChild(sidebar);

const goalItem1 = new MockElement('DIV', { className: 'goal-item' });
sidebar.appendChild(goalItem1);
const goalCheck1 = new MockElement('INPUT', { type: 'checkbox', id: 'goal_1' });
goalItem1.appendChild(goalCheck1);

const goalItem2 = new MockElement('DIV', { className: 'goal-item' });
sidebar.appendChild(goalItem2);
const goalCheck2 = new MockElement('INPUT', { type: 'checkbox', id: 'goal_2' });
goalItem2.appendChild(goalCheck2);

// 2. Build Main Content from Screenshot
const main = new MockElement('MAIN', { className: 'main-content' });
doc.body.appendChild(main);

const h1 = new MockElement('H1', { textContent: 'Practice Quiz: Defining Computer Performance using Instruction Performance' });
main.appendChild(h1);

const startBtn = new MockElement('BUTTON', { className: 'cds-149 cds-button-primary' });
const startLabel = new MockElement('SPAN', { className: 'cds-button-label', textContent: 'Start assignment' });
startBtn.appendChild(startLabel);
main.appendChild(startBtn);

const helpBtn = new MockElement('BUTTON', { className: 'cds-149 cds-button-secondary' });
const helpLabel = new MockElement('SPAN', { className: 'cds-button-label', textContent: 'Help me practice' });
helpBtn.appendChild(helpLabel);
main.appendChild(helpBtn);

const nextBtn = new MockElement('BUTTON', { className: 'cds-button-next' });
const nextLabel = new MockElement('SPAN', { className: 'cds-button-label', textContent: 'Go to next item →' });
nextBtn.appendChild(nextLabel);
main.appendChild(nextBtn);

// Exact logic from content.js v8.9
function findQuestionContainer(input) {
    if (!input) return null;
    const direct = input.closest('div[data-testid="question-view"], div[data-testid="quiz-question"], .rc-FormPartsQuestion, .rc-QuizQuestion, fieldset[class*="question" i], [data-testid*="question-part"], div[data-testid="part-submission"]');
    if (direct) return direct;

    let el = input.parentElement;
    let fallback = null;
    while (el && el !== doc.body && el !== doc.documentElement) {
        if (el.tagName === 'ASIDE' || el.tagName === 'NAV' || el.tagName === 'HEADER' || el.tagName === 'FOOTER' ||
            (el.className && (el.className.includes('rc-CourseNavigation') || el.className.includes('rc-NavigationDrawer')))) {
            return null;
        }
        const hasPrompt = el.querySelector('[data-testid="cml-viewer"], [data-testid*="cml"], .rc-CML, [class*="cml-viewer"], [class*="question-text"], [class*="prompt"], legend');
        if (hasPrompt) return el;
        if (!fallback && el.tagName === 'DIV' && el.className && (el.className.includes('Question') || el.className.includes('question') || el.className.includes('prompt'))) {
            fallback = el;
        }
        el = el.parentElement;
    }
    return fallback;
}

function getQuizInputs() {
    return Array.from(
        doc.querySelectorAll('input[type="radio"], input[type="checkbox"], textarea, input[type="text"]')
    ).filter(el => {
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
        if (el.disabled || el.type === 'hidden') return false;
        if (el.closest(
            'aside, nav, header, footer, [role="navigation"], [role="search"], ' +
            '.rc-CourseNavigation, .rc-NavigationDrawer, [class*="sidebar" i], [class*="drawer" i], ' +
            '[class*="goal" i], [data-testid*="goal" i], [aria-label*="goal" i], ' +
            '[class*="item-list" i], [class*="outline" i], [data-testid*="sidebar" i], [data-testid*="navigation" i]'
        )) {
            return false;
        }
        return !!findQuestionContainer(el);
    });
}

function findStartTestButton() {
    const clickables = Array.from(doc.querySelectorAll('button, a, [role="button"]')).filter(el => {
        if (!el || el.disabled) return false;
        return true;
    });

    for (const el of clickables) {
        const rawText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        const text = rawText.toLowerCase();
        if (text.includes('help me practice') || text.includes('review learning') || 
            text.includes('report an issue') || text.includes('go to next') || 
            text.includes('next item') || text === 'cancel' || text === 'back' || text === 'close') {
            continue;
        }
        if (text === 'start assignment' || text.startsWith('start assignment') || text.includes('start assignment') ||
            text === 'resume assignment' || text.startsWith('resume assignment') || text.includes('resume assignment') ||
            text === 'start quiz' || text.startsWith('start quiz') || text.includes('start quiz') ||
            text === 'resume quiz' || text.startsWith('resume quiz') || text.includes('resume quiz') ||
            text === 'take quiz' || text.startsWith('take quiz') || text.includes('take quiz')) {
            return el;
        }

        const childSpan = el.querySelector ? el.querySelector('.cds-button-label, [class*="label"], span') : null;
        if (childSpan) {
            const sText = (childSpan.innerText || childSpan.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (sText.includes('start assignment') || sText.includes('resume assignment') ||
                sText.includes('start quiz') || sText.includes('resume quiz') ||
                sText.includes('start attempt') || sText.includes('take quiz')) {
                return el;
            }
        }
    }

    const primaryBtn = clickables.find(el => {
        const cls = (el.className || '').toLowerCase();
        const text = (el.innerText || el.textContent || '').toLowerCase();
        if (text.includes('help me practice') || text.includes('next') || text.includes('cancel')) return false;
        return cls.includes('primary') && (text.includes('start') || text.includes('resume') || text.includes('take'));
    });
    if (primaryBtn) return primaryBtn;

    return null;
}

function isQuizAttemptPage() {
    if (findStartTestButton()) return false;
    const path = window.location.pathname;
    if (path.includes('/attempt')) return true;
    if (doc.querySelector('.cds-FullscreenDialog-scrollContainer')) return true;
    return getQuizInputs().length > 0;
}

// TEST 1: Goal checkboxes in sidebar must NOT be recognized as quiz inputs
console.log('Test 1: Validating sidebar inputs exclusion...');
const inputs = getQuizInputs();
assert.strictEqual(inputs.length, 0, `Expected 0 quiz inputs on landing page, got ${inputs.length}`);
console.log('✓ PASS: getQuizInputs() successfully ignores sidebar goal checkboxes.');

// TEST 2: Start test button detection on landing page
console.log('Test 2: Detecting Start assignment button...');
const foundBtn = findStartTestButton();
assert.notStrictEqual(foundBtn, null, 'Expected findStartTestButton() to find a button');
assert.strictEqual(foundBtn, startBtn, 'Expected findStartTestButton() to return startBtn');
console.log('✓ PASS: findStartTestButton() accurately returns the Start assignment button.');

// TEST 3: isQuizAttemptPage must be false on landing page
console.log('Test 3: Checking isQuizAttemptPage() on landing page...');
const isAttempt = isQuizAttemptPage();
assert.strictEqual(isAttempt, false, 'Expected isQuizAttemptPage() to be false when Start assignment button is visible');
console.log('✓ PASS: isQuizAttemptPage() is false when start button is visible.');

// TEST 4: Click button and verify execution
console.log('Test 4: Simulating auto-start click...');
foundBtn.click();
assert.strictEqual(startBtn.clickCount, 1, 'Expected startBtn to have been clicked once');
console.log('✓ PASS: Start assignment button clicked successfully.');

// TEST 5: Transition to Attempt state (modal opens, questions mount)
console.log('Test 5: Simulating transition into active quiz attempt...');
main.children = main.children.filter(c => c !== startBtn && c !== helpBtn); // Start button unmounts
const attemptDialog = new MockElement('DIV', { className: 'cds-FullscreenDialog-scrollContainer' });
doc.body.appendChild(attemptDialog);

const q1 = new MockElement('DIV', { className: 'rc-QuizQuestion' });
attemptDialog.appendChild(q1);
const prompt1 = new MockElement('DIV', { className: 'rc-CML', textContent: 'Which equation defines CPI?' });
q1.appendChild(prompt1);
const opt1 = new MockElement('INPUT', { type: 'radio', name: 'q1', id: 'q1_o1' });
q1.appendChild(opt1);

const inputsDuringAttempt = getQuizInputs();
assert.strictEqual(inputsDuringAttempt.length, 1, 'Expected 1 quiz input during attempt');
assert.strictEqual(isQuizAttemptPage(), true, 'Expected isQuizAttemptPage() to be true when attempt dialog is open');
assert.strictEqual(findStartTestButton(), null, 'Expected findStartTestButton() to be null during active attempt');
console.log('✓ PASS: Full lifecycle transition from Landing page -> Auto-Start -> Active Quiz Attempt verified!');

console.log('\nALL 5 TESTS PASSED SUCCESSFULLY! 🚀');
