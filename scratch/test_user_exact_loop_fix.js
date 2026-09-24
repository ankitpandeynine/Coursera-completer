const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: SUBMIT BUTTON FINDER & CONFIRMATION MODAL LOGIC");
console.log("================================================================");

// Mock DOM structure representing Coursera's assignment-submission view from user screenshot:
// The entire attempt is inside <div class="cds-FullscreenDialog-dialog" role="dialog">
const mockPage = {
    roleDialogContainer: {
        role: "dialog",
        className: "cds-FullscreenDialog-dialog",
        testId: "assignment-view-tunnel-vision",
        isAssignmentView: true
    },
    honorCode: {
        testId: "HonorCodeAgreement",
        checked: true
    },
    submitControls: {
        e2e: "AttemptSubmitControls_buttons",
        buttons: [
            {
                testId: "submit-button",
                className: "cds-116 cds-button-disableElevation cds-button-primary css-dxhcv5",
                ariaLabel: "Submit",
                ariaDisabled: "false",
                text: "Submit",
                disabled: false
            },
            {
                testId: "save-draft-button",
                className: "cds-116 cds-button-disableElevation cds-button-secondary css-dxhcv5",
                ariaLabel: "Save draft",
                ariaDisabled: "false",
                text: "Save draft",
                disabled: false
            }
        ]
    }
};

// Mock confirmation dialog (Pic 1 / Step 2)
const mockConfirmationModal = {
    role: "dialog",
    className: "rc-Modal",
    text: "Ready to submit? You won't be able to change your answers.",
    buttons: [
        { text: "Cancel", disabled: false },
        { text: "Submit", disabled: false }
    ]
};

// Logic: isConfirmationDialog
function isConfirmationDialog(dialogEl) {
    if (!dialogEl) return false;
    // CRITICAL: Coursera wraps the whole quiz attempt in a fullscreen tunnel-vision dialog
    if (dialogEl.testId === 'assignment-view-tunnel-vision' ||
        (dialogEl.className && dialogEl.className.includes('cds-FullscreenDialog-dialog')) ||
        (dialogEl.className && dialogEl.className.includes('cds-Modal-container')) ||
        dialogEl.isAssignmentView) {
        return false;
    }
    const text = (dialogEl.text || '').toLowerCase();
    const hasConfirmationKeywords = text.includes('ready to submit') ||
                                    text.includes('are you sure') ||
                                    text.includes('submit your assignment') ||
                                    text.includes('submit quiz?') ||
                                    text.includes('submit assignment?');
    const hasCancel = (dialogEl.buttons || []).some(b => {
        const bt = (b.text || '').trim().toLowerCase();
        return bt === 'cancel' || bt.includes('cancel') || bt === 'go back';
    });
    return hasConfirmationKeywords || hasCancel;
}

// 1. Verify that the assignment attempt container is NOT considered a confirmation dialog
assert.strictEqual(
    isConfirmationDialog(mockPage.roleDialogContainer),
    false,
    "The assignment fullscreen container must NOT be treated as a confirmation dialog!"
);
console.log("✓ Test 1: Assignment container with role='dialog' correctly recognized as NOT a confirmation modal.");

// 2. Verify that the confirmation modal IS recognized
assert.strictEqual(
    isConfirmationDialog(mockConfirmationModal),
    true,
    "The 'Ready to submit?' modal must be recognized as a confirmation dialog!"
);
console.log("✓ Test 2: 'Ready to submit?' modal correctly recognized as a confirmation modal.");

// 3. Verify findSubmitButton finds the submit button and ignores 'Save draft'
function findMockSubmitButton(controls) {
    const btn = controls.buttons.find(b => {
        const testId = (b.testId || '').toLowerCase();
        const aria = (b.ariaLabel || '').toLowerCase();
        const text = (b.text || '').toLowerCase();
        if (text.includes('save draft') || aria.includes('save draft') || testId.includes('save-draft')) return false;
        return testId === 'submit-button' || aria === 'submit' || text === 'submit';
    });
    return btn || null;
}

const foundBtn = findMockSubmitButton(mockPage.submitControls);
assert(foundBtn !== null, "Submit button must be found!");
assert.strictEqual(foundBtn.text, "Submit");
assert.strictEqual(foundBtn.ariaDisabled, "false");
console.log("✓ Test 3: Submit button successfully found in AttemptSubmitControls_buttons while ignoring Save draft.");

console.log("================================================================");
console.log("🎉 ALL SUBMIT BUTTON & MODAL LOGIC TESTS PASSED 100%!");
console.log("================================================================");
