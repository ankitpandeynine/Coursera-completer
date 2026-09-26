const assert = require('assert');

/**
 * Robust extraction logic for Coursera AI Coach Dialogue messages
 */
function extractLatestCoachMessageFromText(fullText, sentMessages = []) {
    if (!fullText) return '';
    let clean = fullText;

    // 1. Strip composer boilerplate and footer info (only from the bottom)
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
        // Return the most recent prompt/question block
        return blocks[blocks.length - 1];
    }
    return '';
}

function extractFullDialogueContextFromText(fullText) {
    if (!fullText) return '';
    let clean = fullText;
    clean = clean.replace(/Dialogue is powered by AI[\s\S]*$/i, '');
    clean = clean.replace(/Send a message[\s\S]*$/i, '');
    clean = clean.replace(/End Dialogue/gi, '');
    clean = clean.replace(/I'm stuck/gi, '');

    if (/Start Dialogue/i.test(clean)) {
        const parts = clean.split(/Start Dialogue["']?/i);
        clean = parts[parts.length - 1];
    }

    const blocks = clean.split(/\n\s*\n/)
        .map(b => b.replace(/\s+/g, ' ').trim())
        .filter(b => b.length > 15 && !b.toLowerCase().includes("today's goals"));

    return blocks.slice(-6).join('\n\n');
}

// TEST 1: Exact screenshot Turn 1
const turn1Screen = `
Digital Foundations
Dialogue
I'm stuck
End Dialogue

Welcome! During this Dialogue, we will focus on analyzing and converting between different number systems (binary, decimal, hexadecimal) and explaining the fundamental principles of digital systems in computing contexts.
Here's what we'll cover:
• Number System Mastery: Practice converting between binary, decimal, and hexadecimal representations with confidence.
• Digital Logic Principles: Explore why digital systems use binary representation and how this enables reliable computation.
• Real-World Applications: Connect number systems to practical computing scenarios like memory addressing and data representation.

Need help? Click "I'm stuck" at the top right to get a hint.

When you're ready, click "Start Dialogue"

Great! Let's dive into Number System Mastery. To begin, can you explain the core difference between how decimal and binary number systems represent values?

Send a message
Dialogue is powered by AI, so check for mistakes and don't share any personal/sensitive information.
`;

const turn1 = extractLatestCoachMessageFromText(turn1Screen, []);
console.log("TEST 1 Result:\n", turn1);
assert.ok(turn1.includes("Number System Mastery"), "Must contain prompt title");
assert.ok(turn1.includes("core difference between how decimal and binary"), "Must contain question");

// TEST 2: Turn 2 (Coach asked turn 1, student answered turn 1, coach asks turn 2)
const turn2Screen = `
Digital Foundations
Dialogue
I'm stuck
End Dialogue

Welcome! During this Dialogue, we will focus on analyzing and converting between different number systems (binary, decimal, hexadecimal)...
When you're ready, click "Start Dialogue"

Great! Let's dive into Number System Mastery. To begin, can you explain the core difference between how decimal and binary number systems represent values?

In the decimal number system, values are represented using base 10 with digits from 0 to 9, where each position corresponds to increasing powers of 10. In contrast, the binary number system uses base 2 with only two digits, 0 and 1, where each position represents increasing powers of 2.

Terrific explanation! You clearly understand positional notation. Now, let's practice: can you convert the decimal number 13 into its binary representation? Show your steps.

Send a message
Dialogue is powered by AI, so check for mistakes and don't share any personal/sensitive information.
`;

const sentTurn1 = "In the decimal number system, values are represented using base 10 with digits from 0 to 9, where each position corresponds to increasing powers of 10. In contrast, the binary number system uses base 2 with only two digits, 0 and 1, where each position represents increasing powers of 2.";
const turn2 = extractLatestCoachMessageFromText(turn2Screen, [sentTurn1]);
console.log("\nTEST 2 Result:\n", turn2);
assert.ok(turn2.includes("convert the decimal number 13 into its binary representation"), "Must extract turn 2 question");

// TEST 3: Turn 3
const turn3Screen = `
Digital Foundations
Dialogue
I'm stuck
End Dialogue

Welcome! During this Dialogue, we will focus on analyzing and converting between different number systems...
When you're ready, click "Start Dialogue"

Great! Let's dive into Number System Mastery. To begin, can you explain the core difference between how decimal and binary number systems represent values?

In the decimal number system, values are represented using base 10 with digits from 0 to 9...

Terrific explanation! You clearly understand positional notation. Now, let's practice: can you convert the decimal number 13 into its binary representation? Show your steps.

To convert decimal 13 to binary: 13 / 2 = 6 with a remainder of 1. 6 / 2 = 3 with a remainder of 0. 3 / 2 = 1 with a remainder of 1. 1 / 2 = 0 with a remainder of 1. Reading remainders from bottom to top gives binary 1101.

Spot on! 13 in binary is indeed 1101. Now let's explore hexadecimal representation. Why do computer scientists frequently use hexadecimal (base 16) instead of long binary strings?

Send a message
Dialogue is powered by AI, so check for mistakes and don't share any personal/sensitive information.
`;

const sentTurn2 = "To convert decimal 13 to binary: 13 / 2 = 6 with a remainder of 1. 6 / 2 = 3 with a remainder of 0. 3 / 2 = 1 with a remainder of 1. 1 / 2 = 0 with a remainder of 1. Reading remainders from bottom to top gives binary 1101.";
const turn3 = extractLatestCoachMessageFromText(turn3Screen, [sentTurn1, sentTurn2]);
console.log("\nTEST 3 Result:\n", turn3);
assert.ok(turn3.includes("Why do computer scientists frequently use hexadecimal"), "Must extract turn 3 question");

console.log("\n✅ ALL TESTS PASSED PERFECTLY!");
