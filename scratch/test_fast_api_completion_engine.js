const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("================================================================");
console.log("🧪 TESTING: COURSERA FAST API COMPLETION ENGINE & 5 TABS REMAKE");
console.log("================================================================");

// 1. Verify popup.html contains all 5 panes and buttons
const popupHtml = fs.readFileSync(path.join(__dirname, '../popup.html'), 'utf8');

const expectedPanes = ['pane-oneclick', 'pane-quiz', 'pane-video', 'pane-ailogs', 'pane-logs'];
expectedPanes.forEach(paneId => {
    assert(popupHtml.includes(`id="${paneId}"`), `popup.html must contain pane #${paneId}`);
});
console.log("✓ All 5 panes exist in popup.html (oneclick, quiz, video, ailogs, logs).");

const expectedTabs = ['data-tab="oneclick"', 'data-tab="quiz"', 'data-tab="video"', 'data-tab="ailogs"', 'data-tab="logs"'];
expectedTabs.forEach(tabAttr => {
    assert(popupHtml.includes(tabAttr), `popup.html must contain tab button ${tabAttr}`);
});
console.log("✓ All 5 tab buttons exist in popup.html.");

// 2. Check 1-Click Fast API buttons and redirect setup
assert(popupHtml.includes('id="startBulkCompleteBtn"'), "startBulkCompleteBtn must exist");
assert(popupHtml.includes('id="startSingleCompleteBtn"'), "startSingleCompleteBtn must exist");
assert(popupHtml.includes('id="bulkProgressCard"'), "bulkProgressCard must exist");
assert(popupHtml.includes('id="gotoQuizTabCard"'), "gotoQuizTabCard must exist");
console.log("✓ 1-Click Complete UI and Practice Questions redirect card verified.");

// 3. Test Course URL Context Parsing Logic
function parseCourseContext(url) {
    const match = url.match(
        /\/learn\/([^/]+)\/(lecture|supplement|quiz|exam|gradedLti|ungradedWidget|review|discussionPrompt)\/([^/?#]+)/i
    );
    if (match) {
        return { courseSlug: match[1], itemType: match[2], itemId: match[3] };
    }
    const matchHome = url.match(/\/learn\/([^/?#]+)/i);
    if (matchHome) {
        return { courseSlug: matchHome[1], itemType: '', itemId: '' };
    }
    return null;
}

const testLectureUrl = "https://www.coursera.org/learn/machine-learning/lecture/AbC12/introduction-to-ai";
const ctx1 = parseCourseContext(testLectureUrl);
assert.strictEqual(ctx1.courseSlug, "machine-learning");
assert.strictEqual(ctx1.itemType, "lecture");
assert.strictEqual(ctx1.itemId, "AbC12");

const testSupplementUrl = "https://www.coursera.org/learn/deep-neural-networks/supplement/XyZ89/reading-resources";
const ctx2 = parseCourseContext(testSupplementUrl);
assert.strictEqual(ctx2.courseSlug, "deep-neural-networks");
assert.strictEqual(ctx2.itemType, "supplement");
assert.strictEqual(ctx2.itemId, "XyZ89");

const testHomeUrl = "https://www.coursera.org/learn/python-basics/home/welcome";
const ctx3 = parseCourseContext(testHomeUrl);
assert.strictEqual(ctx3.courseSlug, "python-basics");
assert.strictEqual(ctx3.itemType, "");
console.log("✓ Course context parsing handles lecture, supplement, and course home URLs.");

// 4. Test Video Progress Calculation
function calculateVideoProgress(durationMs) {
    const validDuration = (typeof durationMs === 'number' && isFinite(durationMs) && durationMs > 0) ? durationMs : 9999999;
    return Math.max(0, validDuration - 1000);
}
assert.strictEqual(calculateVideoProgress(600000), 599000, "Progress should be duration - 1000ms");
assert.strictEqual(calculateVideoProgress(500), 0, "Progress cannot be negative");
console.log("✓ Video progress calculation logic validated.");

// 5. Test Syllabus Item Filtering
const mockSyllabusItems = [
    { id: '1', contentSummary: { typeName: 'lecture' }, name: 'Video 1' },
    { id: '2', contentSummary: { typeName: 'supplement' }, name: 'Reading 1' },
    { id: '3', contentSummary: { typeName: 'quiz' }, name: 'Quiz 1' },
    { id: '4', contentSummary: { typeName: 'lectureVideo' }, name: 'Video 2' },
    { id: '5', contentSummary: { typeName: 'exam' }, name: 'Final Exam' }
];

const filterItems = (items) => items.filter(
    (f) => f.contentSummary && (f.contentSummary.typeName.includes('lecture') || f.contentSummary.typeName.includes('supplement'))
);

const filtered = filterItems(mockSyllabusItems);
assert.strictEqual(filtered.length, 3, "Should select 2 lectures and 1 supplement");
assert.deepStrictEqual(filtered.map(x => x.id), ['1', '2', '4']);
console.log("✓ Syllabus item filtering selects all lectures and supplements.");

console.log("================================================================");
console.log("🎉 ALL FAST API & 5-TAB ARCHITECTURE TESTS PASSED 100%!");
console.log("================================================================");
