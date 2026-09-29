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
    const superBypassVideoBtn = document.getElementById('superBypassVideoBtn');
    const superBypassVideoCB = document.getElementById('superBypassVideoCB');

    function updateSuperBypassUI(enabled) {
        if (superBypassVideoCB) superBypassVideoCB.checked = !!enabled;
        if (superBypassVideoBtn) {
            if (enabled) {
                superBypassVideoBtn.innerText = '⚡ Super Bypass: ON';
                superBypassVideoBtn.style.background = 'linear-gradient(135deg, rgba(255, 152, 0, 0.4) 0%, rgba(255, 87, 34, 0.4) 100%)';
                superBypassVideoBtn.style.border = '1px solid #ff9800';
                superBypassVideoBtn.style.color = '#ffb74d';
                superBypassVideoBtn.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.4)';
            } else {
                superBypassVideoBtn.innerText = '⚡ Super Bypass: OFF';
                superBypassVideoBtn.style.background = 'rgba(255, 152, 0, 0.12)';
                superBypassVideoBtn.style.border = '1px solid rgba(255, 152, 0, 0.4)';
                superBypassVideoBtn.style.color = '#ffa726';
                superBypassVideoBtn.style.boxShadow = 'none';
            }
        }
    }

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
    const dualCourseMultiAICB = document.getElementById('dualCourseMultiAICB');
    const secondaryProviderSelect = document.getElementById('secondaryProviderSelect');
    const secondaryProviderWrapper = document.getElementById('secondaryProviderWrapper');
    const activeCoursesList = document.getElementById('activeCoursesList');
    const resetCoursesBtn = document.getElementById('resetCoursesBtn');

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

    // Render Active Courses & AI Assignments
    function renderActiveCourses(assignments) {
        if (!activeCoursesList) return;
        if (!assignments || Object.keys(assignments).length === 0) {
            activeCoursesList.innerHTML = `<div style="font-size: 10px; color: #6c757d; font-style: italic;">No concurrent courses active yet. Open Coursera courses in 2 tabs to run simultaneously!</div>`;
            return;
        }

        const providerBadges = {
            groq: '⚡ Groq (Llama 3.3)',
            gemini: '🌟 Google Gemini',
            openrouter: '🌐 OpenRouter',
            nvidia: '🟢 NVIDIA NIM'
        };

        let html = '';
        const entries = Object.entries(assignments);
        entries.forEach(([slug, pId], index) => {
            const cleanName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const badgeLabel = providerBadges[pId] || (pId.toUpperCase());
            html += `
                <div class="course-assignment-row">
                    <span class="course-slug-label" title="${escapeHtml(slug)}"><strong>Course ${index + 1}:</strong> ${escapeHtml(cleanName)}</span>
                    <span class="course-ai-badge">${escapeHtml(badgeLabel)}</span>
                </div>
            `;
        });
        activeCoursesList.innerHTML = html;
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
            'speedInjection', 'playbackSpeed', 'forceMode', 'preferredProvider', 'secondaryProvider', 'dualCourseMultiAI',
            'activeCourseAssignments', 'focusMode', 'strictCompletion', 'superBypassVideoMode',
            'geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'nvidiaApiKey',
            'autoSolve', 'bgPlay', 'autoNavigate',
            'activityLogs', 'lastGeminiQuizData', 'providerCooldowns'
        ], (data) => {
            cachedStorage = data;

            updateSuperBypassUI(!!data.superBypassVideoMode);

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
            if (secondaryProviderSelect) secondaryProviderSelect.value = data.secondaryProvider || 'gemini';

            if (dualCourseMultiAICB) {
                const isDual = data.dualCourseMultiAI !== undefined ? !!data.dualCourseMultiAI : true;
                dualCourseMultiAICB.checked = isDual;
                if (secondaryProviderWrapper) {
                    secondaryProviderWrapper.style.opacity = isDual ? '1' : '0.45';
                    secondaryProviderWrapper.style.pointerEvents = isDual ? 'auto' : 'none';
                }
            }

            renderActiveCourses(data.activeCourseAssignments);

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
        if (changes.preferredProvider && providerSelect) {
            providerSelect.value = changes.preferredProvider.newValue || 'auto';
        }
        if (changes.secondaryProvider && secondaryProviderSelect) {
            secondaryProviderSelect.value = changes.secondaryProvider.newValue || 'gemini';
        }
        if (changes.dualCourseMultiAI !== undefined && dualCourseMultiAICB) {
            const isDual = !!changes.dualCourseMultiAI.newValue;
            dualCourseMultiAICB.checked = isDual;
            if (secondaryProviderWrapper) {
                secondaryProviderWrapper.style.opacity = isDual ? '1' : '0.45';
                secondaryProviderWrapper.style.pointerEvents = isDual ? 'auto' : 'none';
            }
        }
        if (changes.activeCourseAssignments !== undefined) {
            renderActiveCourses(changes.activeCourseAssignments.newValue);
        }
        if (changes.focusMode && focusModeSelect) {
            focusModeSelect.value = changes.focusMode.newValue || 'all';
        }
        if (changes.superBypassVideoMode !== undefined) {
            updateSuperBypassUI(!!changes.superBypassVideoMode.newValue);
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

    // Preset Speed Buttons
    document.querySelectorAll('.speed-preset-btn').forEach(btn => {
        if (!btn.dataset.speed) return;
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed) || 2.0;
            speedInput.value = speed;
            chrome.storage.local.set({ playbackSpeed: speed, speedInjection: true });
            if (speedInjectionCB) {
                speedInjectionCB.checked = true;
                updateSpeedInjectionUI(true);
            }
        });
    });

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

    // Dual-Course Multi-AI listeners
    if (dualCourseMultiAICB) {
        dualCourseMultiAICB.addEventListener('change', () => {
            const isEnabled = dualCourseMultiAICB.checked;
            chrome.storage.local.set({ dualCourseMultiAI: isEnabled });
            if (secondaryProviderWrapper) {
                secondaryProviderWrapper.style.opacity = isEnabled ? '1' : '0.45';
                secondaryProviderWrapper.style.pointerEvents = isEnabled ? 'auto' : 'none';
            }
        });
    }

    if (secondaryProviderSelect) {
        secondaryProviderSelect.addEventListener('change', () => {
            chrome.storage.local.set({ secondaryProvider: secondaryProviderSelect.value });
        });
    }

    if (resetCoursesBtn) {
        resetCoursesBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'CLEAR_COURSE_ASSIGNMENTS' }, () => {
                cachedStorage.activeCourseAssignments = {};
                renderActiveCourses({});
            });
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

    // Super Bypass Video Mode listeners
    if (superBypassVideoBtn) {
        superBypassVideoBtn.addEventListener('click', () => {
            const newState = !superBypassVideoCB?.checked;
            chrome.storage.local.set({ superBypassVideoMode: newState });
            updateSuperBypassUI(newState);
        });
    }
    if (superBypassVideoCB) {
        superBypassVideoCB.addEventListener('change', () => {
            const newState = superBypassVideoCB.checked;
            chrome.storage.local.set({ superBypassVideoMode: newState });
            updateSuperBypassUI(newState);
        });
    }

    // ==========================================
    // GitHub Update Banner & 1-Click Updater
    // ==========================================
    const updateBanner = document.getElementById('updateBanner');
    const updateCommitSha = document.getElementById('updateCommitSha');
    const updateCommitMsg = document.getElementById('updateCommitMsg');
    const popupOneClickUpdateBtn = document.getElementById('popupOneClickUpdateBtn');
    const checkUpdatesLink = document.getElementById('checkUpdatesLink');
    const checkUpdatesMsg = document.getElementById('checkUpdatesMsg');
    const headerVersion = document.getElementById('headerVersion');

    function refreshUpdateUI(storageData) {
        if (!updateBanner) return;
        const manifest = chrome.runtime.getManifest();
        if (headerVersion && manifest.version) {
            headerVersion.textContent = `v${manifest.version}`;
        }

        const isAvailable = storageData.updateAvailable;
        const remoteSha = storageData.remoteCommit || '';
        const installedSha = storageData.installedCommit || '';

        // STRICT RULE: Only show update if there is a new commit on GitHub that is NOT yet installed!
        if (isAvailable && remoteSha && (!installedSha || !remoteSha.startsWith(installedSha.slice(0, 7)))) {
            updateBanner.style.display = 'block';
            if (updateCommitSha) updateCommitSha.textContent = remoteSha.slice(0, 7);
            if (updateCommitMsg) {
                const msg = storageData.remoteCommitMsg || 'New code pushed to GitHub repository.';
                updateCommitMsg.textContent = msg;
            }
        } else {
            // NEVER show update when already on latest version!
            updateBanner.style.display = 'none';
        }
    }

    // Load initial update status from storage
    chrome.storage.local.get(['updateAvailable', 'remoteCommit', 'remoteCommitMsg', 'installedCommit'], (res) => {
        refreshUpdateUI(res);
    });

    // Listen for storage changes if background updates it
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.updateAvailable || changes.remoteCommit || changes.installedCommit) {
            chrome.storage.local.get(['updateAvailable', 'remoteCommit', 'remoteCommitMsg', 'installedCommit'], (res) => {
                refreshUpdateUI(res);
            });
        }
    });

    // 1-Click Update button -> Opens dedicated 1-Click Updater tab with auto=1
    if (popupOneClickUpdateBtn) {
        popupOneClickUpdateBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('updater.html?auto=1') });
        });
    }

    // Manual "Check for Updates" link in footer
    if (checkUpdatesLink) {
        checkUpdatesLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (checkUpdatesMsg) {
                checkUpdatesMsg.style.display = 'block';
                checkUpdatesMsg.style.color = '#80d8ff';
                checkUpdatesMsg.textContent = 'Checking GitHub...';
            }

            chrome.runtime.sendMessage({ type: 'CHECK_FOR_UPDATES' }, (response) => {
                if (chrome.runtime.lastError || !response || response.error) {
                    if (checkUpdatesMsg) {
                        checkUpdatesMsg.style.color = '#ffd740';
                        checkUpdatesMsg.textContent = 'Could not reach GitHub (offline/rate-limited)';
                        setTimeout(() => { checkUpdatesMsg.style.display = 'none'; }, 4000);
                    }
                    return;
                }

                if (response.updateAvailable) {
                    if (checkUpdatesMsg) {
                        checkUpdatesMsg.style.color = '#00E676';
                        checkUpdatesMsg.textContent = '🚀 New update available on GitHub!';
                    }
                    chrome.storage.local.get(['updateAvailable', 'remoteCommit', 'remoteCommitMsg', 'installedCommit'], (res) => {
                        refreshUpdateUI(res);
                    });
                } else {
                    if (checkUpdatesMsg) {
                        checkUpdatesMsg.style.color = '#00E676';
                        checkUpdatesMsg.textContent = `✓ Up to date (${(response.localCommit || '').slice(0, 7)})`;
                        setTimeout(() => { checkUpdatesMsg.style.display = 'none'; }, 4000);
                    }
                    if (updateBanner) updateBanner.style.display = 'none';
                }
            });
        });
    }
});