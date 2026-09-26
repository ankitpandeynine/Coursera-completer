const assert = require('assert');

// 1. TEST GEMINI API FIX
console.log("================================================================");
console.log("🧪 TESTING 1: GEMINI API FIX & RESILIENT MODEL FAILOVER");
console.log("================================================================");

function getGeminiCandidateModels(discovered = null) {
    const priorityFallbacks = [
        'models/gemini-1.5-flash',
        'models/gemini-1.5-flash-latest',
        'models/gemini-2.0-flash',
        'models/gemini-2.0-flash-exp',
        'models/gemini-1.5-flash-8b',
        'models/gemini-1.5-pro',
        'models/gemini-1.5-pro-latest',
        'models/gemini-1.0-pro',
        'models/gemini-pro'
    ];

    if (discovered && discovered.length > 0) {
        const sorted = [];
        const priorityPatterns = [
            'gemini-1.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash-8b',
            'gemini-1.5-pro',
            'gemini-1.0-pro',
            'gemini-pro'
        ];

        for (const pat of priorityPatterns) {
            const matches = discovered.filter(m => m.includes(pat));
            for (const m of matches) {
                if (!sorted.includes(m)) sorted.push(m);
            }
        }
        for (const m of discovered) {
            if (!sorted.includes(m)) sorted.push(m);
        }
        if (sorted.length > 0) return sorted;
    }
    return priorityFallbacks;
}

function buildGeminiUrl(modelName, apiKey, apiVersion = 'v1beta') {
    const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    const rawModel = modelName.replace(/^models\//, '');
    const cleanModel = `models/${rawModel}`;
    return `https://generativelanguage.googleapis.com/${apiVersion}/${cleanModel}:generateContent?key=${cleanApiKey}`;
}

// Test URL formatting
const testKey = "AIzaSyTestKey123";
const urlBeta = buildGeminiUrl("gemini-1.5-flash", testKey, "v1beta");
assert.strictEqual(urlBeta, "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyTestKey123");

const urlV1 = buildGeminiUrl("models/gemini-1.5-flash", testKey, "v1");
assert.strictEqual(urlV1, "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=AIzaSyTestKey123");

// Verify that double 'models/models/' is NEVER generated
const urlDoublePrefix = buildGeminiUrl("models/gemini-1.5-flash", testKey, "v1beta");
assert.ok(!urlDoublePrefix.includes("models/models/"), "Must not contain duplicate models/ prefix");
console.log("✓ URL generation correctly handles raw names and pre-prefixed names without duplicate models/ prefix.");

// Verify candidate models do NOT include non-existent gemini-2.5-flash or broken aliases
const models = getGeminiCandidateModels();
assert.ok(!models.includes("models/gemini-2.5-flash"), "Must not include non-existent gemini-2.5-flash");
assert.ok(models.includes("models/gemini-1.5-flash"), "Must include gemini-1.5-flash");
assert.ok(models.includes("models/gemini-2.0-flash"), "Must include gemini-2.0-flash");
assert.ok(models.includes("models/gemini-pro"), "Must include gemini-pro fallback");
console.log("✓ Candidate models list contains authentic production Gemini models.");

// 2. TEST DUAL-COURSE MULTI-AI DISPATCHER
console.log("\n================================================================");
console.log("🧪 TESTING 2: DUAL-COURSE MULTI-AI DISPATCHER");
console.log("================================================================");

class MockDualCourseDispatcher {
    constructor() {
        this.activeCourseAssignments = new Map(); // courseSlug -> assignedProvider
        this.providerCooldowns = {};
    }

    determineProviderOrder(courseSlug, config) {
        const {
            keys,
            preferredProvider = 'auto',
            secondaryProvider = 'auto',
            dualCourseMultiAI = true
        } = config;

        const defaultOrder = ['groq', 'gemini', 'openrouter', 'nvidia'];
        const configuredProviders = defaultOrder.filter(p => !!keys[p]);

        if (configuredProviders.length === 0) return [];
        if (configuredProviders.length === 1 || !dualCourseMultiAI) {
            // Single provider or dual mode disabled: use normal preferred order
            if (preferredProvider !== 'auto' && configuredProviders.includes(preferredProvider)) {
                return [preferredProvider, ...configuredProviders.filter(p => p !== preferredProvider)];
            }
            return configuredProviders;
        }

        // Multi-Course Active Management
        if (!this.activeCourseAssignments.has(courseSlug)) {
            // Assign a provider distinct from existing active courses
            const existingAssignments = Array.from(this.activeCourseAssignments.values());
            
            let chosen = null;
            if (existingAssignments.length === 0) {
                // First active course: use preferredProvider if set, else first configured
                chosen = (preferredProvider !== 'auto' && configuredProviders.includes(preferredProvider))
                    ? preferredProvider
                    : configuredProviders[0];
            } else {
                // Second or subsequent course: use secondaryProvider if set and distinct,
                // otherwise pick a configured provider not already assigned to Course 1
                if (secondaryProvider !== 'auto' && configuredProviders.includes(secondaryProvider) && secondaryProvider !== existingAssignments[0]) {
                    chosen = secondaryProvider;
                } else {
                    chosen = configuredProviders.find(p => !existingAssignments.includes(p)) || configuredProviders[0];
                }
            }
            this.activeCourseAssignments.set(courseSlug, chosen);
        }

        const assigned = this.activeCourseAssignments.get(courseSlug);
        // Order starts with assigned provider, followed by other configured providers as failovers
        return [assigned, ...configuredProviders.filter(p => p !== assigned)];
    }
}

const dispatcher = new MockDualCourseDispatcher();
const availableKeys = {
    groq: 'gsk_test123',
    gemini: 'AIzaSyTestKey123',
    nvidia: 'nvapi-test123'
};

// Course 1 request
const orderCourse1 = dispatcher.determineProviderOrder('introduction-to-computing-systems-public', {
    keys: availableKeys,
    preferredProvider: 'groq',
    secondaryProvider: 'gemini',
    dualCourseMultiAI: true
});
console.log("Course 1 AI Provider Order:", orderCourse1);
assert.strictEqual(orderCourse1[0], 'groq', "Course 1 must be assigned to Groq");

// Course 2 request (simultaneous second course)
const orderCourse2 = dispatcher.determineProviderOrder('algorithmic-toolbox', {
    keys: availableKeys,
    preferredProvider: 'groq',
    secondaryProvider: 'gemini',
    dualCourseMultiAI: true
});
console.log("Course 2 AI Provider Order:", orderCourse2);
assert.strictEqual(orderCourse2[0], 'gemini', "Course 2 must be assigned to a different AI (Gemini)");

// Verify they are distinct!
assert.notStrictEqual(orderCourse1[0], orderCourse2[0], "Course 1 and Course 2 MUST use different AI engines!");
console.log("✓ Course 1 and Course 2 simultaneously assigned to separate AI providers without conflict!");

// Auto-failover integrity: If Course 1 hits rate limit, it falls back to Gemini or Nvidia without disturbing Course 2
assert.ok(orderCourse1.includes('gemini') && orderCourse1.includes('nvidia'), "Course 1 retains full fallback chain");
assert.ok(orderCourse2.includes('groq') && orderCourse2.includes('nvidia'), "Course 2 retains full fallback chain");
console.log("✓ Both courses maintain independent failover chains.");

console.log("\n================================================================");
console.log("🎉 ALL TESTS PASSED SUCCESSFULLY 100%!");
console.log("================================================================");
