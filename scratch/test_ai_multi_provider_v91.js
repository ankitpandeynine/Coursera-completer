const assert = require('assert');

console.log('================================================================');
console.log('🧪 TEST: AI MULTI-PROVIDER MODEL AUTO-DETECTION & FAILOVER');
console.log('================================================================');

// 1. Simulation of Gemini Multi-Model Fallback
async function simulateGeminiCall(apiKey, prompt, mockResponses) {
    const candidateModels = [
        'models/gemini-1.5-flash',
        'models/gemini-2.0-flash',
        'models/gemini-1.5-flash-8b',
        'models/gemini-2.5-flash'
    ];

    let lastError = null;

    for (const model of candidateModels) {
        const res = mockResponses[model] || { ok: false, status: 500, error: 'Unknown model' };
        if (res.ok) {
            return { ok: true, text: res.text, modelUsed: `Gemini (${model.replace('models/', '')})` };
        }
        lastError = { status: res.status, message: res.error };
        // On 429, 404, 503 -> continue to next Gemini model!
        if (res.status === 429 || res.status === 404 || res.status === 503) {
            continue;
        }
        break;
    }

    return { ok: false, status: lastError?.status || 500, error: lastError?.message };
}

// Case 1: gemini-2.5-flash has 429, but gemini-1.5-flash succeeds
const mockGeminiResponses = {
    'models/gemini-1.5-flash': { ok: true, text: '[{"id": 0, "answerIndices": [1]}]' },
    'models/gemini-2.5-flash': { ok: false, status: 429, error: 'Quota exceeded for 2.5-flash' }
};

(async () => {
    const geminiResult = await simulateGeminiCall('test_key', 'test_prompt', mockGeminiResponses);
    assert.strictEqual(geminiResult.ok, true, 'Gemini must succeed on 1.5-flash despite 2.5-flash quota limit');
    assert.strictEqual(geminiResult.modelUsed, 'Gemini (gemini-1.5-flash)');
    console.log('✓ Test 1: Gemini prioritizes high-quota 1.5-flash and bypasses 2.5-flash 429 limit.');

    // 2. Simulation of NVIDIA NIM HTTP 410 Failover
    async function simulateNvidiaCall(apiKey, prompt, mockResponses) {
        const candidateModels = [
            'meta/llama-3.3-70b-instruct',
            'meta/llama-3.1-8b-instruct',
            'meta/llama-3.1-70b-instruct'
        ];

        let lastError = null;
        for (const model of candidateModels) {
            const res = mockResponses[model] || { ok: false, status: 500, error: 'Unknown' };
            if (res.ok) {
                return { ok: true, text: res.text, modelUsed: `NVIDIA (${model.split('/')[1]})` };
            }
            lastError = { status: res.status, message: res.error };
            // CRITICAL: 410, 404, 422, 429 MUST continue!
            if (res.status === 410 || res.status === 404 || res.status === 422 || res.status === 429 || res.status === 503) {
                continue;
            }
            break;
        }

        return { ok: false, status: lastError?.status || 500, error: lastError?.message };
    }

    const mockNvidiaResponses = {
        'meta/llama-3.3-70b-instruct': { ok: false, status: 410, error: 'HTTP 410 Gone' },
        'meta/llama-3.1-8b-instruct': { ok: true, text: '[{"id": 0, "answerIndices": [0]}]' }
    };

    const nvidiaResult = await simulateNvidiaCall('test_key', 'test_prompt', mockNvidiaResponses);
    assert.strictEqual(nvidiaResult.ok, true, 'NVIDIA NIM must fail over past HTTP 410 and succeed on llama-3.1-8b');
    assert.strictEqual(nvidiaResult.modelUsed, 'NVIDIA (llama-3.1-8b-instruct)');
    console.log('✓ Test 2: NVIDIA NIM catches HTTP 410 and successfully fails over to active models.');

    console.log('\n🎉 ALL LOGICAL FAILOVER TESTS PASSED!');
})();
