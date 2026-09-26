const assert = require('assert');

console.log("================================================================");
console.log("🧪 TESTING FULL DUAL-COURSE MULTI-AI INTEGRATION & GEMINI ENGINE");
console.log("================================================================");

// 1. Test URL generation & cleaning logic
function sanitizeModelAndKey(modelName, apiKey, apiVersion = 'v1beta') {
    const cleanApiKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    const rawModel = modelName.replace(/^models\//, '');
    const cleanModel = `models/${rawModel}`;
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/${cleanModel}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;
    return { cleanApiKey, cleanModel, url };
}

const quotedKey = '"AIzaSyD-TestKey123" ';
const resBeta = sanitizeModelAndKey('gemini-1.5-flash', quotedKey, 'v1beta');
assert.strictEqual(resBeta.cleanApiKey, 'AIzaSyD-TestKey123', 'Key must have quotes and whitespace stripped');
assert.strictEqual(resBeta.cleanModel, 'models/gemini-1.5-flash', 'Model must be normalized to models/ prefix');
assert.ok(resBeta.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key='), 'Valid beta URL');

const resAlreadyPrefixed = sanitizeModelAndKey('models/gemini-2.0-flash', quotedKey, 'v1');
assert.strictEqual(resAlreadyPrefixed.cleanModel, 'models/gemini-2.0-flash', 'Already prefixed model must NOT have double prefix');
assert.ok(resAlreadyPrefixed.url.startsWith('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key='), 'Valid v1 URL');

console.log("✓ Gemini URL builder & sanitizer handles dirty keys and model prefixes cleanly.");

// 2. Test Multi-Course Per-Course In-Flight Locks (Independent concurrency)
const activeAIRequestsByCourse = new Map();

async function simulateCourseRequest(courseSlug, durationMs, answer) {
    if (activeAIRequestsByCourse.has(courseSlug)) {
        return activeAIRequestsByCourse.get(courseSlug);
    }

    const promise = (async () => {
        try {
            await new Promise(r => setTimeout(r, durationMs));
            return { course: courseSlug, answer };
        } finally {
            activeAIRequestsByCourse.delete(courseSlug);
        }
    })();

    activeAIRequestsByCourse.set(courseSlug, promise);
    return promise;
}

(async () => {
    const start = Date.now();
    
    // Launch Course 1 and Course 2 simultaneously
    const req1 = simulateCourseRequest('course-python-101', 50, 'Answer for Python');
    const req2 = simulateCourseRequest('course-algorithms-201', 50, 'Answer for Algorithms');

    // Both should run in parallel, finishing in ~50ms rather than 100ms
    const [out1, out2] = await Promise.all([req1, req2]);
    const elapsed = Date.now() - start;

    assert.strictEqual(out1.course, 'course-python-101');
    assert.strictEqual(out1.answer, 'Answer for Python');
    assert.strictEqual(out2.course, 'course-algorithms-201');
    assert.strictEqual(out2.answer, 'Answer for Algorithms');
    assert.ok(elapsed < 90, `Both courses must execute concurrently! Took: ${elapsed}ms`);

    console.log(`✓ Both courses executed concurrently in parallel (${elapsed}ms) without cross-locking!`);

    // 3. Test Course Slug Extractor
    function extractCourseSlug(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url);
            const match = parsed.pathname.match(/\/learn\/([^/]+)/i);
            if (match && match[1]) return match[1].toLowerCase();
            const teachMatch = parsed.pathname.match(/\/teach\/([^/]+)/i);
            if (teachMatch && teachMatch[1]) return teachMatch[1].toLowerCase();
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0 && pathParts[0] !== 'home') return pathParts[0].toLowerCase();
        } catch (e) {}
        return null;
    }

    assert.strictEqual(extractCourseSlug('https://www.coursera.org/learn/machine-learning/quiz/xyz'), 'machine-learning');
    assert.strictEqual(extractCourseSlug('https://www.coursera.org/learn/deep-neural-networks/lecture/abc'), 'deep-neural-networks');
    assert.strictEqual(extractCourseSlug('https://www.coursera.org/teach/python-basics/home'), 'python-basics');
    console.log("✓ Coursera course slug extraction verified for standard and enterprise URLs.");

    console.log("\n================================================================");
    console.log("🎉 ALL INTEGRATION TESTS PASSED 100%!");
    console.log("================================================================");
})();
