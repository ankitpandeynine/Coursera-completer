const assert = require('assert');

console.log("🧪 TESTING: COURSERA DISCUSSION PROMPT DETECTION, SCRAPING, TYPING & SUBMISSION");

// 1. Mock DOM Environment
class MockElement {
    constructor(tagName, options = {}) {
        this.tagName = tagName.toUpperCase();
        this._innerText = options.innerText || '';
        this._textContent = options.textContent || options.innerText || '';
        this.value = options.value || '';
        this.attributes = options.attributes || {};
        this.classList = new Set(options.classes || []);
        this.children = [];
        this.parentElement = null;
        this.isContentEditable = !!options.isContentEditable;
        this.disabled = !!options.disabled;
        this.offsetWidth = options.offsetWidth !== undefined ? options.offsetWidth : 200;
        this.offsetHeight = options.offsetHeight !== undefined ? options.offsetHeight : 40;
        this.events = [];
    }

    get innerText() {
        if (this._innerText) return this._innerText;
        if (this.children.length > 0) return this.children.map(c => c.innerText).join('\n');
        return '';
    }

    set innerText(val) {
        this._innerText = val;
    }

    get textContent() {
        if (this._textContent) return this._textContent;
        if (this.children.length > 0) return this.children.map(c => c.textContent).join('\n');
        return '';
    }

