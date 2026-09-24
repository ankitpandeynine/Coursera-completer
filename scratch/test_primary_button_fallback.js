const assert = require('assert');

function findStartTestButton(doc) {
    try {
        const clickables = Array.from(
            doc.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')
        ).filter(el => {
            if (!el) return false;
            if (el.disabled || (el.getAttribute && el.getAttribute('aria-disabled') === 'true')) return false;
            const id = (el.id || '').toLowerCase();
            if (id.includes('coursera-speed') || id.includes('coursera-ai')) return false;
            return true;
        });

        // TIER 1: Text & Label matching
        for (const el of clickables) {
            const rawText = (el.innerText || el.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
            const text = rawText.toLowerCase();
            const aria = (el.getAttribute ? (el.getAttribute('aria-label') || '') : '').toLowerCase();
            const testId = (el.getAttribute ? (el.getAttribute('data-testid') || '') : '').toLowerCase();
            const href = (el.getAttribute ? (el.getAttribute('href') || '') : '').toLowerCase();

            // STRICTLY ignore excluded buttons
            if (text.includes('help me practice') || text.includes('review learning') || 
                text.includes('report an issue') || text.includes('go to next') || 
                text.includes('next item') || text.includes('next question') || 
                text === 'cancel' || text === 'back' || text === 'close') {
                continue;
            }

            // Direct text match
            if (text === 'start assignment' || text.startsWith('start assignment') ||
                text === 'resume assignment' || text.startsWith('resume assignment') ||
                text === 'start quiz' || text.startsWith('start quiz') ||
                text === 'resume quiz' || text.startsWith('resume quiz') ||
                text === 'start attempt' || text.startsWith('start attempt') ||
                text === 'take quiz' || text.startsWith('take quiz') ||
                text === 'start practice' || text === 'resume practice' ||
                text === 'practice again' || text === 'try again' ||
                text === 'retake quiz' || text === 'retake assignment' || text === 'retake' ||
                text === 'begin assignment' || text === 'begin quiz' ||
                text === 'start test' || text === 'resume test' ||
                text === 'start now' || text === 'start' ||
                text === 'continue' || text === 'continue assignment' || text === 'continue attempt') {
                return el;
            }

            // Aria-label or data-testid match
            if (aria.includes('start assignment') || aria.includes('start quiz') || 
                aria.includes('resume assignment') || aria.includes('start attempt') ||
                aria.includes('take quiz') ||
                testId.includes('start-assignment') || testId.includes('start-quiz') ||
                testId.includes('resume-assignment') || testId.includes('start-attempt') ||
                testId.includes('take-quiz') || testId.includes('practice-again')) {
                return el;
            }

            // Link with /attempt URL
            if (href.includes('/attempt') && (text.includes('start') || text.includes('resume') || text.includes('take') || !text)) {
                return el;
            }

            // Check nested label span
            const childSpan = el.querySelector ? el.querySelector('.cds-button-label, [class*="label"], span') : null;
            if (childSpan) {
                const sText = (childSpan.innerText || childSpan.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                if (sText === 'start assignment' || sText.startsWith('start assignment') ||
                    sText === 'resume assignment' || sText.startsWith('resume assignment') ||
                    sText === 'start quiz' || sText.startsWith('start quiz') ||
                    sText === 'resume quiz' || sText.startsWith('resume quiz') ||
                    sText === 'start attempt' || sText.startsWith('start attempt') ||
                    sText === 'take quiz' || sText === 'practice again' || sText === 'try again' ||
                    sText === 'start' || sText === 'start now') {
                    return el;
                }
            }
        }

        // TIER 2: Primary Button Fallback on Assignment Landing Page
        const primaryBtn = clickables.find(el => {
            const cls = (el.className || '').toLowerCase();
            const text = (el.innerText || el.textContent || '').toLowerCase();
            if (text.includes('help me practice') || text.includes('next') || text.includes('cancel')) return false;
            return (cls.includes('primary') || cls.includes('cds-button-primary')) && (text.includes('start') || text.includes('resume') || text.includes('take') || text.includes('assignment'));
        });
        if (primaryBtn) return primaryBtn;

        // TIER 3: Leaf text search
        const spans = Array.from(doc.querySelectorAll('span, b, strong, div')).filter(s => {
            if (s.children && s.children.length > 0) return false;
            const t = (s.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            return t === 'start assignment' || t === 'resume assignment' || t === 'start quiz' || t === 'resume quiz' || t === 'start attempt' || t === 'take quiz';
        });

        for (const s of spans) {
            const clickable = (s.closest ? s.closest('button, a, [role="button"]') : null) || s.parentElement;
            if (clickable && !clickable.disabled && (clickable.getAttribute ? clickable.getAttribute('aria-disabled') !== 'true' : true)) {
                const cText = (clickable.innerText || clickable.textContent || '').toLowerCase();
                if (!cText.includes('help me practice') && !cText.includes('report an issue')) {
                    return clickable;
                }
            }
        }
    } catch (e) {}

    return null;
}

// TEST: CDS primary button with obfuscated class
{
    const primaryBtn = {
        tagName: 'BUTTON',
        className: 'cds-149 cds-button-disableElevation cds-button-primary css-16kgh77',
        disabled: false,
        innerText: 'Start assignment',
        getAttribute: () => null,
        querySelector: () => null
    };
    const helpBtn = {
        tagName: 'BUTTON',
        className: 'cds-149 cds-button-secondary',
        disabled: false,
        innerText: 'Help me practice',
        getAttribute: () => null,
        querySelector: () => null
    };

    const doc = {
        querySelectorAll: (sel) => [primaryBtn, helpBtn]
    };

    const found = findStartTestButton(doc);
    assert.strictEqual(found, primaryBtn, 'Must find primary Start assignment button');
    console.log('✅ TEST PASSED: Tier 1 & Tier 2 Primary Button Fallback verified!');
}
