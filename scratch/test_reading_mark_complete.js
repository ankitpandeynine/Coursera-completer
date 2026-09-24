// Test Suite: Reading Material "Mark as completed" Blue Button & Navigation Logic
const assert = require('assert');

function isButtonActiveAndBlue(btn) {
    if (!btn) return false;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
    
    try {
        const style = btn.style || {};
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
            return false;
        }
        if (style.opacity && parseFloat(style.opacity) < 0.5) return false;

        const bg = style.backgroundColor || '';
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
            const r = parseInt(m[1], 10);
            const g = parseInt(m[2], 10);
            const b = parseInt(m[3], 10);
            // Blue dominant or CDS primary blue (e.g. rgb(0, 86, 210), rgb(153, 192, 246), rgb(138, 180, 248))
            const isBlue = (b > r + 15) && (b >= 90);
            if (isBlue) return true;
        }

        const cls = (btn.className || '').toLowerCase();
        if (cls.includes('primary') || cls.includes('cds-button')) return true;
    } catch (e) {}

    return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
}

console.log('--- TEST 1: Button color and active state detection ---');
{
    // Inactive grey disabled button
    const greyBtn = {
        disabled: true,
        getAttribute: (attr) => attr === 'aria-disabled' ? 'true' : null,
        style: { backgroundColor: 'rgb(220, 220, 220)' },
        className: 'cds-button'
    };
    assert.strictEqual(isButtonActiveAndBlue(greyBtn), false, 'Grey disabled button correctly identified as inactive');

    // Active blue button (Coursera dark mode: rgb(153, 192, 246))
    const blueBtn = {
        disabled: false,
        getAttribute: (attr) => attr === 'aria-disabled' ? 'false' : null,
        style: { backgroundColor: 'rgb(153, 192, 246)' },
        className: 'cds-button cds-button--primary'
    };
    assert.strictEqual(isButtonActiveAndBlue(blueBtn), true, 'Active blue button correctly identified as ready to click');

    // Active blue button (Coursera standard mode: rgb(0, 86, 210))
    const standardBlueBtn = {
        disabled: false,
        getAttribute: (attr) => null,
        style: { backgroundColor: 'rgb(0, 86, 210)' },
        className: 'cds-button'
    };
    assert.strictEqual(isButtonActiveAndBlue(standardBlueBtn), true, 'Standard blue button correctly identified');
    console.log('✅ Test 1 Passed: Accurate active blue button detection');
}

console.log('\n--- TEST 2: Reading flow ignores playing audio & waits for blue button ---');
{
    let hasClickedMark = false;
    let hasClickedNext = false;
    let buttonState = 'INACTIVE'; // starts grey

    // Simulate reading lifecycle
    const audio = { paused: false, ended: false, currentTime: 85, duration: 343 }; // 1:25 / 5:43
    const markBtn = {
        disabled: true,
        getAttribute: (attr) => buttonState === 'INACTIVE' ? 'true' : 'false',
        style: { backgroundColor: 'rgb(200, 200, 200)' },
        click: () => { hasClickedMark = true; }
    };
    const nextBtn = {
        click: () => { hasClickedNext = true; }
    };

    function simulateAutopilotTick(timeElapsedSec) {
        // Look for mark as completed button
        if (markBtn) {
            const isActive = isButtonActiveAndBlue(markBtn);
            if (!isActive) {
                // Waiting for button to become blue
                return { action: 'WAIT_FOR_BLUE', audioIgnored: true };
            }

            if (!hasClickedMark) {
                markBtn.click();
                return { action: 'CLICK_MARK_COMPLETED' };
            } else {
                nextBtn.click();
                return { action: 'CLICK_NEXT_ITEM' };
            }
        }
    }

    // Tick 1: Button is still inactive grey, audio is playing
    const tick1 = simulateAutopilotTick(1);
    assert.strictEqual(tick1.action, 'WAIT_FOR_BLUE');
    assert.strictEqual(hasClickedMark, false);
    assert.strictEqual(hasClickedNext, false);

    // Tick 2: Coursera activates button (becomes blue)
    buttonState = 'ACTIVE';
    markBtn.disabled = false;
    markBtn.style.backgroundColor = 'rgb(153, 192, 246)'; // blue

    const tick2 = simulateAutopilotTick(2);
    assert.strictEqual(tick2.action, 'CLICK_MARK_COMPLETED');
    assert.strictEqual(hasClickedMark, true, 'Clicked Mark as completed button as soon as it turned blue');
    assert.strictEqual(hasClickedNext, false);

    // Tick 3: Advance to next item
    const tick3 = simulateAutopilotTick(3);
    assert.strictEqual(tick3.action, 'CLICK_NEXT_ITEM');
    assert.strictEqual(hasClickedNext, true, 'Advanced to next item without waiting for audio to finish');

    console.log('✅ Test 2 Passed: Successfully bypassed audio wait, clicked blue button and advanced to next item!');
}

console.log('\n>>> ALL READING BUTTON TESTS PASSED! <<<');
