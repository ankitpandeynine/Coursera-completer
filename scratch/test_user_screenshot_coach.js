const assert = require('assert');

// Exact text from the user's screenshot
const screenshotText = `
Introduction to Computing Systems
Today's goals
Instruction Overview
Video • 14 min
Practice Quiz: Instruction Overview
Practice Assignment • Grade: 100%
Instruction Cycle
Video • 11 min
Practice Quiz: Instruction Cycle
Practice Assignment • Grade: 0%
Instruction Processing
Reading • 10 min
Dialogue and Assessment
Computer Architecture Integration
Dialogue • 30 min
Let's Practice: Computer Organization and Architecture
Practice Assignment • Grade: 100%
Test Yourself: Computer Organization and Architecture
Graded Assignment • 30 min
Module 5
ISA of LC-3
Module 6
⚡ Waiting for AI coach prompt...

Computer Architecture Integration
Dialogue

End Dialogue

Welcome! In this Dialogue, we'll explore how computer components work together and how the von Neumann architecture...

Here's what we'll cover:
• Architecture Comparison: We'll evaluate the advantages and disadvantages...
• System Integration: We'll trace how data flows...
• LC-3 Foundation: We'll connect architectural principles...

Need help? Click "I'm stuck" at the top right to get a hint.

When you're ready, click "Start Dialogue"

Great! Let's begin by diving into Architecture Comparison. Can you tell me some of the key differences between the von Neumann and Harvard architectures?

Send a message
Dialogue is powered by AI, so check for mistakes and don't share any personal/sensitive information.
`;

function extractLatestCoachMessageFromTextOld(fullText, sentMessages = []) {
    if (!fullText) return '';
    let clean = fullText;

    // 1. Strip composer boilerplate and footer info
    clean = clean.replace(/Dialogue is powered by AI[\s\S]*$/i, '');
    clean = clean.replace(/Send a message[\s\S]*$/i, '');
    clean = clean.replace(/End Dialogue/gi, '');
    clean = clean.replace(/I'm stuck/gi, '');

    // 2. Strip everything before "Start Dialogue" if present (removes intro / objectives)
    if (/Start Dialogue/i.test(clean)) {
        const parts = clean.split(/Start Dialogue["']?/i);
        clean = parts[parts.length - 1];
    }

    // 3. Split into blocks by double newline or distinct paragraphs
    let blocks = clean.split(/\n\s*\n/)
        .map(b => b.replace(/\s+/g, ' ').trim())
        .filter(b => b.length > 15);

    // If no double-spaced blocks, try splitting by single newlines for compact formatting
    if (blocks.length === 0) {
        blocks = clean.split('\n')
            .map(b => b.replace(/\s+/g, ' ').trim())
            .filter(b => b.length > 15);
    }

    // 4. Remove any blocks that match student messages previously sent
    if (sentMessages && sentMessages.length > 0) {
        blocks = blocks.filter(b => {
            return !sentMessages.some(sent => {
                if (!sent) return false;
                const normSent = sent.replace(/\s+/g, ' ').trim().toLowerCase();
                const normB = b.toLowerCase();
                return normB === normSent || normB.includes(normSent) || normSent.includes(normB);
            });
        });
    }

    // 5. Filter out known intro fragments if any leaked through
    blocks = blocks.filter(b => {
        const low = b.toLowerCase();
        return !low.includes("when you're ready, click") &&
               !low.includes("welcome! during this dialogue") &&
               !low.includes("here's what we'll cover") &&
               !low.includes("dialogue is powered by ai") &&
               !low.includes("today's goals") &&
               !low.includes("practice quiz") &&
               !low.includes("digital foundations");
    });

    if (blocks.length > 0) {
        return blocks[blocks.length - 1];
    }
    return '';
}

console.log("OLD RESULT:", JSON.stringify(extractLatestCoachMessageFromTextOld(screenshotText)));