    set textContent(val) {
        this._textContent = val;
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    setAttribute(name, val) {
        this.attributes[name] = val;
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        let el = this;
        while (el) {
            if (selector.includes('main') && el.tagName === 'MAIN') return el;
            if (selector.includes('reply') && (el.classList.has('reply') || /reply/i.test(el.getAttribute('class') || ''))) return el;
            if (selector.includes('card') && (el.classList.has('card') || /card/i.test(el.getAttribute('class') || ''))) return el;
            el = el.parentElement;
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        function walk(node) {
            for (const c of node.children) {
                if (matchesSelector(c, selector)) {
                    results.push(c);
                }
                walk(c);
            }
        }
        walk(this);
        return results;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    dispatchEvent(ev) {
        this.events.push(ev);
    }

    focus() {
        this.focused = true;
    }

    scrollIntoView() {
        this.scrolled = true;
    }

    click() {
        this.clicked = true;
    }

    getBoundingClientRect() {
        return { top: 100, bottom: 150, left: 50, right: 350, width: 300, height: 50 };
    }
}

function matchesSelector(el, sel) {
    const s = sel.toLowerCase();
    if (s.includes('h1') && el.tagName === 'H1') return true;
    if (s.includes('button') && el.tagName === 'BUTTON') return true;
    if (s.includes('textarea') && el.tagName === 'TEXTAREA') return true;
    if (s.includes('[contenteditable="true"]') && el.isContentEditable) return true;
    if (s.includes('[placeholder*="response"') && /response/i.test(el.getAttribute('placeholder') || '')) return true;
    if (s.includes('[role="textbox"]') && el.getAttribute('role') === 'textbox') return true;
    if (s.includes('.public-drafteditor-content') && el.classList.has('public-DraftEditor-content')) return true;
    return false;
}

// 2. Build the exact DOM from the user screenshot: Single-Cycle Datapath and Control Design
const docBody = new MockElement('body');
const main = new MockElement('main');
docBody.appendChild(main);

const h1 = new MockElement('h1', { innerText: 'Single-Cycle Datapath and Control Design' });
main.appendChild(h1);

const contextP = new MockElement('p', {
    innerText: 'Single cycle datapaths of microprocessor without interlocked pipelined stages (MIPS) and advanced RISC machine (ARM): The single-cycle datapath is the simplest one. It is not practical to implement it, but it is useful to understand the instruction set architecture (ISA) without much complexity. Here, we discussed MIPS single-cycle datapath. The ARM is another popular RISC-based architecture. In this discussion, let us compare and contrast the MIPS single-cycle datapath with the ARM single-cycle datapath.'
});
main.appendChild(contextP);

const qHeader = new MockElement('strong', { innerText: 'Questions for discussion:' });
main.appendChild(qHeader);

const qList = new MockElement('ol', {
    innerText: '1. How is MIPS single-cycle implementation different from ARM single-cycle implementation?\n2. What are the common features of both architectures?'
});
main.appendChild(qList);

const tipsP = new MockElement('p', {
    innerText: 'Tips for writing posts:\n• Read the prompt and instructions carefully.\n• Identify the most important words or phrases in the prompt to help you stay on point.'
});
main.appendChild(tipsP);

const tipsPeerP = new MockElement('p', {
    innerText: 'Tips for responding to peer responses:\n• Provide constructive comments.\n• Provide reasons for your agreement or disagreement.'
});
main.appendChild(tipsPeerP);

const optP = new MockElement('p', { innerText: 'Participation is optional' });
main.appendChild(optP);

// Reply Card Container
const replyCard = new MockElement('div', { classes: ['reply-card', 'reply'] });
const replyHeader = new MockElement('h3', { innerText: 'Your Reply' });
replyCard.appendChild(replyHeader);

// Editor (contenteditable)
const editor = new MockElement('div', {
    isContentEditable: true,
    attributes: {
        role: 'textbox',
        placeholder: 'Type your response here...',
        'data-placeholder': 'Type your response here...'
    }
});
replyCard.appendChild(editor);

// Reply button
const replyBtn = new MockElement('button', {
    innerText: 'Reply',
    disabled: true,
    attributes: { 'aria-label': 'Reply', 'aria-disabled': 'true' }
});
replyCard.appendChild(replyBtn);

main.appendChild(replyCard);

// Next button
const nextBtn = new MockElement('button', {
    innerText: 'Go to next item >',
    attributes: { 'aria-label': 'Go to next item' }
});
main.appendChild(nextBtn);

// Setup global mock
global.document = {
    body: docBody,
    querySelectorAll: (sel) => docBody.querySelectorAll(sel),
    querySelector: (sel) => docBody.querySelector(sel),
    createRange: () => ({ selectNodeContents: () => {} }),
    execCommand: (cmd, show, val) => {
        if (cmd === 'insertText') {
            return true;
        }
        return false;
    }
};
global.window = {
    location: { href: 'https://www.coursera.org/learn/comparch/discussionPrompt/abc123xyz' },
    getSelection: () => ({ removeAllRanges: () => {}, addRange: () => {} }),
    Event: class { constructor(t) { this.type = t; } },
    InputEvent: class { constructor(t, opts) { this.type = t; Object.assign(this, opts); } },
    KeyboardEvent: class { constructor(t, opts) { this.type = t; Object.assign(this, opts); } },
    HTMLTextAreaElement: { prototype: {} },
    HTMLInputElement: { prototype: {} }
};
global.chrome = {
    runtime: {
        id: 'mock-ext-id',
        getManifest: () => ({ version: '10.0' }),
        sendMessage: (msg, cb) => {
            // Simulate AI response
            if (msg.type === 'ASK_AI') {
                cb({
                    success: true,
                    provider: 'Groq',
                    text: 'The MIPS and ARM single-cycle implementations differ primarily in instruction decoding complexity and datapath versatility. While MIPS uses uniform 32-bit instructions with dedicated ALU operations, ARM incorporates optional condition codes into almost every instruction and includes a multi-purpose barrel shifter directly on the operand path. Common features between both include load-store architectures, separate instruction and data memory buses, and single-clock execution per instruction.'
                });
            }
        }
    }
};

// Load discussion_runner.js
require('../discussion_runner.js');
const runner = window.CourseraDiscussionRunner;

// TEST 1: Detection
console.log("Testing isDiscussionPromptItem...");
assert.strictEqual(runner.isDiscussionPromptItem(), true, "Discussion prompt URL and DOM must be recognized!");
console.log("✓ Test 1: Page identified as discussion prompt.");

// TEST 2: Extraction
console.log("Testing extractDiscussionPromptDetails...");
const details = runner.extractDiscussionPromptDetails();
assert.strictEqual(details.title, 'Single-Cycle Datapath and Control Design', "Title must match header");
assert.ok(details.promptText.includes('How is MIPS single-cycle implementation different'), "Questions must be included");
assert.ok(details.promptText.includes('ARM single-cycle implementation'), "ARM question must be included");
assert.ok(!details.promptText.includes('Tips for writing posts'), "Boilerplate tips must be stripped!");
assert.ok(!details.promptText.includes('Participation is optional'), "Participation note must be stripped!");
console.log("✓ Test 2: Prompt extracted cleanly without tips.");

// TEST 3: Cleaning AI answers
console.log("Testing cleanDiscussionAnswer...");
const messyAiOutput = '```json\n{"response": "Here is my response: The MIPS and ARM architectures share a RISC foundation."}\n```';
const cleaned = runner.cleanDiscussionAnswer(messyAiOutput);
assert.strictEqual(cleaned, 'The MIPS and ARM architectures share a RISC foundation.', "Must unwrap JSON, strip code fences and intro");
console.log("✓ Test 3: AI response cleaned.");

// TEST 4: Finding editor and button
console.log("Testing findDiscussionReplyInput & findDiscussionReplyButton...");
const foundInput = runner.findDiscussionReplyInput();
assert.ok(foundInput, "Reply editor must be found");
assert.strictEqual(foundInput.isContentEditable, true, "Must find contenteditable editor");

const foundReplyBtn = runner.findDiscussionReplyButton(foundInput);
assert.ok(foundReplyBtn, "Reply button must be found");
assert.strictEqual(foundReplyBtn.innerText, 'Reply', "Button text must be Reply");
console.log("✓ Test 4: Editor and Reply button successfully located.");

// TEST 5: Typing into editor
console.log("Testing typeIntoEditor...");
runner.typeIntoEditor(foundInput, cleaned);
assert.strictEqual(foundInput.innerText, cleaned, "Text must be injected into editor");
assert.ok(foundInput.events.some(e => e.type === 'input'), "Input event must be fired");
assert.ok(foundInput.events.some(e => e.type === 'change'), "Change event must be fired");
console.log("✓ Test 5: Typing into editor works and fires input events.");

// TEST 6: Complete handleDiscussionPrompt lifecycle
console.log("Testing full handleDiscussionPrompt flow...");
let loggedMessages = [];
let statuses = [];
let nextClicked = false;

runner.handleDiscussionPrompt({
    showStatus: (s) => statuses.push(s),
    addLog: (m, t) => loggedMessages.push({ m, t }),
    triggerClick: (el) => { el.click(); },
    findNextItemButton: () => nextBtn,
    hasAnyApiKey: () => true,
    autoNavigate: true
});

setTimeout(() => {
    assert.ok(foundReplyBtn.clicked, "Reply button must be clicked by AutoPilot");
    assert.strictEqual(foundReplyBtn.disabled, false, "Disabled attribute must be removed to submit");
    console.log("✓ Test 6A: Reply button clicked and submitted.");
}, 1500);

setTimeout(() => {
    assert.ok(nextBtn.clicked, "Next button must be clicked after submission to proceed!");
    console.log("✓ Test 6B: Proceeded to next course item!");

    console.log("\n🎉 ALL DISCUSSION PROMPT TESTS PASSED SUCCESSFULLY!");
}, 4500);
