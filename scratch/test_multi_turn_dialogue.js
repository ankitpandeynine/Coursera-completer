const assert = require('assert');

function extractLatestCoachMessage(fullText, sentMessages = []) {
    if (!fullText) return '';
    let clean = fullText;

    // 1. Remove dialogue intro / objectives boilerplate before "Start Dialogue"
    if (/Start Dialogue/i.test(clean)) {
        const parts = clean.split(/Start Dialogue["']?/i);
        clean = parts[parts.length - 1];
    }

    // 2. Strip bottom composer / footer metadata
    // Instead of sweeping regex, strip known footer lines
    clean = clean.replace(/Dialogue is powered by AI[\s\S]*$/i, '');
    clean = clean.replace(/Send a message\s*$/i, '');
    clean = clean.replace(/End Dialogue\s*$/i, '');
    clean = clean.replace(/I'm stuck\s*$/i, '');

    // 3. Split into blocks by double newline or distinct paragraphs
    let blocks = clean.split(/\n\s*\n/)
        .map(b => b.replace(/\s+/g, ' ').trim())
        .filter(b => b.length > 15);

    if (blocks.length === 0) {
        blocks = clean.split('\n')
            .map(b => b.replace(/\s+/g, ' ').trim())
            .filter(b => b.length > 15);
    }

    // Strip out student messages
    if (sentMessages && sentMessages.length > 0) {
        blocks = blocks.filter(b => {
            return !sentMessages.some(sent => {
                if (!sent) return false;
                const normSent = sent.replace(/\s+/g, ' ').trim().toLowerCase();
                const normB = b.toLowerCase();
                if (normB === normSent) return true;
                if (normSent.length > 25 && normB.includes(normSent.slice(0, 30))) return true;
                if (normB.length > 25 && normSent.includes(normB.slice(0, 30))) return true;
                return false;
            });
        });
    }

    // Filter out known generic instructions & composer hints
    blocks = blocks.filter(b => {
        const low = b.toLowerCase();
        return !low.includes("when you're ready, click") &&
               !low.includes("welcome! during this dialogue") &&
               !low.includes("welcome! in this dialogue") &&
               !low.includes("here's what we'll cover") &&
               !low.includes("dialogue is powered by ai") &&
               !low.includes("send a message") &&
               !low.includes("today's goals") &&
               !low.includes("practice quiz");
    });

    if (blocks.length > 0) {
        return blocks[blocks.length - 1];
    }
    return '';
}

const baseIntro = `
Welcome! In this Dialogue, we'll explore how computer components work together and how the von Neumann architecture...

Here's what we'll cover:
• Architecture Comparison: We'll evaluate the advantages and disadvantages...
• System Integration: We'll trace how data flows...
• LC-3 Foundation: We'll connect architectural principles...

Need help? Click "I'm stuck" at the top right to get a hint.

When you're ready, click "Start Dialogue"
`;

// Turn 1
const turn1 = baseIntro + `\n\nGreat! Let's begin by diving into Architecture Comparison. Can you tell me some of the key differences between the von Neumann and Harvard architectures?\n\nSend a message\nDialogue is powered by AI`;
const q1 = extractLatestCoachMessage(turn1, []);
console.log("Turn 1 Question:", q1);
assert.ok(q1.includes("differences between the von Neumann and Harvard architectures"));

// Turn 2
const studentAns1 = "In the von Neumann architecture, instructions and data share the same physical memory space and buses, creating the von Neumann bottleneck. In contrast, Harvard architecture uses separate buses and memory spaces for instructions and data, allowing simultaneous instruction fetch and data access.";
const turn2 = baseIntro + `\n\nGreat! Let's begin by diving into Architecture Comparison. Can you tell me some of the key differences between the von Neumann and Harvard architectures?\n\n` +
              studentAns1 + `\n\nExactly! That simultaneous access prevents the bottleneck. How does this impact pipeline efficiency in modern processors?\n\nSend a message\nDialogue is powered by AI`;

const q2 = extractLatestCoachMessage(turn2, [studentAns1]);
console.log("Turn 2 Question:", q2);
assert.ok(q2.includes("pipeline efficiency in modern processors"));

// Turn 3
const studentAns2 = "Because instructions and data can be accessed simultaneously without pipeline stalls, instruction fetch doesn't have to wait for memory operands to be read or written.";
const turn3 = turn2.replace(/\n\nSend a message[\s\S]*$/, '') + `\n\n` + studentAns2 + `\n\nWell explained! Now, in the LC-3 architecture, which model does it follow and why?\n\nSend a message\nDialogue is powered by AI`;

const q3 = extractLatestCoachMessage(turn3, [studentAns1, studentAns2]);
console.log("Turn 3 Question:", q3);
assert.ok(q3.includes("LC-3 architecture"));

console.log("🎉 ALL TURNS EXTRACTED FLAWLESSLY 100%!");
