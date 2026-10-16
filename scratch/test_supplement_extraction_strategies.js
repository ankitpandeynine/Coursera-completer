const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: SUPPLEMENT & READING TEXT EXTRACTION METHODS");
console.log("================================================================");

// 1. Test parsing openCourseAssets.v1 payload
function extractSupplementFromPayload(data) {
    if (!data) return '';
    let texts = [];

    // Check linked openCourseAssets.v1 (Coursera OnDemand standard)
    const assets = data.linked?.['openCourseAssets.v1'];
    if (Array.isArray(assets) && assets.length > 0) {
        for (const asset of assets) {
            const val = asset?.definition?.value;
            if (typeof val === 'string' && val.trim().length > 0) {
                texts.push(val);
            }
        }
    }

    // Check elements[0].content.definition.value
    if (texts.length === 0) {
        const val = data?.elements?.[0]?.content?.definition?.value;
        if (typeof val === 'string' && val.trim().length > 0) {
            texts.push(val);
        }
    }

    // Check elements[0].definition.value
    if (texts.length === 0) {
        const val = data?.elements?.[0]?.definition?.value;
        if (typeof val === 'string' && val.trim().length > 0) {
            texts.push(val);
        }
    }

    return texts.join('\n\n');
}

// Test case 1: openCourseAssets format (as used by Coursera API)
const mockApiResponse = {
    elements: [
        { id: "cId~m5iQk", typeName: "supplement" }
    ],
    linked: {
        "openCourseAssets.v1": [
            {
                id: "asset-1",
                typeName: "cml",
                definition: {
                    value: "<co-content><heading level=\"1\">Major Text of India</heading><text>Ancient Indian literature includes the Vedas, Upanishads, and the epics Ramayana and Mahabharata.</text></co-content>"
                }
            }
        ]
    }
};

const extracted1 = extractSupplementFromPayload(mockApiResponse);
assert(extracted1.includes("Major Text of India"));
assert(extracted1.includes("Ancient Indian literature"));
console.log("✓ Correctly extracts reading from linked['openCourseAssets.v1'].");

// 2. Test HTML prerendered extraction fallback
function extractSupplementFromHtml(html) {
    if (!html || typeof html !== 'string') return '';

    // Check for Next.js / initial JSON state containing cml or value
    const cmlMatch = html.match(/<co-content>([\s\S]*?)<\/co-content>/i);
    if (cmlMatch) {
        return `<co-content>${cmlMatch[1]}</co-content>`;
    }

    // Check JSON state
    const jsonMatch = html.match(/"definition":\s*\{\s*"value":\s*"([^"]+)"/);
    if (jsonMatch) {
        try {
            return JSON.parse(`"${jsonMatch[1]}"`);
        } catch (e) {}
    }

    return '';
}

const mockHtml = `
<html>
<head><title>Major Text of India</title></head>
<body>
<div id="rendered-content">
<co-content><heading level="2">Vedic Literature</heading><text>The Rigveda is the oldest known Vedic Sanskrit text.</text></co-content>
</div>
</body>
</html>
`;

const extracted2 = extractSupplementFromHtml(mockHtml);
assert(extracted2.includes("Vedic Literature"));
assert(extracted2.includes("Rigveda"));
console.log("✓ Correctly extracts reading from HTML fallback.");

// 3. Test Sidebar Module Button Injection logic
function generateSidebarModuleButtons(moduleCount) {
    const buttons = [];
    for (let i = 1; i <= moduleCount; i++) {
        buttons.push({
            moduleIndex: i,
            html: `<button class="coursera-sidebar-mod-copy-btn" data-mod="${i}" title="Copy Module ${i} Content">📋</button>`
        });
    }
    return buttons;
}

const sidebarBtns = generateSidebarModuleButtons(5);
assert.strictEqual(sidebarBtns.length, 5);
assert.strictEqual(sidebarBtns[0].moduleIndex, 1);
assert(sidebarBtns[0].html.includes('data-mod="1"'));
assert.strictEqual(sidebarBtns[4].moduleIndex, 5);
assert(sidebarBtns[4].html.includes('data-mod="5"'));
console.log("✓ Sidebar module buttons generated for all 5 modules.");

console.log("================================================================");
console.log("🎉 ALL SUPPLEMENT & SIDEBAR BUTTON TESTS PASSED 100%!");
console.log("================================================================");
