const assert = require('assert');

// Simulate the exact DOM from the screenshot
const mockScreenText = `
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

function extractLatestCoachMessageFromText(fullText, sentMessages = []) {
    let clean = fullText;
    // Strip header / footer boilerplate
    clean = clean.replace(/Dialogue is powered by AI[\s\S]*$/i, '');
    clean = clean.replace(/Send a message[\s\S]*$/i, '');
    clean = clean.replace(/End Dialogue/gi, '');
    clean = clean.replace(/I'm stuck/gi, '');

    // Split after "Start Dialogue"
    if (/Start Dialogue/i.test(clean)) {
        const parts = clean.split(/Start Dialogue["']?/i);
        clean = parts[parts.length - 1];
    }

    // Split into distinct blocks/paragraphs
    let blocks = clean.split(/\n\s*\n/)
        .map(b => b.replace(/\s+/g, ' ').trim())
        .filter(b => b.length > 15);

    // Remove any blocks that match student messages previously sent
    if (sentMessages.length > 0) {
        blocks = blocks.filter(b => {
            return !sentMessages.some(sent => {
                const normSent = sent.replace(/\s+/g, ' ').trim().toLowerCase();
                const normB = b.toLowerCase();
                return normB === normSent || normB.includes(normSent) || normSent.includes(normB);
            });
        });
    }

    // Filter out boilerplate intro fragments if any remain
    blocks = blocks.filter(b => {
        const low = b.toLowerCase();
        return !low.includes("when you're ready, click") &&
               !low.includes("welcome! during this dialogue") &&
               !low.includes("here's what we'll cover") &&
               !low.includes("dialogue is powered by ai") &&
               !low.includes("today's goals");
    });

    if (blocks.length > 0) {
        return blocks[blocks.length - 1];
    }
    return '';
}

const extractedTurn1 = extractLatestCoachMessageFromText(mockScreenText, []);
console.log("Extracted Turn 1:", extractedTurn1);
assert.ok(extractedTurn1.includes("Number System Mastery"), "Must extract Turn 1 prompt");
assert.ok(extractedTurn1.includes("core difference between how decimal and binary"), "Must extract question prompt");

// Simulate Turn 2: Student has replied, and Coach asks follow-up
const mockTurn2Text = `
Digital Foundations
Dialogue
I'm stuck
End Dialogue

Welcome! During this Dialogue, we will focus on analyzing and converting between different number systems (binary, decimal, hexadecimal)...
When you're ready, click "Start Dialogue"

Great! Let's dive into Number System Mastery. To begin, can you explain the core difference between how decimal and binary number systems represent values?

In decimal (base 10), each position represents powers of 10 using digits 0 to 9. In binary (base 2), each position represents powers of 2 using only bits 0 and 1.

Terrific explanation! You clearly understand positional notation. Now, let's practice: can you convert the decimal number 13 into its binary representation? Show your steps.

Send a message
Dialogue is powered by AI, so check for mistakes and don't share any personal/sensitive information.
`;

const sentTurn1 = "In decimal (base 10), each position represents powers of 10 using digits 0 to 9. In binary (base 2), each position represents powers of 2 using only bits 0 and 1.";
const extractedTurn2 = extractLatestCoachMessageFromText(mockTurn2Text, [sentTurn1]);
console.log("Extracted Turn 2:", extractedTurn2);
assert.ok(extractedTurn2.includes("convert the decimal number 13 into its binary representation"), "Must extract Turn 2 prompt");

console.log("🎉 ALL TESTS PASSED!");
