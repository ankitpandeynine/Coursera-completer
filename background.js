// Service Worker for Coursera AI AutoPilot v9.1
// Ephemeral-safe, multi-provider AI dispatcher with dynamic model auto-detection,
// intelligent limit optimization, automatic multi-model failover, and cooldown management.

const PROVIDERS = {
    gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        storageKey: 'geminiApiKey',
        cooldownMs: 25000,
        call: callGemini
    },
    groq: {
        id: 'groq',
        name: 'Groq Cloud',
        storageKey: 'groqApiKey',
        cooldownMs: 25000,
        call: callGroq
    },
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter (Free)',
        storageKey: 'openRouterApiKey',
        cooldownMs: 25000,
        call: callOpenRouter
    },
    nvidia: {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        storageKey: 'nvidiaApiKey',
        cooldownMs: 25000,
        call: callNvidia
    }
};

// ==========================================
// 1. GOOGLE GEMINI DYNAMIC AUTO-DETECTION & MULTI-MODEL FAILOVER
// ==========================================

async function discoverGeminiModels(apiKey) {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
            console.warn(`[AutoPilot] Gemini model discovery returned HTTP ${res.status}`);
            return null;
        }

        const data = await res.json();
        const models = (data.models || [])
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.startsWith('models/') ? m.name : `models/${m.name}`);

        if (models.length > 0) return models;
    } catch (e) {
        console.warn('[AutoPilot] Gemini model discovery error:', e);
    }
    return null;
}

