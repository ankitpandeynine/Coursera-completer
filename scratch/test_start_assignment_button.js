// Test Suite: Auto-Start Test & Quiz Landing Page Detection
const assert = require('assert');

function findStartTestButton(doc) {
    const candidates = Array.from(doc.querySelectorAll('button, a')).filter(el => {
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        const id = (el.id || '').toLowerCase();
        if (id.includes('coursera-speed') || id.includes('coursera-ai')) return false;
        return true;
    });

    return candidates.find(btn => {
        const t = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        const a = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        const testId = (btn.getAttribute('data-testid') || '').toLowerCase();

        // Exclude non-start buttons like "Help me practice", "Go to next item", etc.
        if (t.includes('help me practice') || t.includes('review learning objectives') || t.includes('report an issue')) {
            return false;
        }

        // Check explicit testIds
        if (testId.includes('start-assignment') || testId.includes('start-quiz') || 
            testId.includes('resume-assignment') || testId.includes('resume-quiz') ||
            testId.includes('take-quiz') || testId.includes('practice-again')) {
            return true;
        }

        // Check button text
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

console.log('--- TEST 1: User Screenshot Page (Practice Quiz: Start assignment) ---');
{
    let clicked = false;
    const mockDoc = {
        querySelectorAll: (sel) => [
            {
                tagName: 'BUTTON',
                innerText: 'Start assignment',
                disabled: false,
                getAttribute: () => null,
                click: () => { clicked = true; }
            },
            {
                tagName: 'BUTTON',
                innerText: 'Help me practice',
                disabled: false,
                getAttribute: () => null,
                click: () => { throw new Error('Wrong button clicked!'); }
            },
            {
                tagName: 'BUTTON',
                innerText: 'Go to next item →',
                disabled: false,
                getAttribute: () => null,
                click: () => { throw new Error('Should not advance before quiz is started/solved!'); }
            }
        ]
    };

    const btn = findStartTestButton(mockDoc);
    assert.ok(btn, 'Found "Start assignment" button');
    btn.click();
    assert.strictEqual(clicked, true, 'Successfully clicked "Start assignment" button');
    console.log('✅ Test 1 Passed: Detected and clicked "Start assignment" button!');
}

console.log('\n--- TEST 2: Confirmation Modal (Start attempt / Continue) ---');
{
    let modalClicked = false;
    const mockDoc = {
        querySelectorAll: (sel) => [
            {
                tagName: 'BUTTON',
                innerText: 'Cancel',
                disabled: false,
                getAttribute: () => null
            },
            {
                tagName: 'BUTTON',
                innerText: 'Start attempt',
                disabled: false,
                getAttribute: () => null,
                click: () => { modalClicked = true; }
            }
        ]
    };

    const btn = findStartTestButton(mockDoc);
    assert.ok(btn, 'Found "Start attempt" modal confirmation button');
    btn.click();
    assert.strictEqual(modalClicked, true, 'Successfully clicked "Start attempt"');
    console.log('✅ Test 2 Passed: Detected and clicked "Start attempt" modal button!');
}

console.log('\n--- TEST 3: Retake / Practice Again ---');
{
    let retakeClicked = false;
    const mockDoc = {
        querySelectorAll: (sel) => [
            {
                tagName: 'BUTTON',
                innerText: 'Practice again',
                disabled: false,
                getAttribute: () => null,
                click: () => { retakeClicked = true; }
            }
        ]
    };

    const btn = findStartTestButton(mockDoc);
    assert.ok(btn, 'Found "Practice again" button');
    btn.click();
    assert.strictEqual(retakeClicked, true, 'Successfully clicked "Practice again"');
    console.log('✅ Test 3 Passed: Detected and clicked "Practice again" button!');
}

console.log('\n>>> ALL START TEST BUTTON TESTS PASSED! <<<');
