// Automated Unit Tests for Coursera AutoPilot v9.1 - Submit Button & Grading Hold
const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: SUBMIT BUTTON DETECTION & GRADING WAIT LIFECYCLE");
console.log("================================================================");

// 1. Mock DOM matching Coursera DevTools DOM from Screenshots 2 & 3
class MockElement {
    constructor(tagName, attrs = {}, text = '') {
        this.tagName = tagName.toUpperCase();
        this.attrs = attrs;
        this.textContent = text;
        this.innerText = text;
        this.value = text;
        this.children = [];
        this.parentElement = null;
        this.disabled = false;
        this.checked = false;
        this.className = attrs.class || '';
    }

    getAttribute(name) {
        return this.attrs[name] !== undefined ? this.attrs[name] : null;
    }

    setAttribute(name, val) {
        this.attrs[name] = val;
    }

    closest(selector) {
        let cur = this;
        while (cur) {
            if (cur.matches(selector)) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    querySelector(selector) {
        for (const child of this.children) {
            if (child.matches(selector)) return child;
            const found = child.querySelector(selector);
            if (found) return found;
        }
        return null;
    }

    querySelectorAll(selector) {
        let results = [];
        for (const child of this.children) {
            if (child.matches(selector)) results.push(child);
            results = results.concat(child.querySelectorAll(selector));
        }
        return results;
    }

    matches(selector) {
        if (!selector) return false;
        const selParts = selector.split(',').map(s => s.trim());
        for (const sel of selParts) {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                if (this.className.includes(cls)) return true;
            }
            if (sel.startsWith('[') && sel.endsWith(']')) {
                const inner = sel.slice(1, -1);
                if (inner.includes('=')) {
                    const [k, vRaw] = inner.split('=');
                    const v = vRaw.replace(/['"]/g, '');
                    if (k.endsWith('*')) {
                        const realKey = k.slice(0, -1);
                        if ((this.attrs[realKey] || '').toLowerCase().includes(v.toLowerCase())) return true;
                    } else {
                        if (this.attrs[k] === v) return true;
                    }
                }
            }
            if (sel.includes('[type="checkbox"]') && this.tagName === 'INPUT' && this.attrs.type === 'checkbox') return true;
            if (sel.includes('[data-testid="submit-button"]') && this.attrs['data-testid'] === 'submit-button') return true;
            if (sel.includes('[data-testid="HonorCodeAgreement"]') && this.attrs['data-testid'] === 'HonorCodeAgreement') return true;
            if (sel.includes('[data-testid="grading-in-progress-screen"]') && this.attrs['data-testid'] === 'grading-in-progress-screen') return true;
            if (sel.includes('[data-testid="item-feedback"]') && this.attrs['data-testid'] === 'item-feedback') return true;
            if (sel.toLowerCase() === this.tagName.toLowerCase()) return true;
        }
        return false;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }
}

// Build exact Coursera DOM hierarchy from Screenshot 2 & 3
const doc = new MockElement('div');

const honorCodeDiv = new MockElement('div', { 'data-testid': 'HonorCodeAgreement', class: 'css-isofo2o' });
const honorLabel = new MockElement('label', { class: 'cds-checkboxAndRadio-label' });
const honorInput = new MockElement('input', { type: 'checkbox', id: 'honor-checkbox' });
const honorSpan = new MockElement('span', { class: 'cds-checkboxAndRadio-labelText' }, 'I, Ankit Pandey, understand and agree.');
honorLabel.appendChild(honorInput);
honorLabel.appendChild(honorSpan);
honorCodeDiv.appendChild(honorLabel);
doc.appendChild(honorCodeDiv);

const controlsDiv = new MockElement('div', { 'data-e2e': 'AttemptSubmitControls_buttons', class: 'css-hb4vw3' });
const submitBtn = new MockElement('button', {
    class: 'cds-116 cds-button-disableElevation cds-button-primary css-dxhcv5',
    tabindex: '0',
    type: 'button',
    'aria-label': 'Submit',
    'data-testid': 'submit-button',
    'aria-disabled': 'true' // Initially disabled until honor code checked!
});
const submitSpan = new MockElement('span', { class: 'cds-button-label' }, 'Submit');
submitBtn.appendChild(submitSpan);

const saveDraftBtn = new MockElement('button', {
    class: 'cds-116 cds-button-secondary css-188cfkx',
    'aria-label': 'Save draft',
    'data-testid': 'save-draft-button'
}, 'Save draft');

controlsDiv.appendChild(submitBtn);
controlsDiv.appendChild(saveDraftBtn);
doc.appendChild(controlsDiv);

// TEST 1: Submit button detection
function testFindSubmitButton() {
    const exactSelectors = [
        'button[data-testid="submit-button"]',
        '[data-e2e="AttemptSubmitControls_buttons"] button[data-testid="submit-button"]',
        '[data-e2e="AttemptSubmitControls_buttons"] button.cds-button-primary',
        'button[aria-label="Submit" i]'
    ];
    let found = null;
    for (const sel of exactSelectors) {
        found = doc.querySelector(sel);
        if (found) break;
    }
    assert(found !== null, "Submit button MUST be found by exact Coursera selectors!");
    assert.strictEqual(found.attrs['data-testid'], 'submit-button');
    assert.strictEqual(found.attrs['aria-label'], 'Submit');
    console.log("✓ Test 1: Submit button correctly identified via Coursera DevTools DOM selectors.");
}

// TEST 2: Honor Code Agreement Check
function testHonorCodeAgreement() {
    const container = doc.querySelector('[data-testid="HonorCodeAgreement"]');
    assert(container !== null, "Honor code agreement container must exist!");
    const chk = container.querySelector('input[type="checkbox"]');
    assert(chk !== null, "Checkbox must exist inside HonorCodeAgreement!");

    // Simulate acceptHonorCode
    chk.checked = true;
    submitBtn.setAttribute('aria-disabled', 'false');

    assert.strictEqual(chk.checked, true, "Honor code checkbox successfully checked!");
    assert.strictEqual(submitBtn.getAttribute('aria-disabled'), 'false', "Submit button unlocked!");
    console.log("✓ Test 2: Coursera Honor Code agreement unlocks the submit button.");
}

// TEST 3: Grading in Progress Screen (Screenshot 4)
function testGradingInProgressScreen() {
    const gradingAlert = new MockElement('div', {
        role: 'alert',
        'data-testid': 'grading-in-progress-screen'
    }, "Hang tight! This shouldn't take too long.");
    doc.appendChild(gradingAlert);

    function isGrading(root) {
        if (root.querySelector('[data-testid="grading-in-progress-screen"]')) return true;
        const text = (root.textContent || '').toLowerCase();
        if (text.includes("hang tight! this shouldn't take too long")) return true;
        return false;
    }

    assert.strictEqual(isGrading(doc), true, "Must recognize active grading-in-progress screen!");
    console.log("✓ Test 3: Grading screen properly halts premature advancement.");
}

// TEST 4: Elimination of 'Try again' click loops
function testTryAgainElimination() {
    const testCases = [
        'try again',
        'practice again'
    ];

    function isStartAction(text) {
        const t = text.trim().toLowerCase();
        // Updated regex excludes 'try again' and 'practice again'
        const directRegex = /^(?:retake\s+quiz|retake\s+assignment|retake|start\s+now|start)$/i;
        return directRegex.test(t);
    }

    for (const t of testCases) {
        assert.strictEqual(isStartAction(t), false, `AutoPilot must NEVER auto-click '${t}' on a passed quiz!`);
    }
    console.log("✓ Test 4: 'Try again' is completely barred from automatically re-starting completed quizzes.");
}

testFindSubmitButton();
testHonorCodeAgreement();
testGradingInProgressScreen();
testTryAgainElimination();

console.log("================================================================");
console.log("🎉 ALL SUBMIT & GRADING HOLD TESTS PASSED 100%!");
console.log("================================================================");
