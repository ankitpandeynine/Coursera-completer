const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING: FULL COURSE COMPILATION (ALL MODULES)");
console.log("================================================================");

function compileFullCourseMarkdown(courseData) {
    const { courseTitle, courseSlug, modules } = courseData;
    let totalReadings = 0;
    let totalVideos = 0;
    let totalItems = 0;

    modules.forEach(m => {
        m.items.forEach(it => {
            totalItems++;
            if (it.type === 'reading') totalReadings++;
            if (it.type === 'video') totalVideos++;
        });
    });

    let md = `# ${courseTitle} - Complete Course Notes & Transcripts\n`;
    md += `**Course**: ${courseSlug}\n`;
    md += `**Total Modules**: ${modules.length} | **Total Items**: ${totalItems} (${totalReadings} Readings, ${totalVideos} Video Transcripts)\n`;
    md += `\n${'='.repeat(70)}\n\n`;

    modules.forEach((mod, modIdx) => {
        const mNum = modIdx + 1;
        const modReadings = mod.items.filter(it => it.type === 'reading').length;
        const modVideos = mod.items.filter(it => it.type === 'video').length;

        md += `# 📚 Module ${mNum}: ${mod.title}\n`;
        md += `*Module Items*: ${mod.items.length} (${modReadings} Readings, ${modVideos} Videos)\n\n`;
        md += `---\n\n`;

        mod.items.forEach((item, itemIdx) => {
            const iNum = itemIdx + 1;
            if (item.type === 'reading') {
                md += `## ${mNum}.${iNum} 📖 [Reading] ${item.title}\n\n`;
                md += `${item.content}\n\n`;
            } else if (item.type === 'video') {
                md += `## ${mNum}.${iNum} 🎬 [Video Transcript] ${item.title}\n\n`;
                md += `${item.content}\n\n`;
            }
            md += `---\n\n`;
        });

        md += `\n${'='.repeat(70)}\n\n`;
    });

    return md.trim();
}

const mockCourse = {
    courseTitle: "Understanding India",
    courseSlug: "understanding-india",
    modules: [
        {
            title: "Indian culture",
            items: [
                { type: 'reading', title: "Introduction to 'Understanding India'", content: "Intro text about Indian culture." },
                { type: 'video', title: "Culture : Definition and Scope in Indian Context", content: "[00:00] Welcome students to culture definition." }
            ]
        },
        {
            title: "Tangible Heritage Aspects",
            items: [
                { type: 'reading', title: "Major Text of India", content: "Ancient Indian literature includes the Vedas and Epics." },
                { type: 'reading', title: "Architectural Marvels of India", content: "Temple architecture and cave structures." }
            ]
        }
    ]
};

const fullMd = compileFullCourseMarkdown(mockCourse);
console.log(fullMd);

assert(fullMd.includes("# Understanding India - Complete Course Notes & Transcripts"));
assert(fullMd.includes("**Total Modules**: 2"));
assert(fullMd.includes("# 📚 Module 1: Indian culture"));
assert(fullMd.includes("## 1.1 📖 [Reading] Introduction to 'Understanding India'"));
assert(fullMd.includes("# 📚 Module 2: Tangible Heritage Aspects"));
assert(fullMd.includes("## 2.1 📖 [Reading] Major Text of India"));
assert(fullMd.includes("Ancient Indian literature includes the Vedas and Epics."));
console.log("✓ Full Course compilation formats all modules, readings, and transcripts seamlessly.");

console.log("================================================================");
console.log("🎉 ALL FULL COURSE COMPILATION TESTS PASSED 100%!");
console.log("================================================================");
