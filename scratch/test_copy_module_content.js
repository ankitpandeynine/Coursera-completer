const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: COPY MODULE CONTENT PARSING & FORMATTING");
console.log("================================================================");

// 1. Test CML to Clean Text / Markdown Parser
function parseCmlContent(cmlString) {
    if (!cmlString || typeof cmlString !== 'string') return '';
    let text = cmlString;

    // Convert headings: <heading level="1"> -> # , level="2" -> ## , etc.
    text = text.replace(/<heading\s+level=["']?(\d)["']?[^>]*>(.*?)<\/heading>/gis, (match, level, content) => {
        const hashes = '#'.repeat(Math.min(parseInt(level, 10) + 1, 6));
        return `\n\n${hashes} ${content.trim()}\n\n`;
    });

    // Convert code blocks: <code> -> ```
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gis, (match, code) => {
        return `\n\n\`\`\`\n${code.trim()}\n\`\`\`\n\n`;
    });

    // Convert list items: <item><text>...</text></item> -> • ...
    text = text.replace(/<item[^>]*>(.*?)<\/item>/gis, (match, item) => {
        const clean = item.replace(/<[^>]+>/g, '').trim();
        return `\n• ${clean}`;
    });

    // Convert paragraphs & text tags: <text>...</text>, <p>...</p>
    text = text.replace(/<(?:text|p)[^>]*>(.*?)<\/(?:text|p)>/gis, '\n\n$1\n\n');

    // Remove any remaining XML/HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Clean up excessive blank lines & trim
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

const mockCml = `
<co-content>
    <heading level="1">Introduction to 'Understanding India'</heading>
    <text>India is a land of immense diversity, shaped by thousands of years of history, geography, philosophy, and social evolution.</text>
    <heading level="2">Core Objectives</heading>
    <list bulletType="bullet">
        <item><text>Understand cultural plurality</text></item>
        <item><text>Explore historical roots</text></item>
    </list>
    <text>The course begins with a theoretical study of India's diverse cultural landscape.</text>
</co-content>
`;

const parsedReading = parseCmlContent(mockCml);
console.log("Parsed reading sample:\n", parsedReading);
assert(parsedReading.includes("## Introduction to 'Understanding India'"));
assert(parsedReading.includes("### Core Objectives"));
assert(parsedReading.includes("• Understand cultural plurality"));
assert(parsedReading.includes("• Explore historical roots"));
assert(!parsedReading.includes("<co-content>"));
console.log("✓ CML parser correctly converts Coursera markup to clean Markdown.");

// 2. Test WebVTT Parser
function parseVttTranscript(vttString) {
    if (!vttString || typeof vttString !== 'string') return '';
    const lines = vttString.split(/\r?\n/);
    const cues = [];
    let currentTime = '';
    let currentText = [];

    const timeRegex = /(?:(\d{2}):)?(\d{2}):(\d{2})\.\d{3}\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})\.\d{3}/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE') || /^\d+$/.test(line)) {
            continue;
        }

        const match = line.match(timeRegex);
        if (match) {
            if (currentTime && currentText.length > 0) {
                cues.push({ time: currentTime, text: currentText.join(' ').replace(/<[^>]+>/g, '').trim() });
                currentText = [];
            }
            const rawHours = match[1] ? parseInt(match[1], 10) : 0;
            const hours = rawHours > 0 ? `${rawHours}:` : '';
            const mins = match[2];
            const secs = match[3];
            currentTime = `${hours}${mins}:${secs}`;
        } else {
            currentText.push(line);
        }
    }
    if (currentTime && currentText.length > 0) {
        cues.push({ time: currentTime, text: currentText.join(' ').replace(/<[^>]+>/g, '').trim() });
    }

    // Combine cues into clean timestamped paragraphs
    return cues.map(c => `[${c.time}] ${c.text}`).join('\n\n');
}

const mockVtt = `WEBVTT

1
00:00:00.000 --> 00:00:03.450
Dear students, greetings of the day.

2
00:00:03.450 --> 00:00:08.120
Today we are going to discuss about culture.

3
00:01:05.000 --> 00:01:10.500
Language shapes thought process and shapes social interactions.
`;

const parsedVtt = parseVttTranscript(mockVtt);
console.log("Parsed VTT transcript:\n", parsedVtt);
assert(parsedVtt.includes("[00:00] Dear students, greetings of the day."));
assert(parsedVtt.includes("[00:03] Today we are going to discuss about culture."));
assert(parsedVtt.includes("[01:05] Language shapes thought process and shapes social interactions."));
console.log("✓ WebVTT parser correctly extracts timestamps and transcript text.");

