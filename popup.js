// Coursera AI AutoPilot - Popup Controller v10.2
// 5-Tab Architecture: 1-Click Fast API, Practice Questions & AI, Video Controls, AI Logs, Activity Logs

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // TAB MANAGEMENT (5 DEDICATED TABS)
    // ==========================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panes = {
        oneclick: document.getElementById('pane-oneclick'),
        quiz: document.getElementById('pane-quiz'),
        video: document.getElementById('pane-video'),
        ailogs: document.getElementById('pane-ailogs'),
        logs: document.getElementById('pane-logs')
    };
    const quizBadge = document.getElementById('quizBadge');

    function switchTab(targetTab) {
        tabBtns.forEach(b => {
            if (b.getAttribute('data-tab') === targetTab) b.classList.add('active');
            else b.classList.remove('active');
        });

        Object.keys(panes).forEach(k => {
            if (panes[k]) {
                if (k === targetTab) panes[k].classList.add('active');
                else panes[k].classList.remove('active');
            }
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    // Redirect Card on Tab 1 -> Switches directly to Tab 2 (Practice Questions)
    const gotoQuizTabCard = document.getElementById('gotoQuizTabCard');
    const gotoQuizTabBtn = document.getElementById('gotoQuizTabBtn');
    if (gotoQuizTabCard) gotoQuizTabCard.addEventListener('click', () => switchTab('quiz'));
    if (gotoQuizTabBtn) gotoQuizTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchTab('quiz');
    });

    // ==========================================
    // TAB 1: 1-CLICK FAST API ENGINE CONTROLLER
    // ==========================================
    const courseNameText = document.getElementById('courseNameText');
    const courseSlugText = document.getElementById('courseSlugText');
    const courseStatusBadge = document.getElementById('courseStatusBadge');
    const startBulkCompleteBtn = document.getElementById('startBulkCompleteBtn');
    const startSingleCompleteBtn = document.getElementById('startSingleCompleteBtn');
    const bulkProgressCard = document.getElementById('bulkProgressCard');
    const bulkProgressStats = document.getElementById('bulkProgressStats');
    const bulkProgressBar = document.getElementById('bulkProgressBar');
    const bulkStatusText = document.getElementById('bulkStatusText');
    const cancelBulkBtn = document.getElementById('cancelBulkBtn');

    function detectActiveCourse() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.url) {
                if (courseNameText) courseNameText.textContent = "No active Coursera tab";
                if (courseSlugText) courseSlugText.textContent = "Open Coursera in your browser";
                if (courseStatusBadge) {
                    courseStatusBadge.textContent = "INACTIVE";
                    courseStatusBadge.style.color = "#ef4444";
                    courseStatusBadge.style.background = "rgba(239, 68, 68, 0.1)";
                }
                return;
            }

            if (!tab.url.includes('coursera.org')) {
                if (courseNameText) courseNameText.textContent = "Not on Coursera";
                if (courseSlugText) courseSlugText.textContent = "Navigate to coursera.org/learn/...";
                if (courseStatusBadge) {
                    courseStatusBadge.textContent = "OFFLINE";
                    courseStatusBadge.style.color = "#ef4444";
                    courseStatusBadge.style.background = "rgba(239, 68, 68, 0.1)";
                }
                return;
            }

            const match = tab.url.match(/\/learn\/([^/?#]+)/i);
            const slug = match ? match[1] : 'coursera_course';
            const cleanTitle = (tab.title || slug)
                .replace(/\s*\|\s*Coursera\s*$/i, '')
                .replace(/\s*-\s*Coursera\s*$/i, '');

            if (courseNameText) courseNameText.textContent = cleanTitle;
            if (courseSlugText) courseSlugText.textContent = `Course: ${slug}`;
            if (courseStatusBadge) {
                courseStatusBadge.textContent = "READY";
                courseStatusBadge.style.color = "#00E676";
                courseStatusBadge.style.background = "rgba(0, 230, 118, 0.1)";
            }
        });
    }

    detectActiveCourse();
    window.addEventListener('focus', detectActiveCourse);

    function renderBulkProgress(prog) {
        if (!prog || (!prog.isRunning && !prog.isCompleted && !prog.error && !prog.isCancelled)) {
            if (bulkProgressCard) bulkProgressCard.style.display = 'none';
            return;
        }

        if (bulkProgressCard) bulkProgressCard.style.display = 'block';

        const completed = prog.completed || 0;
        const total = prog.total || 0;
        const percent = prog.percent !== undefined ? prog.percent : (total > 0 ? Math.round((completed / total) * 100) : 0);

        if (bulkProgressStats) bulkProgressStats.textContent = `${completed} / ${total} (${percent}%)`;
        if (bulkProgressBar) bulkProgressBar.style.width = `${percent}%`;
        if (bulkStatusText) {
            bulkStatusText.textContent = prog.statusText || (prog.error ? `Error: ${prog.error}` : 'Running Fast API completion...');
            if (prog.error) bulkStatusText.style.color = '#ef4444';
            else if (prog.isCompleted) bulkStatusText.style.color = '#008744';
            else bulkStatusText.style.color = '#475569';
        }

        if (cancelBulkBtn) {
            cancelBulkBtn.style.display = prog.isRunning ? 'inline-block' : 'none';
        }

        if (startBulkCompleteBtn) {
            if (prog.isRunning) {
                startBulkCompleteBtn.style.opacity = '0.75';
                startBulkCompleteBtn.style.pointerEvents = 'none';
            } else {
                startBulkCompleteBtn.style.opacity = '1';
                startBulkCompleteBtn.style.pointerEvents = 'auto';
            }
        }
    }

    if (startBulkCompleteBtn) {
        startBulkCompleteBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab || !tab.url || !tab.url.includes('coursera.org')) {
                    alert("Please open a Coursera course tab first!");
                    return;
                }

                if (bulkProgressCard) bulkProgressCard.style.display = 'block';
                if (bulkProgressBar) bulkProgressBar.style.width = '2%';
                if (bulkProgressStats) bulkProgressStats.textContent = 'Starting...';
                if (bulkStatusText) {
                    bulkStatusText.textContent = 'Connecting to Coursera Fast API Engine...';
                    bulkStatusText.style.color = '#0056D2';
                }

                chrome.tabs.sendMessage(tab.id, { action: 'markAllCompleted' }, (resp) => {
                    if (chrome.runtime.lastError) {
                        if (bulkStatusText) {
                            bulkStatusText.textContent = 'Please refresh the Coursera webpage once and click again.';
                            bulkStatusText.style.color = '#ef4444';
                        }
                    }
                });
            });
        });
    }

    if (startSingleCompleteBtn) {
        startSingleCompleteBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab || !tab.url || !tab.url.includes('coursera.org')) {
                    alert("Please open a Coursera lecture or reading tab first!");
                    return;
                }
                startSingleCompleteBtn.innerText = "⏳ Completing via API...";
                chrome.tabs.sendMessage(tab.id, { action: 'markCompleted' }, (resp) => {
                    startSingleCompleteBtn.innerText = "⏩ Mark Current Item Complete";
                    if (chrome.runtime.lastError) {
                        alert("Please refresh the Coursera page once and try again.");
                        return;
                    }
                    if (resp && resp.success) {
                        alert(resp.message || "Item completed successfully! Refresh page to see green tick.");
                    } else {
                        alert(resp?.error || "Could not complete this item.");
                    }
                });
            });
        });
    }

    if (cancelBulkBtn) {
        cancelBulkBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'cancelBulkCompleted' });
                }
            });
        });
    }

    // ==========================================
    // TAB 2: PRACTICE QUESTIONS & AI SOLVER
    // ==========================================
    const autoSolveCB = document.getElementById('autoSolveCB');
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

    const chips = {
        groq: document.getElementById('chip-groq'),
        gemini: document.getElementById('chip-gemini'),
        openrouter: document.getElementById('chip-openrouter'),
        nvidia: document.getElementById('chip-nvidia')
    };

    const quizSolutionContainer = document.getElementById('quizSolutionContainer');

    // Collapsible Keys Section
    let keysOpen = false;
    if (toggleKeysBtn && keysDrawer) {
        toggleKeysBtn.addEventListener('click', () => {
            keysOpen = !keysOpen;
            keysDrawer.style.display = keysOpen ? 'flex' : 'none';
            if (keysArrow) keysArrow.innerText = keysOpen ? '▲' : '▼';
        });
    }

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
                chip.innerHTML = `<span>${providerNames[pId]}</span><span class="chip-state">✓ Ready</span>`;
            }
        });
    }

    function renderActiveCourses(assignments) {
        if (!activeCoursesList) return;
        if (!assignments || Object.keys(assignments).length === 0) {
            activeCoursesList.innerHTML = '<div style="font-size: 10px; color: #6c757d; font-style: italic;">No concurrent courses active yet. Open Coursera courses in 2 tabs to run simultaneously!</div>';
            return;
        }

        const entries = Object.entries(assignments);
        activeCoursesList.innerHTML = entries.map(([slug, provider], idx) => {
            const provName = provider ? provider.toUpperCase() : 'AUTO';
            const courseColor = idx === 0 ? '#00E676' : '#80d8ff';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 5px; padding: 4px 8px; font-size: 10.5px;">
                    <span style="font-weight: 600; color: #334155; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${slug}">📖 ${slug}</span>
                    <span style="font-weight: 700; color: ${courseColor}; background: rgba(0,0,0,0.05); padding: 1px 6px; border-radius: 4px; font-size: 9.5px;">${provName}</span>
                </div>
            `;
        }).join('');
    }

    function renderQuizSolution(data) {
        if (!quizSolutionContainer) return;

        if (!data || !data.questions || data.questions.length === 0) {
            quizSolutionContainer.innerHTML = `
                <div class="quiz-empty">
                    <div style="font-size: 24px; margin-bottom: 5px;">🧠</div>
                    No quiz solved yet.<br>
                    Open a practice quiz on Coursera to view live AI answers, step-by-step reasoning, and marked choices right here!
                </div>
            `;
            if (quizBadge) quizBadge.classList.remove('active');
            return;
        }

        if (quizBadge) quizBadge.classList.add('active');

        const title = data.quizTitle || 'Coursera Quiz';
        const provider = (data.provider || 'AI').toUpperCase();
        const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '';
        const gradeTag = data.grade ? `<span class="quiz-grade-tag">Grade: ${escapeHtml(data.grade)}</span>` : '';
        const providerTag = `<span class="quiz-provider-tag">${escapeHtml(provider)}</span>`;

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
                            <div style="font-weight: 700; color: #008744; margin-bottom: 2px;">💡 Reasoning:</div>
                            <div>${escapeHtml(q.aiRationale)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        quizSolutionContainer.innerHTML = html;
    }

    // ==========================================
    // TAB 3: VIDEO CONTROLS & SETTINGS
    // ==========================================
    const speedInjectionCB = document.getElementById('speedInjectionCB');
    const speedToggleStatus = document.getElementById('speedToggleStatus');
    const speedInputWrapper = document.getElementById('speedInputWrapper');
    const forceMethodWrapper = document.getElementById('forceMethodWrapper');
    const speedInput = document.getElementById('speedInput');
    const forceMethodSelect = document.getElementById('forceMethodSelect');
    const focusModeSelect = document.getElementById('focusModeSelect');
    const strictCompletionCB = document.getElementById('strictCompletionCB');
    const bgPlayCB = document.getElementById('bgPlayCB');
    const autoNavigateCB = document.getElementById('autoNavigateCB');
    const superBypassVideoBtn = document.getElementById('superBypassVideoBtn');
    const superBypassVideoCB = document.getElementById('superBypassVideoCB');

    const SPEED_MIN = 0.25;
    const SPEED_MAX = 16.0;

    function sanitizeSpeed(val) {
        const num = parseFloat(val);
        if (isNaN(num) || num < SPEED_MIN) return 1.0;
        return Math.min(Math.max(num, SPEED_MIN), SPEED_MAX);
    }

    function updateSpeedInjectionUI(enabled) {
        if (!speedToggleStatus) return;
        if (enabled) {
            speedToggleStatus.innerText = 'ENABLED';
            speedToggleStatus.style.color = '#008744';
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
            speedToggleStatus.style.color = '#ea580c';
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

    function updateSuperBypassUI(enabled) {
        if (superBypassVideoCB) superBypassVideoCB.checked = !!enabled;
        if (superBypassVideoBtn) {
            if (enabled) {
                superBypassVideoBtn.innerText = '⚡ Super Bypass: ON';
                superBypassVideoBtn.style.background = 'linear-gradient(135deg, rgba(255, 152, 0, 0.4) 0%, rgba(255, 87, 34, 0.4) 100%)';
                superBypassVideoBtn.style.border = '1px solid #ff9800';
                superBypassVideoBtn.style.color = '#ea580c';
                superBypassVideoBtn.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.4)';
            } else {
                superBypassVideoBtn.innerText = '⚡ Super Bypass: OFF';
                superBypassVideoBtn.style.background = 'rgba(255, 152, 0, 0.12)';
                superBypassVideoBtn.style.border = '1px solid rgba(255, 152, 0, 0.4)';
                superBypassVideoBtn.style.color = '#ea580c';
                superBypassVideoBtn.style.boxShadow = 'none';
            }
        }
    }

    // Speed input listeners
    function saveSpeed() {
        const clean = sanitizeSpeed(speedInput.value);
        speedInput.value = clean;
        chrome.storage.local.set({ playbackSpeed: clean });
    }
    if (speedInput) {
        speedInput.addEventListener('change', saveSpeed);
        speedInput.addEventListener('blur', saveSpeed);
    }

    // Preset Speed Buttons
    document.querySelectorAll('.speed-preset-btn').forEach(btn => {
        if (!btn.dataset.speed) return;
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed) || 2.0;
            if (speedInput) speedInput.value = speed;
            chrome.storage.local.set({ playbackSpeed: speed, speedInjection: true });
            if (speedInjectionCB) {
                speedInjectionCB.checked = true;
                updateSpeedInjectionUI(true);
            }
        });
    });

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

    if (speedInjectionCB) {
        speedInjectionCB.addEventListener('change', () => {
            const enabled = speedInjectionCB.checked;
            chrome.storage.local.set({ speedInjection: enabled });
            updateSpeedInjectionUI(enabled);
        });
    }

    if (forceMethodSelect) {
        forceMethodSelect.addEventListener('change', () => {
            chrome.storage.local.set({ forceMode: forceMethodSelect.value });
        });
    }

    if (focusModeSelect) {
        focusModeSelect.addEventListener('change', () => {
            chrome.storage.local.set({ focusMode: focusModeSelect.value });
        });
    }

    if (strictCompletionCB) {
        strictCompletionCB.addEventListener('change', () => {
            chrome.storage.local.set({ strictCompletion: strictCompletionCB.checked });
        });
    }

    if (bgPlayCB) bgPlayCB.addEventListener('change', () => chrome.storage.local.set({ bgPlay: bgPlayCB.checked }));
    if (autoNavigateCB) autoNavigateCB.addEventListener('change', () => chrome.storage.local.set({ autoNavigate: autoNavigateCB.checked }));

    if (autoSolveCB) autoSolveCB.addEventListener('change', () => chrome.storage.local.set({ autoSolve: autoSolveCB.checked }));
    if (providerSelect) providerSelect.addEventListener('change', () => chrome.storage.local.set({ preferredProvider: providerSelect.value }));
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
    if (resetCooldownsBtn) {
        resetCooldownsBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'RESET_COOLDOWNS' }, () => {
                cachedStorage.providerCooldowns = {};
                updateProviderChips(cachedStorage);
            });
        });
    }

    if (groqApiKeyInput) groqApiKeyInput.addEventListener('input', () => chrome.storage.local.set({ groqApiKey: groqApiKeyInput.value.trim() }));
    if (geminiApiKeyInput) geminiApiKeyInput.addEventListener('input', () => chrome.storage.local.set({ geminiApiKey: geminiApiKeyInput.value.trim() }));
    if (openRouterApiKeyInput) openRouterApiKeyInput.addEventListener('input', () => chrome.storage.local.set({ openRouterApiKey: openRouterApiKeyInput.value.trim() }));
    if (nvidiaApiKeyInput) nvidiaApiKeyInput.addEventListener('input', () => chrome.storage.local.set({ nvidiaApiKey: nvidiaApiKeyInput.value.trim() }));

    // ==========================================
    // TAB 4 & TAB 5: LOGS & AI LOGS
    // ==========================================
    const logList = document.getElementById('logList');
    const aiLogList = document.getElementById('aiLogList');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const clearAiLogsBtn = document.getElementById('clearAiLogsBtn');
    const exportLogsBtn = document.getElementById('exportLogsBtn');

    let activeAiFilter = 'all';
    let activeLogFilter = 'all';

    document.querySelectorAll('[data-provider-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('[data-provider-filter]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeAiFilter = pill.getAttribute('data-provider-filter');
            renderAiLogs(cachedStorage.activityLogs);
        });
    });

    document.querySelectorAll('[data-log-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('[data-log-filter]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeLogFilter = pill.getAttribute('data-log-filter');
            renderLogs(cachedStorage.activityLogs);
        });
    });

    function isAiRelatedLog(msg) {
        const m = (msg || '').toLowerCase();
        return m.includes('ai') || m.includes('gemini') || m.includes('groq') || 
               m.includes('openrouter') || m.includes('nvidia') || m.includes('prompt') || 
               m.includes('dialogue') || m.includes('quiz') || m.includes('solver') || 
               m.includes('cooldown') || m.includes('model') || m.includes('token');
    }

    function renderAiLogs(logs) {
        if (!aiLogList) return;
        if (!Array.isArray(logs) || logs.length === 0) {
            aiLogList.innerHTML = '<div class="log-empty" style="color: #777; text-align: center; padding: 12px 0;">No AI activity recorded yet.</div>';
            return;
        }

        const aiLogs = logs.filter(item => {
            const text = (item.message || '');
            if (!isAiRelatedLog(text)) return false;
            if (activeAiFilter === 'all') return true;
            return text.toLowerCase().includes(activeAiFilter.toLowerCase());
        });

        if (aiLogs.length === 0) {
            aiLogList.innerHTML = `<div class="log-empty" style="color: #777; text-align: center; padding: 12px 0;">No AI activity for ${activeAiFilter.toUpperCase()} yet.</div>`;
            return;
        }

        aiLogList.innerHTML = aiLogs.map(item => {
            const type = item.type || 'info';
            const time = item.time || '';
            const msg = escapeHtml(item.message || '');
            return `
                <div class="log-item">
                    <span class="log-time">[${escapeHtml(time)}]</span>
                    <span class="log-msg ${type}">${msg}</span>
                </div>
            `;
        }).join('');
    }

    function renderLogs(logs) {
        if (!logList) return;
        if (!Array.isArray(logs) || logs.length === 0) {
            logList.innerHTML = '<div class="log-empty" style="color: #777; text-align: center; padding: 12px 0;">No activity recorded yet.</div>';
            return;
        }

        const filtered = logs.filter(item => {
            if (activeLogFilter === 'all') return true;
            return (item.type || 'info') === activeLogFilter;
        });

        if (filtered.length === 0) {
            logList.innerHTML = `<div class="log-empty" style="color: #777; text-align: center; padding: 12px 0;">No logs matching '${activeLogFilter}'.</div>`;
            return;
        }

        logList.innerHTML = filtered.map(item => {
            const type = item.type || 'info';
            const time = item.time || '';
            const msg = escapeHtml(item.message || '');
            return `
                <div class="log-item">
                    <span class="log-time">[${escapeHtml(time)}]</span>
                    <span class="log-msg ${type}">${msg}</span>
                </div>
            `;
        }).join('');
    }

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            chrome.storage.local.set({ activityLogs: [] }, () => {
                cachedStorage.activityLogs = [];
                renderLogs([]);
                renderAiLogs([]);
            });
        });
    }

    if (clearAiLogsBtn) {
        clearAiLogsBtn.addEventListener('click', () => {
            if (cachedStorage.activityLogs) {
                cachedStorage.activityLogs = cachedStorage.activityLogs.filter(l => !isAiRelatedLog(l.message));
                chrome.storage.local.set({ activityLogs: cachedStorage.activityLogs }, () => {
                    renderAiLogs([]);
                    renderLogs(cachedStorage.activityLogs);
                });
            }
        });
    }

    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', () => {
            const logs = cachedStorage.activityLogs || [];
            const text = logs.map(l => `[${l.time}] [${(l.type || 'info').toUpperCase()}] ${l.message}`).join('\n');
            navigator.clipboard.writeText(text).then(() => {
                exportLogsBtn.innerText = 'Copied!';
                setTimeout(() => exportLogsBtn.innerText = 'Copy', 1800);
            });
        });
    }

    function escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==========================================
    // STORAGE SYNC & LIVE REFRESH
    // ==========================================
    let cachedStorage = {};

    function refreshStorage() {
        chrome.storage.local.get([
            'speedInjection', 'playbackSpeed', 'forceMode', 'preferredProvider', 'secondaryProvider', 'dualCourseMultiAI',
            'activeCourseAssignments', 'focusMode', 'strictCompletion', 'superBypassVideoMode',
            'geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'nvidiaApiKey',
            'autoSolve', 'bgPlay', 'autoNavigate',
            'activityLogs', 'lastGeminiQuizData', 'providerCooldowns', 'bulkApiProgress'
        ], (data) => {
            cachedStorage = data;

            updateSuperBypassUI(!!data.superBypassVideoMode);
            renderBulkProgress(data.bulkApiProgress);

            if (speedInjectionCB) {
                const isSpeedEnabled = data.speedInjection !== undefined ? !!data.speedInjection : true;
                speedInjectionCB.checked = isSpeedEnabled;
                updateSpeedInjectionUI(isSpeedEnabled);
            }

            let currentSpeed = data.playbackSpeed !== undefined ? sanitizeSpeed(data.playbackSpeed) : 2.0;
            if (speedInput) speedInput.value = currentSpeed;

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

            const hasAny = !!(data.geminiApiKey || data.groqApiKey || data.openRouterApiKey || data.nvidiaApiKey);
            if (!hasAny && keysDrawer) {
                keysOpen = true;
                keysDrawer.style.display = 'flex';
                if (keysArrow) keysArrow.innerText = '▲';
            }

            if (autoSolveCB) autoSolveCB.checked = data.autoSolve !== undefined ? data.autoSolve : true;
            if (bgPlayCB) bgPlayCB.checked = data.bgPlay !== undefined ? data.bgPlay : true;
            if (autoNavigateCB) autoNavigateCB.checked = data.autoNavigate !== undefined ? data.autoNavigate : true;

            updateProviderChips(data);
            renderLogs(data.activityLogs);
            renderAiLogs(data.activityLogs);
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

        if (changes.bulkApiProgress !== undefined) {
            renderBulkProgress(changes.bulkApiProgress.newValue);
        }

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
        if (changes.providerCooldowns !== undefined) {
            updateProviderChips(cachedStorage);
        }
        if (changes.activityLogs !== undefined) {
            renderLogs(changes.activityLogs.newValue);
            renderAiLogs(changes.activityLogs.newValue);
        }
        if (changes.lastGeminiQuizData !== undefined) {
            renderQuizSolution(changes.lastGeminiQuizData.newValue);
        }
    });

    // ==========================================
    // GITHUB UPDATE BANNER & 1-CLICK UPDATER
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

        if (isAvailable && remoteSha && (!installedSha || !remoteSha.startsWith(installedSha.slice(0, 7)))) {
            updateBanner.style.display = 'block';
            if (updateCommitSha) updateCommitSha.textContent = remoteSha.slice(0, 7);
            if (updateCommitMsg) {
                const msg = storageData.remoteCommitMsg || 'New code pushed to GitHub repository.';
                updateCommitMsg.textContent = msg;
            }
        } else {
            updateBanner.style.display = 'none';
        }
    }

    chrome.storage.local.get(['updateAvailable', 'remoteCommit', 'remoteCommitMsg', 'installedCommit'], (res) => {
        refreshUpdateUI(res);
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.updateAvailable || changes.remoteCommit || changes.installedCommit) {
            chrome.storage.local.get(['updateAvailable', 'remoteCommit', 'remoteCommitMsg', 'installedCommit'], (res) => {
                refreshUpdateUI(res);
            });
        }
    });

    if (popupOneClickUpdateBtn) {
        popupOneClickUpdateBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('updater.html?action=install') });
        });
    }

    if (checkUpdatesLink) {
        checkUpdatesLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (checkUpdatesMsg) {
                checkUpdatesMsg.style.display = 'block';
                checkUpdatesMsg.textContent = 'Checking GitHub...';
                checkUpdatesMsg.style.color = '#0056D2';
            }

            chrome.runtime.sendMessage({ type: 'CHECK_FOR_UPDATES' }, (response) => {
                if (checkUpdatesMsg) {
                    if (response && response.updateAvailable) {
                        checkUpdatesMsg.textContent = `🚀 New update available (${response.remoteCommit.slice(0, 7)})!`;
                        checkUpdatesMsg.style.color = '#00E676';
                    } else if (response && response.error) {
                        checkUpdatesMsg.textContent = `Check failed: ${response.error}`;
                        checkUpdatesMsg.style.color = '#ff5252';
                    } else {
                        checkUpdatesMsg.textContent = '✓ You have the latest version installed!';
                        checkUpdatesMsg.style.color = '#00E676';
                    }
                    setTimeout(() => {
                        chrome.storage.local.get(['updateAvailable', 'remoteCommit', 'remoteCommitMsg', 'installedCommit'], (res) => {
                            refreshUpdateUI(res);
                        });
                    }, 500);
                }
            });
        });
    }
});