const assert = require('assert');

// Implementation of optimized text cleaning and matching logic
function cleanText(str) {
    return (str || '')
        .replace(/\u00a0/g, ' ')      // Non-breaking space &nbsp;
        .replace(/[\r\n\t]+/g, ' ')   // Newlines and tabs
        .replace(/\s+/g, ' ')         // Collapse multi-whitespace
        .trim()
        .toLowerCase();
}

function isExcludedButton(text, aria) {
    const combined = (text + ' ' + aria).toLowerCase();
    return /help\s+me\s+practice|review\s+learning|report\s+an\s+issue|go\s+to\s+next|next\s+item|next\s+question|cancel|back|close|dismiss|download|notes|transcript/i.test(combined);
}

function isStartMatch(text, aria, testId) {
    if (isExcludedButton(text, aria)) return false;

    // Check testId
    const tid = (testId || '').toLowerCase();
    if (tid.includes('start-assignment') || tid.includes('start-quiz') || 
        tid.includes('resume-assignment') || tid.includes('resume-quiz') ||
        tid.includes('take-quiz') || tid.includes('start-attempt') ||
        tid.includes('practice-again') || tid.includes('try-again')) {
        return true;
    }

    const t = cleanText(text);
    const a = cleanText(aria);

    // Exact or leading phrase matching
    const startRegex = /^(?:start|resume|continue|begin|take|retake)\s+(?:assignment|quiz|practice|attempt|test|exam)\b/i;
    if (startRegex.test(t) || startRegex.test(a)) return true;

    // Standalone strong start keywords
    const directRegex = /^(?:practice\s+again|try\s+again|retake\s+quiz|retake\s+assignment|retake|start\s+now|start)$/i;
    if (directRegex.test(t) || directRegex.test(a)) return true;

    // Substring match for compound labels e.g. "Start assignment (6 min)" or "Start assignment ›"
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

    // 1. Direct candidate matching
    for (const btn of candidates) {
        const text = btn.innerText || btn.textContent || '';
        const aria = btn.getAttribute('aria-label') || '';
        const testId = btn.getAttribute('data-testid') || '';
        if (isStartMatch(text, aria, testId)) return btn;

        // Check child label or text element inside button
        const labelEl = btn.querySelector ? btn.querySelector('.cds-button-label, [class*="label"], [class*="text"], span') : null;
        if (labelEl) {
            const lText = labelEl.innerText || labelEl.textContent || '';
            if (isStartMatch(lText, '', '')) return btn;
        }
    }

    // 2. Scan leaf text elements if candidates didn't match directly
    const textEls = Array.from(doc.querySelectorAll('span, p, div, b, strong')).filter(el => {
        if (el.children && el.children.length > 2) return false;
        const t = cleanText(el.innerText || el.textContent || '');
        return isStartMatch(t, '', '');
    });

    for (const tel of textEls) {
        const clickable = (tel.closest ? tel.closest('button, a, [role="button"], div[tabindex]') : null) || tel;
        if (clickable && !clickable.disabled && (clickable.getAttribute ? clickable.getAttribute('aria-disabled') !== 'true' : true)) {
            const cText = clickable.innerText || clickable.textContent || '';
            const cAria = clickable.getAttribute ? (clickable.getAttribute('aria-label') || '') : '';
            if (!isExcludedButton(cText, cAria)) {
                return clickable;
            }
        }
    }

    return null;
}

// TEST CASES
console.log('Running Comprehensive Start Test Button Detection Tests...\n');

// 1. Standard Coursera CDS button with child span
{
    const span = { textContent: 'Start assignment', children: [] };
    const btn = {
        tagName: 'BUTTON',
        innerText: 'Start assignment',
        children: [span],
        querySelector: (sel) => span,
        getAttribute: (attr) => attr === 'data-testid' ? 'action-button' : null
    };
    span.closest = (sel) => btn;
    const doc = { querySelectorAll: (sel) => [btn, span] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, btn, 'Case 1 Failed: CDS button with child span');
    console.log('✅ Case 1: CDS button with child span matched.');
}