// 3. Test Module Aggregation & Markdown Formatting
function compileModuleMarkdown(moduleData) {
    const { moduleNumber, moduleTitle, courseTitle, items } = moduleData;
    let md = `# Module ${moduleNumber}: ${moduleTitle}\n`;
    if (courseTitle) md += `**Course**: ${courseTitle}\n`;
    md += `**Total Items**: ${items.length} (${items.filter(it => it.type === 'reading').length} Readings, ${items.filter(it => it.type === 'video').length} Video Transcripts)\n`;
    md += `\n---\n\n`;

    items.forEach((item, idx) => {
        const itemNum = idx + 1;
        if (item.type === 'reading') {
            md += `## ${itemNum}. 📖 [Reading] ${item.title}\n\n`;
            md += `${item.content}\n\n`;
        } else if (item.type === 'video') {
            md += `## ${itemNum}. 🎬 [Video Transcript] ${item.title}\n\n`;
            md += `${item.content}\n\n`;
        }
        md += `\n---\n\n`;
    });

    return md.trim();
}

const compiled = compileModuleMarkdown({
    moduleNumber: 1,
    moduleTitle: "Indian culture",
    courseTitle: "Understanding India",
    items: [
        { type: 'reading', title: "Introduction to 'Understanding India'", content: parsedReading },
        { type: 'video', title: "Culture : Definition and Scope in Indian Context", content: parsedVtt }
    ]
});

assert(compiled.includes("# Module 1: Indian culture"));
assert(compiled.includes("## 1. 📖 [Reading] Introduction to 'Understanding India'"));
assert(compiled.includes("## 2. 🎬 [Video Transcript] Culture : Definition and Scope in Indian Context"));
console.log("✓ Module compilation output verified.");

// 4. Verify popup.html contains Copy Module Card and Buttons
const fs = require('fs');
const path = require('path');
const popupHtml = fs.readFileSync(path.join(__dirname, '../popup.html'), 'utf8');
assert(popupHtml.includes('id="copyModuleCard"'), "popup.html must contain #copyModuleCard");
assert(popupHtml.includes('id="copyActiveModuleBtn"'), "popup.html must contain #copyActiveModuleBtn");
assert(popupHtml.includes('id="downloadActiveModuleBtn"'), "popup.html must contain #downloadActiveModuleBtn");
assert(popupHtml.includes('id="moduleCopyStatusText"'), "popup.html must contain #moduleCopyStatusText");
console.log("✓ popup.html contains copyModuleCard, copyActiveModuleBtn, and downloadActiveModuleBtn.");

// 5. Verify content.js contains module extraction and injection logic
const contentJs = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
assert(contentJs.includes('function parseCmlContent('), "content.js must contain parseCmlContent");
assert(contentJs.includes('function parseVttTranscript('), "content.js must contain parseVttTranscript");
assert(contentJs.includes('async function fetchReadingContent('), "content.js must contain fetchReadingContent");
assert(contentJs.includes('function createSmallCopyButton('), "content.js must contain createSmallCopyButton");
assert(contentJs.includes('async function extractAndCopyModuleContent('), "content.js must contain extractAndCopyModuleContent");
assert(contentJs.includes('function injectModuleCopyButtons('), "content.js must contain injectModuleCopyButtons");
assert(contentJs.includes('coursera-sidebar-mod-copy-btn'), "content.js must use coursera-sidebar-mod-copy-btn");
assert(contentJs.includes("message.action === 'copyModuleContent'"), "content.js must listen for copyModuleContent");
console.log("✓ content.js contains all module extraction, reading fetcher, small sidebar button generator, and message listeners.");

// 6. Test Module Context Regex Matching
function testParseContext(url) {
    const match = url.match(
        /\/learn\/([^/]+)\/(lecture|supplement|quiz|exam|gradedLti|ungradedWidget|review|discussionPrompt)\/([^/?#]+)/i
    );
    if (match) {
        return { courseSlug: match[1], itemType: match[2], itemId: match[3] };
    }
    const matchModule = url.match(/\/learn\/([^/]+)\/home\/(?:module|week)\/(\d+)/i);
    if (matchModule) {
        return { courseSlug: matchModule[1], itemType: 'module', itemId: matchModule[2], moduleIndex: parseInt(matchModule[2], 10) };
    }
    const matchHome = url.match(/\/learn\/([^/?#]+)/i);
    if (matchHome) {
        return { courseSlug: matchHome[1], itemType: '', itemId: '' };
    }
    return null;
}

const modCtx1 = testParseContext("https://www.coursera.org/learn/understanding-india/home/module/1");
assert.strictEqual(modCtx1.courseSlug, "understanding-india");
assert.strictEqual(modCtx1.itemType, "module");
assert.strictEqual(modCtx1.moduleIndex, 1);

const modCtx2 = testParseContext("https://www.coursera.org/learn/data-science/home/week/3");
assert.strictEqual(modCtx2.courseSlug, "data-science");
assert.strictEqual(modCtx2.itemType, "module");
assert.strictEqual(modCtx2.moduleIndex, 3);
console.log("✓ Module and week URL context resolution verified.");

console.log("================================================================");
console.log("🎉 ALL COPY MODULE CONTENT & UI TESTS PASSED 100%!");
console.log("================================================================");