async function getGeminiCandidateModels(apiKey) {
    // High-quota, ultra-reliable models prioritized first:
    // 1. gemini-1.5-flash: 15 RPM, 1,000,000 TPM, 1,500 RPD (Standard free tier workhorse)
    // 2. gemini-2.0-flash: 10-15 RPM (High intelligence, fast)
    // 3. gemini-1.5-flash-8b: Fast throughput, separate quota pool
    // 4. gemini-2.0-flash-lite: Lightweight preview
    // 5. gemini-1.5-pro: High reasoning
    // 6. gemini-2.5-flash: Experimental preview (fallback only)
    const priorityFallbacks = [
        'models/gemini-1.5-flash',
        'models/gemini-2.0-flash',
        'models/gemini-1.5-flash-8b',
        'models/gemini-2.0-flash-lite',
        'models/gemini-1.5-pro',
        'models/gemini-2.5-flash'
    ];

    try {
        const discovered = await discoverGeminiModels(apiKey);
        if (discovered && discovered.length > 0) {
            const sorted = [];
            const priorityPatterns = [
                'gemini-1.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash-8b',
                'gemini-2.0-flash-lite',
                'gemini-1.5-pro',
                'gemini-2.5-flash'
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
    } catch (e) {}

    return priorityFallbacks;
}

async function callSingleGemini(modelName, apiKey, prompt, useJsonMime = true) {
    const cleanModel = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${cleanModel}:generateContent?key=${apiKey}`;
    
    const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1
        }
    };

    if (useJsonMime) {
        bodyPayload.generationConfig.responseMimeType = "application/json";
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify(bodyPayload)
    });

    const status = response.status;
    const data = await response.json().catch(() => ({}));

    return { ok: response.ok, status, data };
}

async function callGemini(apiKey, prompt) {
    const candidateModels = await getGeminiCandidateModels(apiKey);
    let lastError = null;

    // Check if we have a known cached working model that is NOT throttled
    const storage = await chrome.storage.local.get(['cachedGeminiModel']);
    let orderedModels = [...candidateModels];
    if (storage.cachedGeminiModel && orderedModels.includes(storage.cachedGeminiModel)) {
        // Put cached working model first unless it's 2.5-flash which has low quota
        if (!storage.cachedGeminiModel.includes('2.5-flash')) {
            orderedModels = [storage.cachedGeminiModel, ...orderedModels.filter(m => m !== storage.cachedGeminiModel)];
        }
    }

    for (const model of orderedModels) {
        try {
            const shortModel = model.replace('models/', '');
            console.log(`[AutoPilot] Querying Gemini model: ${shortModel}`);

            // Try with JSON response mode first
            let res = await callSingleGemini(model, apiKey, prompt, true);

            // If 400 (some models don't support responseMimeType in generationConfig), retry with plain prompt
            if (!res.ok && res.status === 400) {
                res = await callSingleGemini(model, apiKey, prompt, false);
            }

            if (res.ok) {
                const textPart = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textPart) {
                    await chrome.storage.local.set({ cachedGeminiModel: model });
                    return { ok: true, text: textPart, modelUsed: `Gemini (${shortModel})` };
                }
            }

            lastError = { status: res.status, message: res.data?.error?.message || `HTTP ${res.status}` };

            // Crucial fix: HTTP 429 (Quota limit on this specific model), 404 (Not found), 500, 503 (Server error)
            // MUST fail over to the next Gemini model immediately!
            if (res.status === 429 || res.status === 404 || res.status === 500 || res.status === 503) {
                console.warn(`[AutoPilot] Gemini model ${shortModel} returned HTTP ${res.status}. Failing over to next Gemini model...`);
                await appendLog(`Gemini ${shortModel} (${res.status}). Switching to backup Gemini model...`, 'info');
                continue;
            }

            // If invalid API key (401/403 or API_KEY_INVALID), stop cycling
            if (res.status === 401 || res.status === 403 || (res.data?.error?.message && res.data.error.message.includes('API_KEY_INVALID'))) {
                break;
            }

        } catch (e) {
            lastError = { status: 0, message: e.message };
        }
    }

    return {
        ok: false,
        status: lastError?.status || 500,
        error: lastError?.message || "All Gemini models failed"
    };
}

// ==========================================
// 2. GROQ DYNAMIC AUTO-DETECTION & MULTI-MODEL FAILOVER
// ==========================================

async function discoverGroqModels(apiKey) {
    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            const models = (data.data || []).map(m => m.id);
            if (models.length > 0) return models;
        }
    } catch (e) {
        console.warn('[AutoPilot] Groq model discovery error:', e);
    }
    return null;
}

async function getGroqCandidateModels(apiKey) {
    const defaultList = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-70b-8192',
        'llama3-8b-8192',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
        'deepseek-r1-distill-llama-70b'
    ];
    try {
        const discovered = await discoverGroqModels(apiKey);
        if (discovered && discovered.length > 0) {
            const sorted = [];
            for (const m of defaultList) {
                if (discovered.includes(m)) sorted.push(m);
            }
            for (const m of discovered) {
                if (!sorted.includes(m)) sorted.push(m);
            }
            if (sorted.length > 0) return sorted;
        }
    } catch (e) {}
    return defaultList;
}

async function callGroq(apiKey, prompt) {
    const groqModels = await getGroqCandidateModels(apiKey);
    let lastError = null;

    for (const model of groqModels) {
        try {
            const url = 'https://api.groq.com/openai/v1/chat/completions';
            const bodyPayload = {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert academic quiz solver. Output ONLY a valid JSON array of objects without Markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                signal: AbortSignal.timeout(20000),
                body: JSON.stringify(bodyPayload)
            });

            const status = response.status;
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                const text = data.choices?.[0]?.message?.content;
                if (text) {
                    await chrome.storage.local.set({ cachedGroqModel: model });
                    return { ok: true, text, modelUsed: `Groq (${model})` };
                }
            }

            lastError = { status, message: data.error?.message || `HTTP ${status}` };

            // Crucial fix: continue on 404, 410, 422, 429, 500, 503
            if (status === 404 || status === 410 || status === 422 || status === 429 || status === 500 || status === 503) {
                console.warn(`[AutoPilot] Groq model ${model} returned ${status}. Auto-switching to next Groq model...`);
                await appendLog(`Groq ${model} (${status}). Auto-switching to next model...`, 'info');
                continue;
            }

            if (status === 401 || status === 403) {
                break;
            }

        } catch (e) {
            lastError = { status: 0, message: e.message };
        }
    }

    return {
        ok: false,
        status: lastError?.status || 500,
        error: lastError?.message || 'All Groq models failed'
    };
}

// ==========================================
// 3. OPENROUTER DYNAMIC AUTO-DETECTION & MULTI-MODEL FAILOVER
// ==========================================

async function discoverOpenRouterFreeModels() {
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            const models = (data.data || []).map(m => m.id).filter(id => id.endsWith(':free'));
            if (models.length > 0) return models;
        }
    } catch (e) {
        console.warn('[AutoPilot] OpenRouter model discovery error:', e);
    }
    return null;
}

async function getOpenRouterCandidateModels() {
    const defaultList = [
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemini-2.0-flash-exp:free',
        'deepseek/deepseek-r1:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'meta-llama/llama-3.1-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free'
    ];
    try {
        const discovered = await discoverOpenRouterFreeModels();
        if (discovered && discovered.length > 0) {
            const sorted = [];
            for (const m of defaultList) {
                if (discovered.includes(m)) sorted.push(m);
            }
            for (const m of discovered) {
                if (!sorted.includes(m)) sorted.push(m);
            }
            if (sorted.length > 0) return sorted;
        }
    } catch (e) {}
    return defaultList;
}

async function callOpenRouter(apiKey, prompt) {
    const freeModels = await getOpenRouterCandidateModels();
    let lastError = null;

    for (const model of freeModels) {
        try {
            const url = 'https://openrouter.ai/api/v1/chat/completions';
            const bodyPayload = {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert academic quiz solver. Output ONLY a valid JSON array of objects without Markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://github.com/ankitpandeynine/Coursera-completer',
                    'X-Title': 'Coursera AI AutoPilot'
                },
                signal: AbortSignal.timeout(20000),
                body: JSON.stringify(bodyPayload)
            });

            const status = response.status;
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                const text = data.choices?.[0]?.message?.content;
                if (text) {
                    const shortName = model.split('/')[1]?.replace(':free', '') || model;
                    await chrome.storage.local.set({ cachedOpenRouterModel: model });
                    return { ok: true, text, modelUsed: `OpenRouter (${shortName})` };
                }
            }

            lastError = { status, message: data.error?.message || `HTTP ${status}` };

            // Crucial fix: continue on 404, 410, 422, 429, 500, 502, 503
            if (status === 404 || status === 410 || status === 422 || status === 429 || status === 500 || status === 502 || status === 503) {
                const shortName = model.split('/')[1]?.replace(':free', '') || model;
                console.warn(`[AutoPilot] OpenRouter model ${model} returned ${status}. Trying next free model...`);
                await appendLog(`OpenRouter ${shortName} (${status}). Trying next free model...`, 'info');
                continue;
            }

            if (status === 401 || status === 403) {
                break;
            }

        } catch (e) {
            lastError = { status: 0, message: e.message };
        }
    }

    return {
        ok: false,
        status: lastError?.status || 500,
        error: lastError?.message || 'All OpenRouter free models failed'
    };
}

// ==========================================
// 4. NVIDIA NIM DYNAMIC AUTO-DETECTION & MULTI-MODEL FAILOVER
// ==========================================

async function discoverNvidiaModels(apiKey) {
    try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            const models = (data.data || []).map(m => m.id);
            if (models.length > 0) return models;
        }
    } catch (e) {
        console.warn('[AutoPilot] NVIDIA model discovery error:', e);
    }
    return null;
}

async function getNvidiaCandidateModels(apiKey) {
    const defaultList = [
        'meta/llama-3.1-8b-instruct',
        'meta/llama-3.1-70b-instruct',
        'meta/llama-3.3-70b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct',
        'mistralai/mistral-large-2-instruct',
        'deepseek-ai/deepseek-r1',
        'qwen/qwen2.5-72b-instruct'
    ];
    try {
        const discovered = await discoverNvidiaModels(apiKey);
        if (discovered && discovered.length > 0) {
            const sorted = [];
            for (const m of defaultList) {
                if (discovered.includes(m)) sorted.push(m);
            }
            for (const m of discovered) {
                if (!sorted.includes(m)) sorted.push(m);
            }
            if (sorted.length > 0) return sorted;
        }
    } catch (e) {}
    return defaultList;
}

async function callNvidia(apiKey, prompt) {
    const candidateModels = await getNvidiaCandidateModels(apiKey);
    let lastError = null;

    for (const model of candidateModels) {
        try {
            const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
            const bodyPayload = {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert academic quiz solver. Output ONLY a valid JSON array of objects without Markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                signal: AbortSignal.timeout(20000),
                body: JSON.stringify(bodyPayload)
            });

            const status = response.status;
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                const text = data.choices?.[0]?.message?.content;
                if (text) {
                    const shortName = model.split('/')[1] || model;
                    await chrome.storage.local.set({ cachedNvidiaModel: model });
                    return { ok: true, text, modelUsed: `NVIDIA (${shortName})` };
                }
            }

            lastError = { status, message: data.error?.message || `HTTP ${status}` };

            // Crucial fix: HTTP 410 (Gone), 404 (Not Found), 422 (Unprocessable), 429 (Rate Limit), 500, 503
            // MUST ALL continue to next model! NEVER break on 410!
            if (status === 410 || status === 404 || status === 422 || status === 429 || status === 500 || status === 503) {
                const shortName = model.split('/')[1] || model;
                console.warn(`[AutoPilot] NVIDIA model ${shortName} returned ${status}. Switching to next model...`);
                await appendLog(`NVIDIA ${shortName} (${status}). Switching to next model...`, 'info');
                continue;
            }

            if (status === 401 || status === 403) {
                break;
            }

        } catch (e) {
            lastError = { status: 0, message: e.message };
        }
    }

    return {
        ok: false,
        status: lastError?.status || 500,
        error: lastError?.message || 'All NVIDIA models failed'
    };
}

// ==========================================
// COOLDOWN & LOGGING UTILITIES
// ==========================================

async function appendLog(message, type = 'info') {
    try {
        const time = new Date().toLocaleTimeString();
        const data = await chrome.storage.local.get(['activityLogs']);
        const logs = data.activityLogs || [];
        logs.unshift({ time, message, type });
        if (logs.length > 60) logs.pop();
        await chrome.storage.local.set({ activityLogs: logs });
    } catch (e) {
        console.warn('[AutoPilot BG] Could not append log:', e);
    }
}

async function getCooldowns() {
    const data = await chrome.storage.local.get(['providerCooldowns']);
    return data.providerCooldowns || {};
}

async function setCooldown(providerId, ms = 60000) {
    const cooldowns = await getCooldowns();
    cooldowns[providerId] = Date.now() + ms;
    await chrome.storage.local.set({ providerCooldowns: cooldowns });
}

async function clearCooldown(providerId) {
    const cooldowns = await getCooldowns();
    if (cooldowns[providerId]) {
        delete cooldowns[providerId];
        await chrome.storage.local.set({ providerCooldowns: cooldowns });
    }
}

// ==========================================
// MULTI-PROVIDER FAILOVER DISPATCHER
// ==========================================

// In-flight request lock to prevent duplicate concurrent network calls
let activeAIRequestPromise = null;

async function handleAIRequest(request) {
    if (activeAIRequestPromise) {
        console.log('[AutoPilot BG] AI request already in-flight. Joining active request...');
        return activeAIRequestPromise;
    }

    activeAIRequestPromise = (async () => {
        try {
            return await executeAIRequest(request);
        } finally {
            activeAIRequestPromise = null;
        }
    })();

    return activeAIRequestPromise;
}

async function executeAIRequest(request) {
    const prompt = request.prompt;
    if (!prompt) {
        return { success: false, error: "No prompt provided to AI dispatcher." };
    }

    // Retrieve all stored settings and keys
    const storage = await chrome.storage.local.get([
        'geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'nvidiaApiKey',
        'preferredProvider', 'providerCooldowns'
    ]);

    const keys = {
        groq: (storage.groqApiKey || '').trim(),
        gemini: (request.apiKey || storage.geminiApiKey || '').trim(),
        openrouter: (storage.openRouterApiKey || '').trim(),
        nvidia: (storage.nvidiaApiKey || '').trim()
    };

    const cooldowns = storage.providerCooldowns || {};

    // Build candidate order
    const defaultOrder = ['groq', 'gemini', 'openrouter', 'nvidia'];
    const pref = storage.preferredProvider;
    let candidateOrder = (pref && pref !== 'auto' && defaultOrder.includes(pref))
        ? [pref, ...defaultOrder.filter(p => p !== pref)]
        : defaultOrder;

    // Filter to providers that have an API key configured
    const availableProviders = candidateOrder.filter(pId => !!keys[pId]);

    if (availableProviders.length === 0) {
        return {
            success: false,
            error: "No AI API keys configured. Please add a free key (Groq, Gemini, OpenRouter, or NVIDIA) in the extension popup."
        };
    }

    // Check cooldown status
    const readyProviders = availableProviders.filter(pId => {
        const cd = cooldowns[pId] || 0;
        return Date.now() >= cd;
    });

    let providersToTry = readyProviders;

    // If ALL configured providers are in cooldown, pick the one expiring soonest
    if (readyProviders.length === 0) {
        let earliestPId = availableProviders[0];
        let minCooldownTime = cooldowns[earliestPId] || 0;

        for (const pId of availableProviders) {
            const cd = cooldowns[pId] || 0;
            if (cd < minCooldownTime) {
                minCooldownTime = cd;
                earliestPId = pId;
            }
        }

        const waitSeconds = Math.max(1, Math.ceil((minCooldownTime - Date.now()) / 1000));
        if (waitSeconds <= 5) {
            // Short wait: wait and retry earliest
            await new Promise(r => setTimeout(r, waitSeconds * 1000));
            providersToTry = [earliestPId];
        } else {
            return {
                success: false,
                isRateLimit: true,
                error: `All configured AI providers are in cooldown. Next provider (${PROVIDERS[earliestPId].name}) ready in ${waitSeconds}s.`
            };
        }
    }

    // Execute failover loop across candidate providers
    const failureLogs = [];

    for (const pId of providersToTry) {
        const prov = PROVIDERS[pId];
        const key = keys[pId];

        await appendLog(`Querying ${prov.name}...`, 'info');
        console.log(`[AutoPilot] Querying AI Provider: ${prov.name}`);

        try {
            const result = await prov.call(key, prompt);

            if (result.ok && result.text) {
                // Success! Clear any existing cooldown for this provider
                await clearCooldown(pId);
                const modelLabel = result.modelUsed || prov.name;
                await appendLog(`✓ Answer received from ${modelLabel}`, 'success');
                return {
                    success: true,
                    text: result.text,
                    provider: modelLabel,
                    providerId: pId
                };
            }

            // Failure handling
            const status = result.status;
            const errMsg = result.error || 'Unknown error';
            failureLogs.push(`${prov.name}: HTTP ${status} - ${errMsg}`);

            if (status === 429 || status === 503) {
                // Rate limit or server overload: activate cooldown (25s)
                await setCooldown(pId, prov.cooldownMs);
                const cdSec = Math.round(prov.cooldownMs / 1000);
                await appendLog(`⚠️ ${prov.name} rate limit reached (HTTP ${status}). Cooling down for ${cdSec}s. Auto-switching to next AI...`, 'warn');
            } else if (status === 401 || status === 403) {
                // Authentication issue: 2 min cooldown to allow key updates
                await setCooldown(pId, 120000);
                await appendLog(`⚠️ ${prov.name} authentication failed (verify API key). Auto-switching to next AI...`, 'warn');
            } else {
                // Generic error: short cooldown (20s)
                await setCooldown(pId, 20000);
                await appendLog(`⚠️ ${prov.name} failed (${errMsg}). Auto-switching to next AI...`, 'warn');
            }

        } catch (err) {
            const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.toLowerCase().includes('timeout'));
            const cdMs = isTimeout ? 30000 : 20000;
            await setCooldown(pId, cdMs);
            failureLogs.push(`${prov.name}: ${err.message}`);
            await appendLog(`⚠️ ${prov.name} error (${err.message}). Auto-switching to next AI...`, 'warn');
        }
    }

    // If all providers failed
    return {
        success: false,
        error: `All available AI providers failed:\n${failureLogs.join('\n')}`
    };
}

// ==========================================
// CHROME RUNTIME MESSAGE & EVENT LISTENERS
// ==========================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ASK_AI' || request.type === 'ASK_GEMINI') {
        (async () => {
            const resp = await handleAIRequest(request);
            sendResponse(resp);
        })();
        return true; // Keep message channel open for async response
    }

    if (request.type === 'RESET_COOLDOWNS') {
        (async () => {
            await chrome.storage.local.set({ providerCooldowns: {} });
            await chrome.storage.local.remove([
                'cachedGeminiModel',
                'cachedNvidiaModel',
                'cachedGroqModel',
                'cachedOpenRouterModel'
            ]);
            await appendLog('Reset all AI provider cooldowns and model caches.', 'info');
            sendResponse({ success: true });
        })();
        return true;
    }
});

// Clear provider cooldowns when API keys are updated in settings
chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiApiKey) clearCooldown('gemini');
    if (changes.groqApiKey) clearCooldown('groq');
    if (changes.openRouterApiKey) clearCooldown('openrouter');
    if (changes.nvidiaApiKey) clearCooldown('nvidia');
});

// Clean up stale/throttled model caches on startup & extension install
async function cleanupStaleCaches() {
    try {
        const data = await chrome.storage.local.get(['cachedGeminiModel', 'providerCooldowns']);
        // If 2.5-flash was cached from older versions, remove it so 1.5-flash is preferred
        if (data.cachedGeminiModel && data.cachedGeminiModel.includes('2.5-flash')) {
            console.log('[AutoPilot BG] Removing throttled cachedGeminiModel (2.5-flash)');
            await chrome.storage.local.remove(['cachedGeminiModel']);
        }
        // Purge expired cooldowns
        if (data.providerCooldowns) {
            const now = Date.now();
            const cleaned = {};
            for (const [pId, expires] of Object.entries(data.providerCooldowns)) {
                if (expires > now) cleaned[pId] = expires;
            }
            await chrome.storage.local.set({ providerCooldowns: cleaned });
        }
    } catch (e) {
        console.warn('[AutoPilot BG] Cache cleanup error:', e);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    cleanupStaleCaches();
});

cleanupStaleCaches();