// 2. Button with &nbsp; (non-breaking space)
{
    const btn = {
        tagName: 'BUTTON',
        innerText: 'Start\u00a0assignment',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const doc = { querySelectorAll: () => [btn] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, btn, 'Case 2 Failed: Non-breaking space');
    console.log('✅ Case 2: Non-breaking space button matched.');
}

// 3. Anchor tag with attempt URL
{
    const anchor = {
        tagName: 'A',
        href: '/learn/course/assignment-submission/123/attempt',
        innerText: 'Start assignment',
        children: [],
        querySelector: () => null,
        getAttribute: (attr) => attr === 'role' ? 'button' : null
    };
    const doc = { querySelectorAll: () => [anchor] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, anchor, 'Case 3 Failed: Anchor tag');
    console.log('✅ Case 3: Anchor tag matched.');
}

// 4. Coursera div[role="button"]
{
    const div = {
        tagName: 'DIV',
        innerText: 'Start assignment',
        children: [],
        querySelector: () => null,
        getAttribute: (attr) => attr === 'role' ? 'button' : null
    };
    const doc = { querySelectorAll: () => [div] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, div, 'Case 4 Failed: div[role="button"]');
    console.log('✅ Case 4: div[role="button"] matched.');
}

// 5. Button with long aria-label
{
    const btn = {
        tagName: 'BUTTON',
        innerText: 'Start',
        children: [],
        querySelector: () => null,
        getAttribute: (attr) => attr === 'aria-label' ? 'Start assignment: Practice Quiz: Defining Computer Performance: Performance Equations' : null
    };
    const doc = { querySelectorAll: () => [btn] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, btn, 'Case 5 Failed: Long aria-label');
    console.log('✅ Case 5: Button with long descriptive aria-label matched.');
}

// 6. Button with trailing metadata: "Start assignment (6 min)"
{
    const btn = {
        tagName: 'BUTTON',
        innerText: 'Start assignment (6 min)',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const doc = { querySelectorAll: () => [btn] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, btn, 'Case 6 Failed: Trailing metadata');
    console.log('✅ Case 6: Button with trailing duration/metadata matched.');
}

// 7. Modal Confirmation "Start attempt"
{
    const cancelBtn = {
        tagName: 'BUTTON',
        innerText: 'Cancel',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const startAttemptBtn = {
        tagName: 'BUTTON',
        innerText: 'Start attempt',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const doc = { querySelectorAll: () => [cancelBtn, startAttemptBtn] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, startAttemptBtn, 'Case 7 Failed: Modal Start attempt');
    console.log('✅ Case 7: Modal "Start attempt" matched, Cancel ignored.');
}

// 8. Retake Quiz "Practice again" or "Try again"
{
    const retakeBtn = {
        tagName: 'BUTTON',
        innerText: 'Practice again',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const doc = { querySelectorAll: () => [retakeBtn] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, retakeBtn, 'Case 8 Failed: Practice again');
    console.log('✅ Case 8: "Practice again" button matched.');
}

// 9. Negative exclusions: "Help me practice", "Go to next item →" MUST NOT MATCH
{
    const helpBtn = {
        tagName: 'BUTTON',
        innerText: 'Help me practice',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const nextBtn = {
        tagName: 'BUTTON',
        innerText: 'Go to next item →',
        children: [],
        querySelector: () => null,
        getAttribute: () => null
    };
    const doc = { querySelectorAll: () => [helpBtn, nextBtn] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, null, 'Case 9 Failed: Excluded buttons matched');
    console.log('✅ Case 9: Exclusions ("Help me practice", "Go to next item") safely ignored.');
}

// 10. Deeply nested span in complex wrapper
{
    const innerSpan = {
        tagName: 'SPAN',
        innerText: 'Start assignment',
        textContent: 'Start assignment',
        children: []
    };
    const outerBtn = {
        tagName: 'BUTTON',
        innerText: 'Icon Start assignment',
        textContent: 'Icon Start assignment',
        children: [innerSpan],
        querySelector: () => innerSpan,
        getAttribute: () => null
    };
    innerSpan.closest = (sel) => outerBtn;
    const doc = { querySelectorAll: () => [outerBtn, innerSpan] };
    const found = findStartTestButton(doc);
    assert.strictEqual(found, outerBtn, 'Case 10 Failed: Deeply nested span');
    console.log('✅ Case 10: Deeply nested span returned parent clickable button.');
}

console.log('\n🌟 ALL 10 COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS!');
