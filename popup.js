// Coursera AI AutoPilot - Popup Controller v9.8
// Multi-provider AI dispatcher, real-time cooldown tracking, solution viewer, and logs.

document.addEventListener('DOMContentLoaded', () => {
    // Speed & Automation Controls
    const speedInjectionCB = document.getElementById('speedInjectionCB');
    const speedToggleStatus = document.getElementById('speedToggleStatus');
    const speedInputWrapper = document.getElementById('speedInputWrapper');
    const forceMethodWrapper = document.getElementById('forceMethodWrapper');
    const speedInput = document.getElementById('speedInput');
    const forceMethodSelect = document.getElementById('forceMethodSelect');
    const focusModeSelect = document.getElementById('focusModeSelect');
    const strictCompletionCB = document.getElementById('strictCompletionCB');
    const autoSolveCB = document.getElementById('autoSolveCB');
    const bgPlayCB = document.getElementById('bgPlayCB');
    const autoNavigateCB = document.getElementById('autoNavigateCB');

    function updateSpeedInjectionUI(enabled) {
        if (!speedToggleStatus) return;
        if (enabled) {
            speedToggleStatus.innerText = 'ENABLED';
            speedToggleStatus.style.color = '#00E676';
            speedToggleStatus.style.background = 'rgba(0, 230, 118, 0.15)';
            speedToggleStatus.style.borderColor = 'rgba(0, 230, 118, 0.3)';
            if (speedInputWrapper) {
                speedInputWrapper.style.opacity = '1';
                speedInputWrapper.style.pointerEvents = 'auto';
            }
            if (forceMethodWrapper) {
                forceMethodWrapper.style.opacity = '1';
                forceMethodWrapper.style.pointerEvents = 'auto';
            }
        } else {
            speedToggleStatus.innerText = 'OFF (Native)';
            speedToggleStatus.style.color = '#ff9800';
            speedToggleStatus.style.background = 'rgba(255, 152, 0, 0.15)';
            speedToggleStatus.style.borderColor = 'rgba(255, 152, 0, 0.3)';
            if (speedInputWrapper) {
                speedInputWrapper.style.opacity = '0.45';
                speedInputWrapper.style.pointerEvents = 'none';
            }
            if (forceMethodWrapper) {
                forceMethodWrapper.style.opacity = '0.45';
                forceMethodWrapper.style.pointerEvents = 'none';
            }
        }
    }

    // Provider Selector & Keys
    const providerSelect = document.getElementById('providerSelect');
    const toggleKeysBtn = document.getElementById('toggleKeysBtn');
    const keysDrawer = document.getElementById('keysDrawer');
    const keysArrow = document.getElementById('keysArrow');

    const groqApiKeyInput = document.getElementById('groqApiKeyInput');
    const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    const openRouterApiKeyInput = document.getElementById('openRouterApiKeyInput');
    const nvidiaApiKeyInput = document.getElementById('nvidiaApiKeyInput');
    const resetCooldownsBtn = document.getElementById('resetCooldownsBtn');

    // Chips
    const chips = {
        groq: document.getElementById('chip-groq'),
        gemini: document.getElementById('chip-gemini'),
        openrouter: document.getElementById('chip-openrouter'),
        nvidia: document.getElementById('chip-nvidia')
    };

    // Navigation Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panes = {
        settings: document.getElementById('pane-settings'),
        quiz: document.getElementById('pane-quiz'),
        logs: document.getElementById('pane-logs')
    };
    const quizBadge = document.getElementById('quizBadge');

    // Containers
    const quizSolutionContainer = document.getElementById('quizSolutionContainer');
    const logList = document.getElementById('logList');
    const clearLogsBtn = document.getElementById('clearLogsBtn');

    const SPEED_MIN = 0.25;
    const SPEED_MAX = 16.0;

    function sanitizeSpeed(val) {
        const num = parseFloat(val);
        if (isNaN(num) || num < SPEED_MIN) return 1.0;
        return Math.min(Math.max(num, SPEED_MIN), SPEED_MAX);
    }

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            Object.keys(panes).forEach(k => {
                if (panes[k]) {
                    if (k === targetTab) panes[k].classList.add('active');
                    else panes[k].classList.remove('active');
                }
            });
        });
    });

    // Collapsible Keys Section
    let keysOpen = false;
    if (toggleKeysBtn && keysDrawer) {
        toggleKeysBtn.addEventListener('click', () => {
            keysOpen = !keysOpen;
            keysDrawer.style.display = keysOpen ? 'flex' : 'none';
            if (keysArrow) keysArrow.innerText = keysOpen ? '▲' : '▼';
        });
    }

    // Update Provider Status Chips
    function updateProviderChips(data) {
        const keys = {
            groq: (data.groqApiKey || '').trim(),
            gemini: (data.geminiApiKey || '').trim(),
            openrouter: (data.openRouterApiKey || '').trim(),
            nvidia: (data.nvidiaApiKey || '').trim()
        };

        const cooldowns = data.providerCooldowns || {};
        const now = Date.now();

        const providerNames = {
            groq: 'Groq',
            gemini: 'Gemini',
            openrouter: 'OpenRouter',
            nvidia: 'NVIDIA'
        };

        Object.keys(chips).forEach(pId => {
            const chip = chips[pId];
            if (!chip) return;

            const hasKey = !!keys[pId];
            const cdUntil = cooldowns[pId] || 0;
            const isCooldown = now < cdUntil;

            chip.className = 'status-chip';

            if (!hasKey) {
                chip.classList.add('unset');
                chip.innerHTML = `<span>${providerNames[pId]}</span><span class="chip-state">Not Set</span>`;
            } else if (isCooldown) {
                const remaining = Math.max(1, Math.ceil((cdUntil - now) / 1000));
                chip.classList.add('cooldown');
                chip.innerHTML = `<span>${providerNames[pId]}</span><span class="chip-state">⏳ ${remaining}s</span>`;
            } else {
                chip.classList.add('ready');
                chip.innerHTML = `<span>${providerNames[pId]}</span><span class="chip-state">● Ready</span>`;
            }
        });
    }

    // Render Live AI Quiz Solutions
    function renderQuizSolution(data) {
        if (!quizSolutionContainer) return;
        if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
            quizSolutionContainer.innerHTML = `
                <div class="quiz-empty">
                    <div class="quiz-empty-icon">🧠</div>
                    No quiz solved yet.<br>
                    Open a quiz on Coursera to view live AI answers, step-by-step reasoning, and marked choices right here!
                </div>
            `;
            if (quizBadge) quizBadge.classList.remove('active');
            return;
        }

        if (quizBadge) quizBadge.classList.add('active');

        const title = data.title || 'Coursera Quiz';
        const time = data.timestamp || '';
        const providerTag = data.providerUsed ? `<span class="provider-badge-tag">${escapeHtml(data.providerUsed)}</span>` : '';
        const gradeTag = data.grade ? `<span class="grade-badge-tag" style="background: #e8f5e9; color: #2e7d32; border: 1px solid rgba(46, 125, 50, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; margin-left: 6px;">Score: ${escapeHtml(data.grade)}</span>` : '';

        let html = `
            <div class="quiz-meta">
                <div>
                    <span class="quiz-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                    ${providerTag}
                    ${gradeTag}
                </div>
                <span class="quiz-time">⏱ ${escapeHtml(time)}</span>
            </div>
        `;

        data.questions.forEach((q, idx) => {
            const isSingle = q.type === 'radio';
            html += `
                <div class="question-card">
                    <div class="q-prompt-title">Q${idx + 1}: ${escapeHtml(q.prompt || 'Question ' + (idx + 1))}</div>
                    <div class="options-list">
            `;

            if (q.type === 'text') {
                const typedVal = q.markedText || (q.aiAnswerTexts && q.aiAnswerTexts[0]) || '';
                html += `
                    <div class="option-row selected" style="background: rgba(30, 166, 114, 0.08); border-color: rgba(30, 166, 114, 0.4); padding: 8px 12px; border-radius: 6px;">
                        <span>✍️ <strong>Typed Answer:</strong> "${escapeHtml(typedVal)}"</span>
                        <span class="selected-tag">✓ Typed by AI</span>
                    </div>
                `;
            } else {
                (q.options || []).forEach((optText, oIdx) => {
                    const isSelected = Array.isArray(q.markedIndex) 
                        ? q.markedIndex.includes(oIdx) 
                        : q.markedIndex === oIdx;

                    html += `
                        <div class="option-row ${isSelected ? 'selected' : ''}">
                            <span>${isSingle ? (isSelected ? '●' : '○') : (isSelected ? '☑' : '☐')} ${escapeHtml(optText)}</span>
                            ${isSelected ? `<span class="selected-tag">✓ Chosen by AI</span>` : ''}
                        </div>
                    `;
                });
            }

            html += `
                    </div>
                    ${q.aiRationale ? `
                        <div class="rationale-box">
                            <div class="rationale-title">💡 Reasoning:</div>
                            <div>${escapeHtml(q.aiRationale)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        // Add Raw JSON Collapsible
        if (data.rawResponse) {
            html += `
                <div class="raw-drawer">
                    <button type="button" id="toggleRawBtn" class="raw-toggle-btn">🔍 View Raw AI Response & Prompt</button>
                    <div id="rawContent" class="raw-content"><strong>Prompt Sent:</strong>\n${escapeHtml(data.rawPrompt || '')}\n\n<strong>AI Response:</strong>\n${escapeHtml(data.rawResponse || '')}</div>
                </div>
            `;
        }

        quizSolutionContainer.innerHTML = html;

        const toggleBtn = document.getElementById('toggleRawBtn');
        const rawContent = document.getElementById('rawContent');
        if (toggleBtn && rawContent) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = rawContent.style.display === 'block';
                rawContent.style.display = isVisible ? 'none' : 'block';
                toggleBtn.innerText = isVisible ? '🔍 View Raw AI Response & Prompt' : '✕ Hide Raw AI Response';
            });
        }
    }

    // Render activity logs
    function renderLogs(logs) {
        if (!logList) return;
        if (!Array.isArray(logs) || logs.length === 0) {
            logList.innerHTML = '<div class="log-empty">No activity recorded yet.</div>';
            return;
        }

        logList.innerHTML = logs.map(item => {
            const type = item.type || 'info';
            const time = item.time || '';
            const msg = escapeHtml(item.message || '');
            return `
                <div class="log-item">
                    <span class="log-time">[${time}]</span>
                    <span class="log-msg ${type}">${msg}</span>
                </div>
            `;
        }).join('');
    }

    function escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Load saved settings & state
    let cachedStorage = {};

    function refreshStorage() {
        chrome.storage.local.get([
            'speedInjection', 'playbackSpeed', 'forceMode', 'preferredProvider', 'focusMode', 'strictCompletion',
            'geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'nvidiaApiKey',
            'autoSolve', 'bgPlay', 'autoNavigate',
            'activityLogs', 'lastGeminiQuizData', 'providerCooldowns'
        ], (data) => {
            cachedStorage = data;

            if (speedInjectionCB) {
                const isSpeedEnabled = data.speedInjection !== undefined ? !!data.speedInjection : true;
                speedInjectionCB.checked = isSpeedEnabled;
                updateSpeedInjectionUI(isSpeedEnabled);
            }

            let currentSpeed = data.playbackSpeed !== undefined ? sanitizeSpeed(data.playbackSpeed) : 3;
            speedInput.value = currentSpeed;
            if (data.playbackSpeed !== currentSpeed) {
                chrome.storage.local.set({ playbackSpeed: currentSpeed });
            }

            if (forceMethodSelect) forceMethodSelect.value = data.forceMode || 'hybrid';
            if (providerSelect) providerSelect.value = data.preferredProvider || 'auto';
            if (focusModeSelect) focusModeSelect.value = data.focusMode || 'all';
            if (strictCompletionCB) strictCompletionCB.checked = data.strictCompletion !== undefined ? data.strictCompletion : true;

            if (geminiApiKeyInput) geminiApiKeyInput.value = data.geminiApiKey || '';
            if (groqApiKeyInput) groqApiKeyInput.value = data.groqApiKey || '';
            if (openRouterApiKeyInput) openRouterApiKeyInput.value = data.openRouterApiKey || '';
            if (nvidiaApiKeyInput) nvidiaApiKeyInput.value = data.nvidiaApiKey || '';

            // If no keys configured, open the keys drawer automatically for convenience
            const hasAny = !!(data.geminiApiKey || data.groqApiKey || data.openRouterApiKey || data.nvidiaApiKey);
            if (!hasAny && keysDrawer) {
                keysOpen = true;
                keysDrawer.style.display = 'flex';
                if (keysArrow) keysArrow.innerText = '▲';
            }

            autoSolveCB.checked = data.autoSolve !== undefined ? data.autoSolve : true;
            bgPlayCB.checked = data.bgPlay !== undefined ? data.bgPlay : true;
            autoNavigateCB.checked = data.autoNavigate !== undefined ? data.autoNavigate : true;

            updateProviderChips(data);
            renderLogs(data.activityLogs);
            renderQuizSolution(data.lastGeminiQuizData);
        });
    }

    refreshStorage();

    // 1-second interval to update chip countdowns visually
    setInterval(() => {
        if (cachedStorage) {
            updateProviderChips(cachedStorage);
        }
    }, 1000);

    // Storage change listener
    chrome.storage.onChanged.addListener((changes) => {
        Object.keys(changes).forEach(k => {
            cachedStorage[k] = changes[k].newValue;
        });

        if (changes.speedInjection !== undefined && speedInjectionCB) {
            const isSpeedEnabled = changes.speedInjection.newValue !== undefined ? !!changes.speedInjection.newValue : true;
            speedInjectionCB.checked = isSpeedEnabled;
            updateSpeedInjectionUI(isSpeedEnabled);
        }
        if (changes.forceMode && forceMethodSelect) {
            forceMethodSelect.value = changes.forceMode.newValue || 'hybrid';
        }
        if (changes.focusMode && focusModeSelect) {
            focusModeSelect.value = changes.focusMode.newValue || 'all';
        }
        if (changes.strictCompletion && strictCompletionCB) {
            strictCompletionCB.checked = changes.strictCompletion.newValue !== undefined ? changes.strictCompletion.newValue : true;
        }
        if (changes.activityLogs) renderLogs(changes.activityLogs.newValue);
        if (changes.lastGeminiQuizData) renderQuizSolution(changes.lastGeminiQuizData.newValue);
        if (changes.providerCooldowns || changes.groqApiKey || changes.geminiApiKey || changes.openRouterApiKey || changes.nvidiaApiKey) {
            updateProviderChips(cachedStorage);
        }
    });

    // Clear logs button
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            chrome.storage.local.set({ activityLogs: [] }, () => {
                renderLogs([]);
            });
        });
    }

    // Reset cooldowns button
    if (resetCooldownsBtn) {
        resetCooldownsBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'RESET_COOLDOWNS' }, () => {
                cachedStorage.providerCooldowns = {};
                updateProviderChips(cachedStorage);
            });
        });
    }

    // Speed injection toggle listener
    if (speedInjectionCB) {
        speedInjectionCB.addEventListener('change', () => {
            const isEnabled = speedInjectionCB.checked;
            chrome.storage.local.set({ speedInjection: isEnabled });
            updateSpeedInjectionUI(isEnabled);
        });
    }

    // Speed input listeners
    function saveSpeed() {
        const clean = sanitizeSpeed(speedInput.value);
        speedInput.value = clean;
        chrome.storage.local.set({ playbackSpeed: clean });
    }
    speedInput.addEventListener('change', saveSpeed);
    speedInput.addEventListener('blur', saveSpeed);

    // Force Method listener
    if (forceMethodSelect) {
        forceMethodSelect.addEventListener('change', () => {
            chrome.storage.local.set({ forceMode: forceMethodSelect.value });
        });
    }

    // Focus Mode listener
    if (focusModeSelect) {
        focusModeSelect.addEventListener('change', () => {
            chrome.storage.local.set({ focusMode: focusModeSelect.value });
        });
    }

    // Strict Completion listener
    if (strictCompletionCB) {
        strictCompletionCB.addEventListener('change', () => {
            chrome.storage.local.set({ strictCompletion: strictCompletionCB.checked });
        });
    }

    // Provider Select listener
    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            chrome.storage.local.set({ preferredProvider: providerSelect.value });
        });
    }

    // Key inputs listeners
    if (groqApiKeyInput) {
        groqApiKeyInput.addEventListener('input', () => {
            chrome.storage.local.set({ groqApiKey: groqApiKeyInput.value.trim() });
        });
    }
    if (geminiApiKeyInput) {
        geminiApiKeyInput.addEventListener('input', () => {
            chrome.storage.local.set({ geminiApiKey: geminiApiKeyInput.value.trim() });
        });
    }
    if (openRouterApiKeyInput) {
        openRouterApiKeyInput.addEventListener('input', () => {
            chrome.storage.local.set({ openRouterApiKey: openRouterApiKeyInput.value.trim() });
        });
    }
    if (nvidiaApiKeyInput) {
        nvidiaApiKeyInput.addEventListener('input', () => {
            chrome.storage.local.set({ nvidiaApiKey: nvidiaApiKeyInput.value.trim() });
        });
    }

    autoSolveCB.addEventListener('change', () => chrome.storage.local.set({ autoSolve: autoSolveCB.checked }));
    bgPlayCB.addEventListener('change', () => chrome.storage.local.set({ bgPlay: bgPlayCB.checked }));
    autoNavigateCB.addEventListener('change', () => chrome.storage.local.set({ autoNavigate: autoNavigateCB.checked }));
});