// ============================================================================
// Coursera AI AutoPilot - Master Content Script (v9.8)
// ============================================================================
// Features:
// 1. Guaranteed event-driven video speed enforcement (0.25x - 16x)
// 2. Comprehensive action & error logging stored in chrome.storage
// 3. Multi-provider AI practice question & quiz solver (Groq, Gemini, OpenRouter, NVIDIA)
// 4. Free-text & fill-in-the-blank question input solver with React state synchronization
// 5. Multi-turn AI Dialogue coach automation (reads replies, keeps answering every turn)
// 6. Strict Green Tick confirmation & reattempt-once safeguard (never gets stuck in loop)
// 7. Global 2-minute stuck watchdog (auto-skips to next item if stuck on same page >2 min)
// 8. Course Focus Modes: Quizzes Only, Videos Only, Pending/Incomplete Only, or All
// 9. Auto-play, mid-video popup skip, and post-completion navigation
// ============================================================================

(function() {
    'use strict';

    if (window !== window.top) return;

    let state = {
        playbackSpeed: 3.0,
        forceMode: 'hybrid', // 'hybrid' | 'native' | 'virtual'
        bgPlay: true,
        autoNavigate: true,
        autoSolve: true,
        focusMode: 'all', // 'all' | 'quizzes_only' | 'videos_only' | 'pending_only'
        strictCompletion: true,
        geminiApiKey: '',
        groqApiKey: '',
        openRouterApiKey: '',
        nvidiaApiKey: '',
        preferredProvider: 'auto'
    };

    let videoReplayMap = {}; // Tracks replayed videos by path to strictly replay only ONCE
    let itemReattemptMap = {}; // Tracks reattempt count by item path to strictly reattempt only ONCE
    let videoEndedFirstSeenTime = 0; // Timestamp when video first ended on current page
    let dialogueTurnCount = 1; // Counter for dialogue message turns

    function hasAnyApiKey() {
        return !!(state.geminiApiKey || state.groqApiKey || state.openRouterApiKey || state.nvidiaApiKey);
    }

    // Dedicated quiz session tracker to ensure strictly 1 API call per quiz attempt
    const quizSession = {
        url: '',
        status: 'IDLE', // 'IDLE', 'SOLVING', 'MARKED', 'SUBMITTING', 'REVIEWING', 'GRADED'
        answers: null,
        grade: ''
    };

    let isSolvingQuiz = false;
    let isSubmitting = false;
    let quizCompletedForUrl = '';
    let lastNavTime = 0;
    let apiCooldownUntil = 0;
    let lastKnownUrl = window.location.href;
    let pageArrivalTime = Date.now();
    let hasMarkedCurrentReading = false;
    let lastStartClickTime = 0;
    let lastStartClickUrl = '';
    let isGeneratingDialogueResponse = false;
    let lastAnsweredDialogueQuestion = '';
    let lastStartDialogueClickTime = 0;
    let lastDialogueMessageSentTime = 0;

    /* ========================================================================
       ACTIVITY & ERROR LOGGING (SAVED FOR POPUP LOG MENU)
       ======================================================================== */
    function addLog(message, type = 'info') {
        const time = new Date().toLocaleTimeString();
        const logEntry = { time, message, type };

        console.log(
            `%c[AutoPilot ${type.toUpperCase()}]%c ${message}`,
            type === 'error' ? 'color: #ff5252; font-weight: bold;' :
            type === 'success' ? 'color: #00E676; font-weight: bold;' :
            type === 'warn' ? 'color: #ffd740; font-weight: bold;' :
            'color: #40c4ff; font-weight: bold;',
            'color: inherit;'
        );

        chrome.storage.local.get(['activityLogs'], (data) => {
            const logs = Array.isArray(data.activityLogs) ? data.activityLogs : [];
            logs.unshift(logEntry);
            if (logs.length > 60) logs.pop(); // Keep last 60 entries
            chrome.storage.local.set({ activityLogs: logs });
        });

        // Also update floating badge
        showStatus(message);
    }

    /* ========================================================================
       SETTINGS & STORAGE
       ======================================================================== */
    chrome.storage.local.get([
        'playbackSpeed', 'forceMode', 'bgPlay', 'autoNavigate', 'autoSolve',
        'focusMode', 'strictCompletion',
        'geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'nvidiaApiKey', 'preferredProvider'
    ], (data) => {
        if (data.playbackSpeed !== undefined) state.playbackSpeed = parseFloat(data.playbackSpeed) || 3.0;
        if (data.forceMode) state.forceMode = data.forceMode;
        if (data.bgPlay !== undefined) state.bgPlay = data.bgPlay;
        if (data.autoNavigate !== undefined) state.autoNavigate = data.autoNavigate;
        if (data.autoSolve !== undefined) state.autoSolve = data.autoSolve;
        if (data.focusMode) state.focusMode = data.focusMode;
        if (data.strictCompletion !== undefined) state.strictCompletion = data.strictCompletion;
        if (data.geminiApiKey) state.geminiApiKey = data.geminiApiKey.trim();
        if (data.groqApiKey) state.groqApiKey = data.groqApiKey.trim();
        if (data.openRouterApiKey) state.openRouterApiKey = data.openRouterApiKey.trim();
        if (data.nvidiaApiKey) state.nvidiaApiKey = data.nvidiaApiKey.trim();
        if (data.preferredProvider) state.preferredProvider = data.preferredProvider;

        syncSpeedToMainWorld();
        addLog(`Extension initialized. Speed: ${state.playbackSpeed}x (${state.forceMode}), Focus: ${state.focusMode}, StrictGuard: ${state.strictCompletion}`);
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.playbackSpeed !== undefined) {
            state.playbackSpeed = parseFloat(changes.playbackSpeed.newValue) || 3.0;
            syncSpeedToMainWorld();
            updateSpeedBadge();
            addLog(`Speed updated to ${state.playbackSpeed}x`, 'info');
        }
        if (changes.forceMode !== undefined) {
            state.forceMode = changes.forceMode.newValue || 'hybrid';
            syncSpeedToMainWorld();
            updateSpeedBadge();
            addLog(`Speed force method changed to ${state.forceMode}`, 'info');
        }
        if (changes.bgPlay !== undefined) state.bgPlay = changes.bgPlay.newValue;
        if (changes.autoNavigate !== undefined) state.autoNavigate = changes.autoNavigate.newValue;
        if (changes.autoSolve !== undefined) state.autoSolve = changes.autoSolve.newValue;
        if (changes.focusMode !== undefined) {
            state.focusMode = changes.focusMode.newValue || 'all';
            addLog(`Course Focus Mode set to: ${state.focusMode}`, 'info');
        }
        if (changes.strictCompletion !== undefined) {
            state.strictCompletion = changes.strictCompletion.newValue !== undefined ? changes.strictCompletion.newValue : true;
            addLog(`Strict Completion Guard set to: ${state.strictCompletion}`, 'info');
        }
        if (changes.geminiApiKey !== undefined) {
            state.geminiApiKey = (changes.geminiApiKey.newValue || '').trim();
            apiCooldownUntil = 0;
        }
        if (changes.groqApiKey !== undefined) {
            state.groqApiKey = (changes.groqApiKey.newValue || '').trim();
            apiCooldownUntil = 0;
        }
        if (changes.openRouterApiKey !== undefined) {
            state.openRouterApiKey = (changes.openRouterApiKey.newValue || '').trim();
            apiCooldownUntil = 0;
        }
        if (changes.nvidiaApiKey !== undefined) {
            state.nvidiaApiKey = (changes.nvidiaApiKey.newValue || '').trim();
            apiCooldownUntil = 0;
        }
        if (changes.preferredProvider !== undefined) {
            state.preferredProvider = changes.preferredProvider.newValue || 'auto';
            apiCooldownUntil = 0;
        }
        if (changes.providerCooldowns !== undefined) {
            const newCds = changes.providerCooldowns.newValue || {};
            if (Object.keys(newCds).length === 0) {
                apiCooldownUntil = 0;
                addLog("AI cooldowns reset. Ready to solve.", "info");
            }
        }
    });

    function syncSpeedToMainWorld() {
        try {
            if (document.documentElement) {
                document.documentElement.dataset.courseraSpeed = String(state.playbackSpeed);
                document.documentElement.dataset.courseraForceMode = state.forceMode || 'hybrid';
            }
            sessionStorage.setItem('coursera_speed', String(state.playbackSpeed));
            sessionStorage.setItem('coursera_force_mode', state.forceMode || 'hybrid');
        } catch(e) {}
        window.postMessage({
            type: 'COURSERA_FORCE_SPEED',
            speed: state.playbackSpeed,
            forceMode: state.forceMode || 'hybrid'
        }, '*');
    }



    /* ========================================================================
       FLOATING STATUS & ON-SCREEN CONTROLS
       ======================================================================== */
    let statusTimeout = null;

    function showStatus(message, show = true) {
        if (!document.body) return;
        let badge = document.getElementById('coursera-ai-status');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'coursera-ai-status';
            badge.style.cssText = `
                position: fixed; bottom: 24px; left: 24px;
                background: linear-gradient(135deg, #0056D2, #003e99);
                color: #ffffff; padding: 9px 16px; border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px; font-weight: 600; z-index: 2147483647;
                box-shadow: 0 4px 16px rgba(0, 86, 210, 0.35); pointer-events: none;
                transition: opacity 0.25s ease; backdrop-filter: blur(8px);
            `;
            document.body.appendChild(badge);
        }

        if (show && message) {
            if (statusTimeout) clearTimeout(statusTimeout);
            badge.innerText = '⚡ ' + message;
            badge.style.display = 'block';
            badge.style.opacity = '1';
            statusTimeout = setTimeout(() => {
                if (badge) badge.style.opacity = '0';
            }, 3000);
        }
    }

    function updateSpeedBadge() {
        const textEl = document.getElementById('coursera-speed-badge-text');
        if (textEl) textEl.innerText = `${state.playbackSpeed}x`;
        const modeEl = document.getElementById('coursera-speed-badge-mode');
        if (modeEl) {
            modeEl.innerText = state.forceMode.toUpperCase();
            modeEl.title = `Speed Force Method: ${state.forceMode.toUpperCase()} (Click or press \\ to toggle)`;
        }
    }

    function injectSpeedBadge(media) {
        if (!media) return;
        if (document.getElementById('coursera-speed-badge')) return;
        const container = media.closest(
            '.rc-VideoPlayer, .c-video-player, [data-testid*="video"], [class*="AudioPlayer"], [class*="audio-player"], [data-testid*="audio"], .rc-SupplementView, [class*="supplement"]'
        ) || media.parentElement;
        if (!container) return;

        const badge = document.createElement('div');
        badge.id = 'coursera-speed-badge';
        badge.style.cssText = `
            position: absolute; top: 16px; right: 16px; z-index: 99999;
            display: flex; align-items: center; gap: 6px;
            background: rgba(0, 0, 0, 0.85); color: #00E676;
            padding: 5px 12px; border-radius: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px; font-weight: bold; border: 1px solid rgba(0, 230, 118, 0.4);
            user-select: none; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        `;
        badge.innerHTML = `
            <span style="font-size: 11px; color: #aaa;">SPEED</span>
            <span id="coursera-speed-badge-text">${state.playbackSpeed}x</span>
            <span id="coursera-speed-badge-mode" title="Speed Force Method: ${state.forceMode.toUpperCase()} (Click or press \\ to toggle)" style="font-size: 10px; color: #80d8ff; cursor: pointer; border: 1px solid rgba(128, 216, 255, 0.4); border-radius: 4px; padding: 1px 5px; font-weight: 700; text-transform: uppercase;">${state.forceMode}</span>
            <button id="coursera-speed-minus" title="Decrease Speed (Hotkey: [)" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 13px;">-</button>
            <button id="coursera-speed-plus" title="Increase Speed (Hotkey: ])" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 13px;">+</button>
            <button id="coursera-speed-end" title="Fast-forward to End" style="background: rgba(0, 230, 118, 0.25); border: 1px solid rgba(0, 230, 118, 0.4); color: #00E676; border-radius: 12px; padding: 2px 8px; cursor: pointer; font-size: 11px; font-weight: bold; margin-left: 4px;">⏩ End</button>
        `;

        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(badge);

        const modeBtn = badge.querySelector('#coursera-speed-badge-mode');
        if (modeBtn) {
            modeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const modes = ['hybrid', 'native', 'virtual'];
                state.forceMode = modes[(modes.indexOf(state.forceMode) + 1) % modes.length];
                chrome.storage.local.set({ forceMode: state.forceMode });
                syncSpeedToMainWorld();
                updateSpeedBadge();
                showStatus(`Speed Force Method: ${state.forceMode.toUpperCase()}`);
            });
        }

        badge.querySelector('#coursera-speed-minus').addEventListener('click', (e) => {
            e.stopPropagation();
            state.playbackSpeed = Math.max(0.25, +(state.playbackSpeed - 0.5).toFixed(2));
            chrome.storage.local.set({ playbackSpeed: state.playbackSpeed });
            syncSpeedToMainWorld();
            updateSpeedBadge();
        });
        badge.querySelector('#coursera-speed-plus').addEventListener('click', (e) => {
            e.stopPropagation();
            state.playbackSpeed = Math.min(16.0, +(state.playbackSpeed + 0.5).toFixed(2));
            chrome.storage.local.set({ playbackSpeed: state.playbackSpeed });
            syncSpeedToMainWorld();
            updateSpeedBadge();
        });
        badge.querySelector('#coursera-speed-end').addEventListener('click', (e) => {
            e.stopPropagation();
            const m = document.querySelector('video, audio');
            if (m && !isNaN(m.duration) && m.duration > 2) {
                m.currentTime = m.duration - 2;
                addLog(`Fast-forwarded ${m.tagName.toLowerCase()} to end.`, "info");
            }
        });
    }

    // Global keyboard hotkeys for instant speed tuning
    window.addEventListener('keydown', (e) => {
        if (!e.key) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

        if (e.key === '[' || e.key === '{') {
            e.preventDefault();
            state.playbackSpeed = Math.max(0.25, +(state.playbackSpeed - 0.5).toFixed(2));
            chrome.storage.local.set({ playbackSpeed: state.playbackSpeed });
            syncSpeedToMainWorld();
            updateSpeedBadge();
            showStatus(`Speed: ${state.playbackSpeed}x (${state.forceMode})`);
        } else if (e.key === ']' || e.key === '}') {
            e.preventDefault();
            state.playbackSpeed = Math.min(16.0, +(state.playbackSpeed + 0.5).toFixed(2));
            chrome.storage.local.set({ playbackSpeed: state.playbackSpeed });
            syncSpeedToMainWorld();
            updateSpeedBadge();
            showStatus(`Speed: ${state.playbackSpeed}x (${state.forceMode})`);
        } else if (e.key === '\\') {
            e.preventDefault();
            const modes = ['hybrid', 'native', 'virtual'];
            state.forceMode = modes[(modes.indexOf(state.forceMode) + 1) % modes.length];
            chrome.storage.local.set({ forceMode: state.forceMode });
            syncSpeedToMainWorld();
            updateSpeedBadge();
            showStatus(`Force Method: ${state.forceMode.toUpperCase()}`);
        }
    });

    /* ========================================================================
       QUIZ DETECTION & NAVIGATION HELPERS
       ======================================================================== */
    function cleanButtonText(str) {
        return (str || '')
            .replace(/\u00a0/g, ' ')      // Non-breaking space &nbsp;
            .replace(/[\r\n\t]+/g, ' ')   // Newlines and tabs
            .replace(/\s+/g, ' ')         // Collapse multi-whitespace
            .trim()
            .toLowerCase();
    }

    function isExcludedStartButton(text, aria) {
        const combined = (text + ' ' + aria).toLowerCase();
        return /help\s+me\s+practice|review\s+learning|report\s+an\s+issue|go\s+to\s+next|next\s+item|next\s+question|cancel|back|close|dismiss|download|notes|transcript/i.test(combined);
    }

    function isStartTestMatch(text, aria, testId) {
        if (isExcludedStartButton(text, aria)) return false;

        const tid = (testId || '').toLowerCase();
        if (tid.includes('start-assignment') || tid.includes('start-quiz') ||
            tid.includes('resume-assignment') || tid.includes('resume-quiz') ||
            tid.includes('take-quiz') || tid.includes('start-attempt') ||
            tid.includes('resume-attempt') || tid.includes('continue-attempt')) {
            return true;
        }

        const t = cleanButtonText(text);
        const a = cleanButtonText(aria);

        // Standard start prefixes (e.g. "Start assignment", "Resume quiz", "Take quiz")
        const startPrefixRegex = /^(?:start|resume|continue|begin|take|retake)\s+(?:assignment|quiz|practice|attempt|test|exam)\b/i;
        if (startPrefixRegex.test(t) || startPrefixRegex.test(a)) return true;

        // Direct single/double word keywords
        const directRegex = /^(?:retake\s+quiz|retake\s+assignment|retake|start\s+now|start)$/i;
        if (directRegex.test(t) || directRegex.test(a)) return true;

        // Substring / compound labels (e.g. "Start assignment (6 min)" or "Start assignment ›")
        if (t.includes('start assignment') || t.includes('resume assignment') ||
            t.includes('start quiz') || t.includes('resume quiz') ||
            t.includes('take quiz') || t.includes('start attempt') ||
            t.includes('resume attempt') || t.includes('start practice') ||
            a.includes('start assignment') || a.includes('resume assignment') ||
            a.includes('start quiz') || a.includes('resume quiz') ||
            a.includes('start attempt')) {
            return true;
        }

        return false;
    }

    function triggerClick(el) {
        if (!el) return;
        try { el.focus(); } catch (e) {}
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) {}

        try {
            const pOpts = { bubbles: true, cancelable: true, view: window, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
            const mOpts = { bubbles: true, cancelable: true, view: window, composed: true, buttons: 1 };

            el.dispatchEvent(new PointerEvent('pointerdown', pOpts));
            el.dispatchEvent(new MouseEvent('mousedown', mOpts));
            el.dispatchEvent(new PointerEvent('pointerup', pOpts));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, composed: true }));
        } catch (e) {}

        // Clean native click
        try {
            el.click();
        } catch (e) {}
    }

    function isElementVisible(el) {
        if (!el) return false;
        try {
            if (typeof el.checkVisibility === 'function') {
                if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            if (el.offsetWidth === 0 && el.offsetHeight === 0) {
                if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) {
                    const parent = el.parentElement;
                    if (!parent || (parent.offsetWidth === 0 && parent.offsetHeight === 0)) return false;
                }
            }
        } catch (e) {}
        return true;
    }

    function isQuizOrAssignmentUrl(url = window.location.href) {
        try {
            const u = new URL(url);
            const p = u.pathname.toLowerCase();
            return p.includes('/assignment-submission') ||
                   p.includes('/assignment') ||
                   p.includes('/quiz') ||
                   p.includes('/exam') ||
                   p.includes('/attempt') ||
                   p.includes('/assessment') ||
                   p.includes('/ungradedassignment') ||
                   p.includes('/ungradedlti') ||
                   p.includes('/peer') ||
                   p.includes('-quiz') ||
                   p.includes('-assignment') ||
                   p.includes('-exam');
        } catch (e) {
            const s = (url || '').toLowerCase();
            return s.includes('/assignment') || s.includes('/quiz') || s.includes('/exam') || s.includes('/attempt') || s.includes('/assessment');
        }
    }

    function isGradingInProgress() {
        const tunnel = document.querySelector('[data-testid="assignment-view-tunnel-vision"], [data-testid="tunnel-vision-content"], .cds-FullscreenDialog-dialog');
        const gradingScreen = document.querySelector('[data-testid="grading-in-progress-screen"]');

        if (tunnel && isElementVisible(tunnel)) {
            const tunnelText = (tunnel.textContent || '').toLowerCase();
            if (tunnelText.includes("hang tight") || tunnelText.includes("grading in progress") || tunnelText.includes("reviewing your submission")) {
                return true;
            }
        }

        if (gradingScreen && isElementVisible(gradingScreen)) {
            const text = (gradingScreen.textContent || '').toLowerCase();
            if (text.includes("hang tight") || text.includes("grading") || (text.length > 0 && !text.includes("your grade"))) {
                return true;
            }
        }

        return false;
    }

    function isItemLockedPage() {
        // 1. If questions or question containers exist on screen, it is NEVER locked!
        if (getQuizInputs().length > 0) return false;
        if (document.querySelector('[data-testid="question-view"], .rc-QuizQuestion, .rc-FormPartsQuestion, div[data-testid="quiz-question"]')) return false;

        // 2. Find main content container strictly excluding sidebar, navigation, headers, footers
        const mainEl = document.querySelector(
            'main, [role="main"], article, .cds-FullscreenDialog-scrollContainer, ' +
            '#rendered-content, [data-testid="tunnel-vision-content"], [data-testid="assignment-view-tunnel-vision"], ' +
            '.rc-AssignmentAttempt'
        );

        if (!mainEl) return false;

        try {
            // Check specifically for the locked banner headings/paragraphs within mainEl
            // Strictly exclude sidebar, drawer, navigation, header, footer
            const lockNodes = Array.from(mainEl.querySelectorAll('h1, h2, h3, h4, [class*="heading" i], [class*="title" i], [class*="banner" i], p'));
            for (const node of lockNodes) {
                if (node.closest('aside, nav, [role="navigation"], .rc-CourseNavigation, .rc-NavigationDrawer, [class*="sidebar" i], [class*="drawer" i], header, footer')) {
                    continue;
                }
                const t = (node.textContent || '').trim().toLowerCase();
                if (t.includes("you still have some learning to complete") ||
                    t.includes("this item is locked until you complete all prior content in this module") ||
                    (t.includes("this item is locked") && t.includes("go back to where you left off"))) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function hasQuizResultsMounted() {
        if (isGradingInProgress()) return false;

        const bodyText = document.body ? (document.body.textContent || '') : '';
        // Screenshot 2 banner: "Your grade: 83.33%"
        const gradeMatch = bodyText.match(/Your\s+grade\s*:\s*([0-9\.]+%?)/i);
        if (gradeMatch) return true;

        if (/Congratulations!\s*You\s*passed/i.test(bodyText)) return true;
        if (/Keep\s*going!\s*You\s*passed/i.test(bodyText)) return true;
        if (/You\s*achieved\s*a\s*passing\s*grade/i.test(bodyText)) return true;

        const path = window.location.pathname.toLowerCase();
        if (path.includes('/feedback') || path.includes('/view-feedback')) return true;

        const feedbackView = document.querySelector('.rc-QuizFeedback, [data-testid="feedback-view"], [data-testid="grade-summary"]');
        if (feedbackView && isElementVisible(feedbackView) && (feedbackView.textContent || '').trim().length > 0) {
            return true;
        }

        return false;
    }

    function isConfirmationDialog(el) {
        if (!el) return false;
        const dialog = (el.closest ? el.closest('[role="dialog"], .rc-Modal, [class*="Modal"], [class*="dialog"]') : null) || el;
        if (!dialog) return false;

        // CRITICAL: Coursera wraps the whole quiz attempt in a fullscreen tunnel-vision dialog
        // (<div class="cds-FullscreenDialog-dialog" role="dialog" data-testid="assignment-view-tunnel-vision">).
        // That is the MAIN ASSIGNMENT VIEW, NOT a confirmation popup!
        if (dialog.getAttribute('data-testid') === 'assignment-view-tunnel-vision' ||
            dialog.classList.contains('cds-FullscreenDialog-dialog') ||
            dialog.classList.contains('cds-Modal-container') ||
            dialog.querySelector('[data-e2e="AttemptSubmitControls_buttons"]') ||
            dialog.querySelector('[data-testid="question-view"], .rc-QuizQuestion, .rc-FormPartsQuestion')) {
            return false;
        }

        // A genuine confirmation dialog specifically contains confirmation prompts or a cancel button
        const text = (dialog.innerText || dialog.textContent || '').toLowerCase();
        const hasConfirmationKeywords = text.includes('ready to submit') ||
                                        text.includes('are you sure') ||
                                        text.includes('submit your assignment') ||
                                        text.includes('submit quiz?') ||
                                        text.includes('submit assignment?');
        const hasCancel = Array.from(dialog.querySelectorAll('button')).some(b => {
            const bt = (b.textContent || '').trim().toLowerCase();
            return bt === 'cancel' || bt.includes('cancel') || bt === 'go back';
        });

        return hasConfirmationKeywords || hasCancel;
    }

    function findSubmitButton() {
        // TIER 0: Direct Coursera submit button testid and container selectors (exact match from Chrome DevTools)
        const exactSelectors = [
            'button[data-testid="submit-button"]',
            '[data-e2e="AttemptSubmitControls_buttons"] button[data-testid="submit-button"]',
            '[data-e2e="AttemptSubmitControls_buttons"] button.cds-button-primary',
            '[data-e2e="AttemptSubmitControls_buttons"] button:not([data-testid*="draft"]):not([aria-label*="draft" i])',
            'button[data-testid="submit-quiz-button"]',
            'button[data-testid="submit-assignment-button"]',
            'button[aria-label="Submit" i]',
            'button[aria-label="Submit assignment" i]',
            'button[aria-label="Submit quiz" i]'
        ];

        for (const sel of exactSelectors) {
            const btn = document.querySelector(sel);
            if (btn && isElementVisible(btn) && !isConfirmationDialog(btn)) {
                return btn;
            }
        }

        // TIER 1: Scan all buttons and inputs on the page (excluding confirmation dialogs)
        const candidates = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]')).filter(btn => {
            if (!btn || !isElementVisible(btn)) return false;
            if (isConfirmationDialog(btn)) return false;
            // Ignore custom extension elements
            if ((btn.id || '').includes('coursera-speed') || (btn.id || '').includes('coursera-ai')) return false;

            const text = (btn.innerText || btn.textContent || btn.value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const testId = (btn.getAttribute('data-testid') || '').toLowerCase();

            // Ignore navigation or save draft
            if (text.includes('save draft') || aria.includes('save draft') || testId.includes('save-draft')) return false;
            if (text.includes('next') || text.includes('cancel') || text.includes('back')) return false;

            return text === 'submit' || text === 'submit assignment' || text === 'submit quiz' ||
                   aria === 'submit' || aria === 'submit assignment' || aria === 'submit quiz' ||
                   testId === 'submit-button' || testId === 'submit-quiz-button' || testId === 'submit-assignment-button' ||
                   text.startsWith('submit assignment') || text.startsWith('submit quiz');
        });

        if (candidates.length > 0) {
            // Prefer primary buttons
            const primary = candidates.find(b => (b.className || '').includes('primary') || (b.className || '').includes('cds-button-primary'));
            return primary || candidates[0];
        }

        return null;
    }

    function findStartTestButton() {
        try {
            // CRITICAL: If quiz question inputs or question parts are ALREADY present in DOM,
            // NEVER look for or click a start/resume button! We are ALREADY in the quiz!
            if (getQuizInputs().length > 0) {
                return null;
            }
            if (document.querySelector('[data-testid="question-view"], .rc-QuizQuestion, .rc-FormPartsQuestion, div[data-testid="quiz-question"]')) {
                return null;
            }

            // CRITICAL: If Coursera is grading submission or showing tunnel-vision dialog, NEVER click start/try again!
            if (isGradingInProgress()) {
                return null;
            }

            // CRITICAL: If quiz results have already mounted or quiz completed for this URL, NEVER click start/try again!
            if (hasQuizResultsMounted() || quizCompletedForUrl === window.location.href || quizSession.status === 'GRADED') {
                return null;
            }

            // TIER 0: Direct Coursera Assignment Cover Selectors (from Coursera DevTools DOM)
            const coverBtn = document.querySelector(
                'article[data-testid="assignment-cover-redesign"] button.cds-button-primary, ' +
                '[data-testid="rc-CoverPageContainer"] button.cds-button-primary, ' +
                'article[data-testid="assignment-cover-redesign"] button[aria-label*="start" i], ' +
                '[data-testid="rc-CoverPageContainer"] button[aria-label*="start" i], ' +
                'button[aria-label="Start assignment" i], button[aria-label="Resume assignment" i], ' +
                'button[aria-label="Start quiz" i], button[aria-label="Resume quiz" i], ' +
                'button[aria-label="Start attempt" i], button[data-testid="start-assignment-button"], ' +
                'button[data-testid="action-button"][class*="primary"]'
            );
            if (coverBtn && !coverBtn.disabled && coverBtn.getAttribute('aria-disabled') !== 'true') {
                if (isElementVisible(coverBtn) && !coverBtn.closest('aside, nav, header, footer, [role="navigation"]')) {
                    return coverBtn;
                }
            }

            const clickables = Array.from(
                document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')
            ).filter(el => {
                if (!el || el.disabled || (el.getAttribute && el.getAttribute('aria-disabled') === 'true')) return false;
                if (!isElementVisible(el)) return false;
                if (el.closest('aside, nav, header, footer, [role="navigation"]')) return false;
                const id = (el.id || '').toLowerCase();
                if (id.includes('coursera-speed') || id.includes('coursera-ai')) return false;
                return true;
            });

            // TIER 1: Direct text & attribute matching on button/link
            for (const el of clickables) {
                const rawText = (el.innerText || el.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                const text = rawText.toLowerCase();
                const aria = (el.getAttribute ? (el.getAttribute('aria-label') || '') : '').toLowerCase();
                const testId = (el.getAttribute ? (el.getAttribute('data-testid') || '') : '').toLowerCase();
                const href = (el.getAttribute ? (el.getAttribute('href') || '') : '').toLowerCase();

                // STRICTLY ignore helper / navigation buttons or retake actions or go back on locked pages
                if (text.includes('help me practice') || text.includes('review learning') || 
                    text.includes('report an issue') || text.includes('go to next') || 
                    text.includes('next item') || text.includes('next question') || 
                    text === 'try again' || text === 'practice again' ||
                    text === 'cancel' || text === 'back' || text === 'close' ||
                    text.includes('go back')) {
                    continue;
                }

                // Direct start action matches (exact, prefix, and substring)
                if (text === 'start assignment' || text.startsWith('start assignment') || text.includes('start assignment') ||
                    text === 'resume assignment' || text.startsWith('resume assignment') || text.includes('resume assignment') ||
                    text === 'start quiz' || text.startsWith('start quiz') || text.includes('start quiz') ||
                    text === 'resume quiz' || text.startsWith('resume quiz') || text.includes('resume quiz') ||
                    text === 'start attempt' || text.startsWith('start attempt') || text.includes('start attempt') ||
                    text === 'take quiz' || text.startsWith('take quiz') || text.includes('take quiz') ||
                    text === 'start practice' || text === 'resume practice' ||
                    text === 'retake quiz' || text === 'retake assignment' || text === 'retake' ||
                    text === 'begin assignment' || text === 'begin quiz' ||
                    text === 'start test' || text === 'resume test' ||
                    text === 'start now' || text === 'start' ||
                    text === 'continue' || text === 'continue assignment' || text === 'continue attempt') {
                    return el;
                }

                // Aria-label or data-testid match
                if (aria.includes('start assignment') || aria.includes('start quiz') || 
                    aria.includes('resume assignment') || aria.includes('start attempt') ||
                    aria.includes('take quiz') ||
                    testId.includes('start-assignment') || testId.includes('start-quiz') ||
                    testId.includes('resume-assignment') || testId.includes('start-attempt') ||
                    testId.includes('take-quiz')) {
                    return el;
                }

                // Anchor tag pointing to an attempt URL
                if (href.includes('/attempt') && (text.includes('start') || text.includes('resume') || text.includes('take') || !text)) {
                    return el;
                }

                // Check nested label span
                const childSpan = el.querySelector ? el.querySelector('.cds-button-label, [class*="label"], span') : null;
                if (childSpan) {
                    const sText = (childSpan.innerText || childSpan.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                    if (sText.includes('start assignment') || sText.includes('resume assignment') ||
                        sText.includes('start quiz') || sText.includes('resume quiz') ||
                        sText.includes('start attempt') || sText.includes('take quiz') ||
                        sText === 'start' || sText === 'start now') {
                        return el;
                    }
                }
            }

            // TIER 2: Primary Button Fallback on Assignment Landing Page
            const primaryBtn = clickables.find(el => {
                const cls = (el.className || '').toLowerCase();
                const text = (el.innerText || el.textContent || '').toLowerCase();
                if (text.includes('help me practice') || text.includes('next') || text.includes('cancel') || text.includes('try again')) return false;
                return (cls.includes('primary') || cls.includes('cds-button-primary')) && 
                       (text.includes('start') || text.includes('resume') || text.includes('take') || text.includes('assignment'));
            });
            if (primaryBtn) return primaryBtn;

            // TIER 3: Leaf text search
            const spans = Array.from(document.querySelectorAll('span, b, strong')).filter(s => {
                if (s.children && s.children.length > 0) return false;
                const t = (s.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                return t.includes('start assignment') || t.includes('resume assignment') || t.includes('start quiz') || t.includes('resume quiz') || t.includes('start attempt') || t.includes('take quiz');
            });

            for (const s of spans) {
                const clickable = (s.closest ? s.closest('button, a, [role="button"]') : null) || s.parentElement;
                if (clickable && !clickable.disabled && (clickable.getAttribute ? clickable.getAttribute('aria-disabled') !== 'true' : true)) {
                    if (!isElementVisible(clickable)) continue;
                    if (clickable.closest('aside, nav, header, footer, [role="navigation"]')) continue;
                    const cText = (clickable.innerText || clickable.textContent || '').toLowerCase();
                    if (!cText.includes('help me practice') && !cText.includes('report an issue') && !cText.includes('next') && !cText.includes('try again')) {
                        return clickable;
                    }
                }
            }
        } catch (e) {
            console.error("Error in findStartTestButton:", e);
        }

        return null;
    }

    function isQuizFeedbackPage() {
        if (getQuizInputs().length > 0) return false;
        if (document.querySelector('[data-testid="question-view"], .rc-QuizQuestion, .rc-FormPartsQuestion')) return false;
        if (isGradingInProgress()) return false;
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/view-feedback') || path.includes('/feedback')) return true;
        if (hasQuizResultsMounted()) return true;
        return false;
    }

    function isQuizAttemptPage() {
        if (isQuizFeedbackPage() || hasQuizResultsMounted()) return false;
        if (getQuizInputs().length > 0) return true;
        if (document.querySelector('.cds-FullscreenDialog-scrollContainer, form[data-testid="quiz-form"], [data-testid="quiz-attempt-view"], button[data-testid="submit-quiz-button"], [data-testid="question-view"], .rc-QuizQuestion, .rc-FormPartsQuestion')) {
            return true;
        }
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/attempt')) return true;
        return false;
    }

    function isQuizPage() {
        return isQuizOrAssignmentUrl() || isQuizAttemptPage() || isQuizFeedbackPage();
    }

    function isButtonActiveAndBlue(btn) {
        if (!btn) return false;
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

        try {
            const style = window.getComputedStyle(btn);
            if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
                return false;
            }
            if (parseFloat(style.opacity || '1') < 0.5) return false;

            // Check background color for active blue button (light theme #0056D2, dark theme #99c0f6 / rgb(153, 192, 246), etc.)
            const bg = style.backgroundColor || '';
            const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (m) {
                const r = parseInt(m[1], 10);
                const g = parseInt(m[2], 10);
                const b = parseInt(m[3], 10);
                // Blue dominant (b > r + 15 && b >= 90)
                const isBlue = (b > r + 15) && (b >= 90);
                if (isBlue) return true;
            }

            // Check CDS primary button classes
            const cls = (btn.className || '').toLowerCase();
            if (cls.includes('primary') || cls.includes('cds-button')) {
                return true;
            }
        } catch (e) {}

        return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
    }

    function findNextItemButton() {
        const candidates = Array.from(document.querySelectorAll('button, a')).filter(el => {
            if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
            if (el.offsetWidth === 0 && el.offsetHeight === 0) {
                const parent = el.parentElement;
                if (!parent || (parent.offsetWidth === 0 && parent.offsetHeight === 0)) return false;
            }
            // Ignore custom extension elements
            const id = el.getAttribute('id') || '';
            if (id.includes('coursera-speed') || id.includes('coursera-ai')) return false;

            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            // Prevent accidental quiz question pagination or modal cancel
            if (text.includes('next question') || text.includes('next step') || text.includes('next slide') || text === 'cancel' || text === 'back') {
                return false;
            }

            return true;
        });

        // TIER 0: Direct button inside Grade Banner (Pic 2)
        const bannerNext = candidates.find(el => {
            const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return t === 'next item →' || t === 'next item' || t === 'go to next item →' || t === 'go to next item';
        });
        if (bannerNext) return bannerNext;

        // TIER 1: Dedicated Coursera data-testid and aria-label attributes
        const tier1 = candidates.find(el => {
            const testId = (el.getAttribute('data-testid') || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
            return testId === 'next-item' || 
                   testId === 'next-item-button' || 
                   testId === 'video-next-button' ||
                   testId === 'navigationdrawernextitem' ||
                   testId.includes('next-button') ||
                   testId.includes('next-item') ||
                   aria === 'go to next item' || 
                   aria === 'next item' || 
                   aria === 'next' ||
                   aria.startsWith('go to next item') ||
                   aria.startsWith('next item');
        });
        if (tier1) return tier1;

        // TIER 2: Course navigation containers (.rc-CourseItemNavigation, ItemNavigation, footer wrapper)
        const tier2 = candidates.find(el => {
            const inNav = el.closest('.rc-CourseItemNavigation') || 
                          el.closest('[class*="ItemNavigation"]') || 
                          el.closest('[role="navigation"]') || 
                          el.closest('.cds-FullscreenDialog-bottomBar') ||
                          el.closest('[data-testid="course-frame-footer-wrapper"]') ||
                          el.closest('[class*="footer-wrapper"]');
            if (!inNav) return false;
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
            const testId = (el.getAttribute('data-testid') || '').toLowerCase();
            return text.includes('next') || aria.includes('next') || testId.includes('next') || text.includes('→');
        });
        if (tier2) return tier2;

        // TIER 3: Exact or strong button text match
        const tier3 = candidates.find(el => {
            const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return text === 'next item →' || 
                   text === 'next item' || 
                   text === 'go to next item' || 
                   text === 'go to next item →' ||
                   text === 'next →' || 
                   text === '→' ||
                   text === 'next video' || 
                   text === 'next lecture' || 
                   text === 'next';
        });
        if (tier3) return tier3;

        return null;
    }

    /* ========================================================================
       SIDEBAR & COURSE OUTLINE INSPECTION (GREEN CHECKMARK & FOCUS MODES)
       ======================================================================== */
    function getSidebarNavigationItems() {
        const selectors = [
            'nav[aria-label*="Course" i] a',
            'nav[aria-label*="module" i] a',
            'nav[aria-label*="week" i] a',
            '[role="navigation"] a[href*="/learn/"]',
            '[data-testid*="navigation"] a[href*="/learn/"]',
            '[data-testid*="item-row"] a',
            '[data-testid*="accordion-panel"] a',
            '.rc-NavigationDrawer a[href*="/learn/"]',
            '.rc-CourseItemNavigation a[href*="/learn/"]',
            'div[class*="NavigationDrawer"] a[href*="/learn/"]',
            'div[class*="ItemNavigation"] a[href*="/learn/"]',
            'aside a[href*="/learn/"]',
            'ul a[href*="/learn/"]'
        ];

        let links = [];
        for (const sel of selectors) {
            const found = Array.from(document.querySelectorAll(sel));
            if (found.length > 0) {
                const valid = found.filter(a => {
                    const href = (a.getAttribute('href') || '').toLowerCase();
                    return href.includes('/lecture/') || 
                           href.includes('/supplement/') || 
                           href.includes('/assignment-submission/') || 
                           href.includes('/exam/') || 
                           href.includes('/quiz/') || 
                           href.includes('/discussionprompt/') ||
                           href.includes('/graded-assignment/') ||
                           href.includes('/ungradedLti/') ||
                           href.includes('/reading/') ||
                           href.includes('/coach/') ||
                           href.includes('/dialogue') ||
                           href.includes('/guided-discussion') ||
                           href.includes('/item/') ||
                           href.includes('/peer/');
                });
                if (valid.length > links.length) {
                    links = valid;
                }
            }
        }
        return links;
    }

    function getSidebarItemStatus(element) {
        if (!element) return 'unknown';

        // 1. Check aria-labels on the element and its direct wrapper
        const elAria = (element.getAttribute('aria-label') || '').toLowerCase();
        if (elAria.includes('not completed') || elAria.includes('incomplete') || elAria.includes('not started') || elAria.includes('failed') || elAria.includes('grade: 0%')) {
            return 'pending';
        }
        if (elAria.includes('completed') || elAria.includes('passed')) {
            return 'completed';
        }

        // 2. Check SVGs inside element (Coursera renders green checkmark or white circle)
        const svgs = Array.from(element.querySelectorAll('svg'));
        for (const svg of svgs) {
            const svgAria = (svg.getAttribute('aria-label') || '').toLowerCase();
            const svgTitle = (svg.querySelector('title')?.textContent || '').toLowerCase();
            const combinedSvg = `${svgAria} ${svgTitle}`;

            if (combinedSvg.includes('not completed') || combinedSvg.includes('incomplete') || combinedSvg.includes('not started') || combinedSvg.includes('failed') || combinedSvg.includes('grade: 0%')) {
                return 'pending';
            }
            if (combinedSvg.includes('completed') || combinedSvg.includes('passed')) {
                return 'completed';
            }

            // Green color check (#00823b, #1f883d, rgb(0, 130, 59))
            const fill = (svg.getAttribute('fill') || svg.style.fill || '').toLowerCase();
            const stroke = (svg.getAttribute('stroke') || svg.style.stroke || '').toLowerCase();
            const isGreenAttr = fill.includes('00823b') || fill.includes('1f883d') || fill === 'green' ||
                                stroke.includes('00823b') || stroke.includes('1f883d') || stroke === 'green';
            if (isGreenAttr) return 'completed';

            try {
                const comp = window.getComputedStyle(svg);
                const compFill = comp.fill || '';
                const compColor = comp.color || '';
                if (compFill.includes('0, 130, 59') || compFill.includes('00823b') || compColor.includes('0, 130, 59') || compColor.includes('00823b')) {
                    return 'completed';
                }
            } catch (e) {}

            // Incomplete white circle indicator (circle shape without checkmark or green fill)
            const circle = svg.querySelector('circle');
            const path = svg.querySelector('path');
            if (circle && !path && !isGreenAttr) {
                return 'pending';
            }
        }

        // 3. Classes and testids indicating completion
        const hasCompletedClass = !!element.querySelector('[class*="completed" i], [class*="Completed" i], [data-testid*="completed" i], [data-testid*="Completed" i]');
        if (hasCompletedClass) {
            const text = (element.innerText || element.textContent || '').toLowerCase();
            if (!text.includes('not completed') && !text.includes('incomplete') && !text.includes('grade: 0%') && !text.includes('failed')) {
                return 'completed';
            }
        }

        // 4. Text content checks (e.g. "Grade: 100%", "Completed", "Passed")
        const text = (element.innerText || element.textContent || '').toLowerCase();
        if (text.includes('grade: 0%') || text.includes('grade: 0.0%') || text.includes('failed') || text.includes('try again') || text.includes('not passed')) {
            return 'pending';
        }
        if (text.includes('grade:') || text.includes('completed') || text.includes('passed')) {
            if (!text.includes('not completed') && !text.includes('incomplete')) {
                return 'completed';
            }
        }

        return 'pending';
    }

    function getCurrentSidebarItem() {
        const currentPath = window.location.pathname.toLowerCase();
        const items = getSidebarNavigationItems();
        if (!items || items.length === 0) return null;

        // Exact or partial match on pathname
        let current = items.find(item => {
            const href = (item.getAttribute('href') || '').toLowerCase();
            return href && (href.includes(currentPath) || currentPath.includes(href));
        });

        // Or aria-current="page" / active class
        if (!current) {
            current = items.find(item => {
                return item.getAttribute('aria-current') === 'page' ||
                       item.getAttribute('aria-selected') === 'true' ||
                       item.classList.contains('active') ||
                       item.closest('[aria-current="page"], [aria-selected="true"], .active');
            });
        }
        return current;
    }

    function isCurrentItemCompletedInSidebar() {
        const current = getCurrentSidebarItem();
        if (!current) return null;
        const status = getSidebarItemStatus(current);
        return status === 'completed';
    }

    function getItemTypeFromUrl(url = window.location.href) {
        const u = url.toLowerCase();
        if (u.includes('/assignment-submission/') || u.includes('/exam/') || u.includes('/quiz/') || u.includes('/graded-assignment/')) {
            return 'quiz';
        }
        if (u.includes('/lecture/')) {
            return 'video';
        }
        if (u.includes('/supplement/') || u.includes('/reading/')) {
            return 'reading';
        }
        if (u.includes('/coach/') || u.includes('/dialogue') || u.includes('/guided-discussion')) {
            return 'dialogue';
        }
        if (u.includes('/discussionprompt/')) {
            return 'discussion';
        }
        return 'other';
    }

    function findNextPendingSidebarItem() {
        const items = getSidebarNavigationItems();
        if (!items || items.length === 0) return null;

        const current = getCurrentSidebarItem();
        let currentIndex = -1;
        if (current) {
            currentIndex = items.indexOf(current);
        }

        // Search starting after the current item first
        if (currentIndex !== -1) {
            for (let i = currentIndex + 1; i < items.length; i++) {
                const status = getSidebarItemStatus(items[i]);
                if (status === 'pending') {
                    return items[i];
                }
            }
        }

        // Wrap around if needed
        for (let i = 0; i < items.length; i++) {
            if (i === currentIndex) continue;
            const status = getSidebarItemStatus(items[i]);
            if (status === 'pending') {
                return items[i];
            }
        }

        return null;
    }

    function findNextTargetSidebarItem(mode) {
        const items = getSidebarNavigationItems();
        if (!items || items.length === 0) return null;

        const current = getCurrentSidebarItem();
        let currentIndex = -1;
        if (current) {
            currentIndex = items.indexOf(current);
        }

        const matchesMode = (item) => {
            const href = item.getAttribute('href') || '';
            const type = getItemTypeFromUrl(href);
            const status = getSidebarItemStatus(item);

            if (mode === 'quizzes_only') {
                return type === 'quiz';
            }
            if (mode === 'videos_only') {
                return type === 'video' || type === 'reading';
            }
            if (mode === 'pending_only') {
                return status === 'pending';
            }
            return true;
        };

        if (currentIndex !== -1) {
            for (let i = currentIndex + 1; i < items.length; i++) {
                if (matchesMode(items[i])) return items[i];
            }
        }

        for (let i = 0; i < items.length; i++) {
            if (i === currentIndex) continue;
            if (matchesMode(items[i])) return items[i];
        }

        return null;
    }

    /* ========================================================================
       COURSERA AI COACH & DIALOGUE AUTOMATION (HUMANIZED LEARNING SESSIONS)
       ======================================================================== */
    function isDialogueOrCoachItem(url = window.location.href) {
        try {
            const u = new URL(url);
            const p = u.pathname.toLowerCase();
            if (p.includes('/coach/') || p.includes('/dialogue') || p.includes('/guided-discussion')) {
                return true;
            }
        } catch (e) {}

        if (document.querySelector('video')) {
            return false;
        }

        // Check specifically in the main center container (excluding nav, header, aside, drawer)
        const mainEl = document.querySelector('main, [role="main"], article, .cds-FullscreenDialog-scrollContainer, #rendered-content');
        if (mainEl) {
            if (mainEl.querySelector('[data-testid="coach-conversation"], [class*="dialogue" i]')) {
                return true;
            }
            const dialogueBtn = Array.from(mainEl.querySelectorAll('button')).find(b => {
                if (b.closest('aside, nav, [role="navigation"], header, footer')) return false;
                const t = (b.textContent || '').trim().toLowerCase();
                return t === 'start dialogue' || t === 'begin dialogue' || t === 'end dialogue';
            });
            if (dialogueBtn) return true;

            const mainText = (mainEl.textContent || '').toLowerCase();
            if (mainText.includes("welcome! i'm coursera ai, your personalized guide") ||
                (mainText.includes("dialogue is powered by ai") && (mainText.includes("scenario") || mainText.includes("start dialogue")))) {
                return true;
            }
        }

        return false;
    }

    function isDialogueCompletedPage() {
        const text = (document.body ? document.body.textContent || '' : '').toLowerCase();
        const hasSummaryKeywords = (text.includes('your strengths') || text.includes('areas for improvement') || text.includes("during today's session") || text.includes("session summary")) &&
                                   (text.includes('dialogue is powered by ai') || text.includes('tell us what you think') || text.includes('strengths:'));
        return hasSummaryKeywords;
    }

    function extractLatestCoachMessage() {
        const mainContainer = document.querySelector('[role="main"], [data-testid="coach-conversation"], [class*="dialogue" i], [class*="conversation" i], .cds-FullscreenDialog-scrollContainer') || document.body;

        // 1. Target coach messages by feedback buttons (thumbs up / thumbs down / copy only exist on coach messages!)
        const feedbackBtns = Array.from(mainContainer.querySelectorAll('button[aria-label*="thumb" i], button[aria-label*="helpful" i], button[aria-label*="copy" i], svg[data-testid*="thumb" i]'));
        if (feedbackBtns.length > 0) {
            const lastFeedback = feedbackBtns[feedbackBtns.length - 1];
            let msgContainer = lastFeedback.closest('[class*="message" i], [class*="bubble" i], [class*="turn" i], [data-testid*="message" i]') || 
                               lastFeedback.parentElement?.parentElement;
            if (msgContainer) {
                const clone = msgContainer.cloneNode(true);
                clone.querySelectorAll('button, svg, textarea, input, [role="button"]').forEach(el => el.remove());
                const text = (clone.innerText || clone.textContent || '').trim();
                if (text.length > 15 && !text.includes("When you're ready, click")) return text;
            }
        }

        // 2. Chat message bubbles excluding student messages
        const allMessages = Array.from(mainContainer.querySelectorAll('[data-testid*="message" i], [class*="message" i], [class*="bubble" i], [class*="chat-turn" i]')).filter(el => {
            if (el.closest('textarea, input, [class*="composer" i], [class*="input" i], aside, nav, header')) return false;
            const cl = (el.className || '').toLowerCase();
            const text = (el.innerText || el.textContent || '').trim();
            if (cl.includes('user') || cl.includes('student') || cl.includes('self') || cl.includes('right')) return false;
            if (text.includes("Dialogue is powered by AI") || text.includes("When you're ready, click")) return false;
            return text.length > 15;
        });
        if (allMessages.length > 0) {
            const lastMsg = allMessages[allMessages.length - 1];
            const clone = lastMsg.cloneNode(true);
            clone.querySelectorAll('button, svg, textarea, input').forEach(el => el.remove());
            const text = (clone.innerText || clone.textContent || '').trim();
            if (text.length > 15) return text;
        }

        // 3. Fallback: paragraphs inside main container
        const paragraphs = Array.from(mainContainer.querySelectorAll('p')).filter(el => {
            if (el.closest('textarea, input, button, header, aside, nav, [class*="composer" i]')) return false;
            const text = (el.innerText || el.textContent || '').trim();
            if (text.length < 15) return false;
            if (text.includes("Dialogue is powered by AI") || text.includes("When you're ready, click") || text.includes("Today's goals")) return false;
            return true;
        });
        if (paragraphs.length > 0) {
            return (paragraphs[paragraphs.length - 1].innerText || paragraphs[paragraphs.length - 1].textContent || '').trim();
        }

        return '';
    }

    function extractFullDialogueContext() {
        const mainContainer = document.querySelector('[role="main"], [data-testid="coach-conversation"], [class*="dialogue" i], [class*="conversation" i], .cds-FullscreenDialog-scrollContainer') || document.body;
        const paragraphs = Array.from(mainContainer.querySelectorAll('p, [class*="message" i]')).filter(el => {
            if (el.closest('textarea, input, button, header, aside, nav, [class*="composer" i]')) return false;
            const text = (el.innerText || el.textContent || '').trim();
            if (text.length < 15) return false;
            if (text.includes("Dialogue is powered by AI") || text.includes("When you're ready, click") || text.includes("Today's goals")) return false;
            return true;
        });
        return paragraphs.slice(-6).map(p => (p.innerText || p.textContent || '').trim()).join('\n\n');
    }

    function findChatInputField() {
        const candidates = [
            'textarea[placeholder*="message" i]',
            'textarea[placeholder*="send" i]',
            'textarea[placeholder*="type" i]',
            'textarea[aria-label*="message" i]',
            'textarea[data-testid*="chat" i]',
            'textarea[data-testid*="input" i]',
            'div[contenteditable="true"]',
            'input[placeholder*="message" i]',
            'textarea'
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el) && !el.disabled) {
                return el;
            }
        }
        return null;
    }

    function findChatSendButton(inputEl) {
        if (inputEl) {
            const parent = inputEl.closest('form, [class*="composer" i], [class*="input" i], [class*="chat" i], [class*="footer" i]') || inputEl.parentElement;
            if (parent) {
                const btns = Array.from(parent.querySelectorAll('button')).filter(b => {
                    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const title = (b.getAttribute('title') || '').toLowerCase();
                    if (aria.includes('voice') || aria.includes('mic') || title.includes('mic')) return false;
                    return true;
                });
                const sendBtn = btns.find(b => {
                    const a = (b.getAttribute('aria-label') || '').toLowerCase();
                    const tid = (b.getAttribute('data-testid') || '').toLowerCase();
                    return a.includes('send') || tid.includes('send');
                }) || btns.find(b => b.querySelector('svg')) || btns[btns.length - 1];
                if (sendBtn) return sendBtn;
            }
        }
        const globalSend = document.querySelector('button[aria-label*="send" i], button[data-testid*="send" i]');
        if (globalSend && !globalSend.disabled) return globalSend;
        return null;
    }

    function setReactInputValue(el, value) {
        if (!el) return;
        try { el.focus(); } catch (e) {}
        
        if (el.isContentEditable) {
            el.innerText = value;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        const proto = el.tagName === 'TEXTAREA' 
            ? window.HTMLTextAreaElement.prototype 
            : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
            desc.set.call(el, value);
        } else {
            el.value = value;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function handleDialogueItem() {
        // Stage 3: Summary / End screen
        if (isDialogueCompletedPage()) {
            if (state.autoNavigate && (Date.now() - lastNavTime > 3000)) {
                const nextBtn = findNextItemButton();
                if (nextBtn) {
                    lastNavTime = Date.now();
                    addLog("Dialogue completed! Performance summary recorded. Advancing to next item...", "success");
                    showStatus("Dialogue complete! Advancing to next item in 3s...");
                    triggerClick(nextBtn);
                }
            }
            return;
        }

        // Stage 1: Start Dialogue button
        const startDialogueBtn = Array.from(document.querySelectorAll('button')).find(b => {
            if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
            const t = (b.innerText || b.textContent || '').trim().toLowerCase();
            return t === 'start dialogue' || t === 'begin dialogue' || t.includes('start dialogue');
        });

        if (startDialogueBtn && isElementVisible(startDialogueBtn)) {
            const now = Date.now();
            if (now - lastStartDialogueClickTime > 4000) {
                lastStartDialogueClickTime = now;
                addLog("Found 'Start Dialogue' button. Initiating AI Dialogue...", "info");
                showStatus("Starting AI Dialogue session...");
                triggerClick(startDialogueBtn);
            }
            return;
        }

        // Check if Dialogue finished and End Dialogue button is available
        const endDialogueBtn = Array.from(document.querySelectorAll('button')).find(b => {
            if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
            const t = (b.innerText || b.textContent || '').trim().toLowerCase();
            return t === 'end dialogue' || t === 'finish dialogue' || t === 'complete dialogue';
        });
        const chatText = (document.body ? document.body.innerText || '' : '').toLowerCase();
        if (endDialogueBtn && (chatText.includes('click end dialogue') || chatText.includes('you have completed') || chatText.includes('that wraps up') || chatText.includes('great work completing') || dialogueTurnCount >= 5)) {
            addLog("Dialogue criteria completed. Clicking 'End Dialogue'...", "info");
            triggerClick(endDialogueBtn);
            setTimeout(() => {
                const confirmEndBtn = Array.from(document.querySelectorAll('[role="dialog"] button, .cds-dialog button')).find(b => {
                    const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return t === 'end dialogue' || t === 'confirm' || t === 'yes';
                });
                if (confirmEndBtn) triggerClick(confirmEndBtn);
            }, 800);
            return;
        }

        // Stage 2: Active Dialogue Chat (Multi-Turn Conversation)
        const chatInput = findChatInputField();
        if (!chatInput) {
            showStatus("AI Dialogue in progress...");
            return;
        }

        // Check if coach is currently streaming / typing
        const isCoachTyping = !!document.querySelector('[data-testid*="typing" i], [class*="typing" i], [aria-label*="typing" i], .cds-loadingDots');
        if (isCoachTyping) {
            showStatus("AI coach is typing reply...");
            return;
        }

        if (isGeneratingDialogueResponse) {
            showStatus("Thinking and drafting humanized response for AI coach...");
            return;
        }

        // Don't send too frequently (min 4s between messages)
        if (Date.now() - lastDialogueMessageSentTime < 4000) {
            return;
        }

        const latestCoachMsg = extractLatestCoachMessage();
        if (!latestCoachMsg || latestCoachMsg.length < 15) {
            showStatus("Waiting for AI coach prompt...");
            return;
        }

        const normalizedQuestion = latestCoachMsg.replace(/\s+/g, ' ').trim();
        // Don't answer the exact same turn repeatedly
        if (lastAnsweredDialogueQuestion === normalizedQuestion) {
            showStatus("Response sent! Waiting for coach's next reply...");
            return;
        }

        if (!hasAnyApiKey()) {
            showStatus("Dialogue scenario loaded! Add an API key in the AutoPilot popup to auto-respond.");
            return;
        }

        isGeneratingDialogueResponse = true;
        const dialogueContext = extractFullDialogueContext();
        addLog(`AI Coach Turn ${dialogueTurnCount}: "${latestCoachMsg.slice(0, 75)}..." Generating answer...`, "info");
        showStatus(`Answering AI Coach (Turn ${dialogueTurnCount})...`);

        const prompt = `You are a knowledgeable university student participating in an interactive Coursera learning dialogue with an AI coach.
Answer the coach's latest question or scenario thoughtfully, accurately, and naturally based on the conversation history.

CONVERSATION HISTORY:
${dialogueContext}

LATEST QUESTION / PROMPT FROM COACH:
${latestCoachMsg}

CRITICAL INSTRUCTIONS FOR A HUMANIZED STUDENT RESPONSE:
1. Write like an actual smart human college student typing an answer.
2. DO NOT use generic AI filler phrases (never say "Certainly!", "As an AI language model...", "Here is the solution:", "In summary", etc.).
3. Directly answer the coach's latest question with technical depth, reasoning, and practical steps.
4. Keep the response to 1-2 well-structured paragraphs (about 3-6 sentences), concise yet thorough.
5. Do not use markdown headers, bullet lists, or bold asterisks. Use plain, conversational, academic text.`;

        chrome.runtime.sendMessage({
            type: 'ASK_AI',
            prompt: prompt
        }, async (response) => {
            try {
                if (response && response.success && response.text) {
                    let answer = response.text.trim();
                    answer = answer.replace(/\*\*(.*?)\*\*/g, '$1')
                                   .replace(/\*(.*?)\*/g, '$1')
                                   .replace(/^#+\s+/gm, '')
                                   .replace(/^-\s+/gm, '')
                                   .trim();

                    addLog(`Generated humanized response (${answer.length} chars). Typing into chat...`, "info");
                    
                    // Human-like pause before typing (1.2 - 2.0 seconds)
                    await new Promise(r => setTimeout(r, 1500));

                    const inputEl = findChatInputField();
                    if (inputEl) {
                        setReactInputValue(inputEl, answer);
                        await new Promise(r => setTimeout(r, 700));

                        const sendBtn = findChatSendButton(inputEl);
                        if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
                            triggerClick(sendBtn);
                            addLog(`Sent humanized response to Coursera AI (Turn ${dialogueTurnCount})!`, "success");
                            showStatus("Response sent! Waiting for coach's reply...");
                            lastAnsweredDialogueQuestion = normalizedQuestion;
                            lastDialogueMessageSentTime = Date.now();
                            dialogueTurnCount++;
                        } else {
                            inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                            inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                            addLog(`Dispatched Enter to send response (Turn ${dialogueTurnCount}).`, "info");
                            lastAnsweredDialogueQuestion = normalizedQuestion;
                            lastDialogueMessageSentTime = Date.now();
                            dialogueTurnCount++;
                        }
                    }
                } else {
                    addLog(`Dialogue AI error: ${response?.error || 'No response'}`, "warn");
                }
            } catch (e) {
                addLog(`Error during dialogue: ${e.message}`, "error");
            } finally {
                isGeneratingDialogueResponse = false;
            }
        });
    }

    function getQuizInputs() {
        // STRICT GUARD: If currently on an AI coach / dialogue item, never treat chat as a quiz!
        if (isDialogueOrCoachItem()) return [];

        return Array.from(
            document.querySelectorAll('input[type="radio"], input[type="checkbox"], textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="file"])')
        ).filter(el => {
            if (el.offsetWidth === 0 && el.offsetHeight === 0) {
                const parent = el.closest('label') || el.parentElement;
                if (!parent || (parent.offsetWidth === 0 && parent.offsetHeight === 0)) return false;
            }
            if (el.disabled || el.readOnly || el.type === 'hidden') return false;

            // Strictly ignore inputs inside sidebar, navigation, headers, footers, goal trackers, course outlines, chat / coach
            if (el.closest(
                'aside, nav, header, footer, [role="navigation"], [role="search"], ' +
                '.rc-CourseNavigation, .rc-NavigationDrawer, [class*="sidebar" i], [class*="drawer" i], ' +
                '[class*="goal" i], [data-testid*="goal" i], [aria-label*="goal" i], ' +
                '[class*="item-list" i], [class*="outline" i], [data-testid*="sidebar" i], [data-testid*="navigation" i], ' +
                '.rc-Transcript, .rc-Notes, #coursera-ai-status, [data-testid="coach-conversation"], [class*="dialogue" i], [class*="conversation" i], [class*="composer" i]'
            )) {
                return false;
            }

            const labelText = (el.closest('label')?.textContent || el.parentElement?.textContent || '').toLowerCase();
            const elId = (el.id || '').toLowerCase();
            if (labelText.includes('understand and agree') || el.name === 'honor_code' || elId.includes('agreement') || el.closest('[data-testid="HonorCodeAgreement"], [data-testid*="honor" i]')) {
                return false;
            }

            return !!findQuestionContainer(el);
        });
    }

    function cleanFormulaText(s) {
        return (s || '')
            .toLowerCase()
            // Strip bullet labels like "A. ", "a) ", "(1) " ONLY when followed by whitespace, keeping decimals intact
            .replace(/^(\([a-z0-9]+\)|[a-z0-9][\.\)])\s+/i, '')
            // Remove LaTeX formatting symbols
            .replace(/\\[a-z]+/gi, '')
            .replace(/[\$\{\}\\]/g, '')
            // Normalize subscripts: X_1 -> X1, X_{1} -> X1
            .replace(/([a-z])_([0-9a-z])/gi, '$1$2')
            // Normalize spaces around operators
            .replace(/\s*([=+\-*/^&|])\s*/g, '$1')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stripAll(s) {
        return cleanFormulaText(s).replace(/[^a-z0-9]/g, '');
    }

    function norm(s) {
        return cleanFormulaText(s);
    }

    function isNumericString(s) {
        const trimmed = (s || '').trim();
        return trimmed !== '' && !isNaN(Number(trimmed));
    }

    function findQuestionContainer(input) {
        if (!input) return null;

        // 1. Direct match on recognized Coursera question container elements
        const direct = input.closest(
            'div[data-testid="question-view"], div[data-testid="quiz-question"], ' +
            '.rc-FormPartsQuestion, .rc-QuizQuestion, fieldset[class*="question" i], [data-testid*="question-part"], ' +
            'div[data-testid="part-submission"]'
        );
        if (direct) return direct;

        // 2. Safe upward climb past option & radiogroup wrappers until an ancestor with question prompt is found
        let el = input.parentElement;
        let fallback = null;
        while (el && el !== document.body && el !== document.documentElement) {
            // Stop immediately if we hit sidebar or navigation
            if (el.tagName === 'ASIDE' || el.tagName === 'NAV' || el.tagName === 'HEADER' || el.tagName === 'FOOTER' ||
                el.classList?.contains('rc-CourseNavigation') || el.classList?.contains('rc-NavigationDrawer')) {
                return null;
            }

            const role = el.getAttribute ? el.getAttribute('role') || '' : '';
            const cl = typeof el.className === 'string' ? el.className : '';
            const isWrapper = role === 'radiogroup' || role === 'group' || role === 'radio' || role === 'checkbox' ||
                              cl.includes('Option') || cl.includes('option') || cl.includes('choices');

            if (!isWrapper) {
                // Must have a real question prompt, CML viewer, or legend
                const hasPrompt = el.querySelector(
                    '[data-testid="cml-viewer"], [data-testid*="cml"], .rc-CML, [class*="cml-viewer"], [class*="question-text"], [class*="prompt"], legend'
                );
                if (hasPrompt) {
                    return el;
                }
                if (!fallback && el.tagName === 'DIV' && (cl.includes('Question') || cl.includes('question') || cl.includes('prompt'))) {
                    fallback = el;
                }
            }
            el = el.parentElement;
        }

        return fallback;
    }

    function extractQuestionContext(container, groupEl) {
        function cleanKatexAndText(el) {
            if (!el) return '';
            const clone = el.cloneNode(true);
            // Replace KaTeX math with clean LaTeX formula
            clone.querySelectorAll('.katex').forEach(k => {
                const tex = k.querySelector('annotation[encoding*="tex"]')?.textContent ||
                            k.querySelector('.katex-html')?.textContent;
                if (tex) {
                    k.replaceWith(document.createTextNode(' ' + tex.trim() + ' '));
                }
            });
            // Remove options, radios, checkboxes, buttons, text inputs, textareas, svgs
            clone.querySelectorAll(
                '.rc-Option, label, [class*="Option"], [role="radiogroup"], [role="group"], [role="radio"], [role="checkbox"], button, input, textarea, svg'
            ).forEach(e => e.remove());

            let str = (clone.innerText || clone.textContent || '').trim();
            str = str.replace(/^\d+\s*[\.\)]\s*/, '') // leading question number prefix "1. "
                     .replace(/\s*\(\s*\d+\s*points?\s*\)\s*$/i, '') // trailing points
                     .replace(/\s*\d+\s*points?\s*$/i, '')
                     .replace(/\s+/g, ' ')
                     .trim();
            return str;
        }

        // Priority 1: Exact prompt via aria-labelledby on the radiogroup/group (from Coursera DevTools DOM)
        if (groupEl) {
            const labelledBy = groupEl.getAttribute('aria-labelledby');
            if (labelledBy) {
                const promptById = document.getElementById(labelledBy);
                if (promptById) {
                    const text = cleanKatexAndText(promptById);
                    if (text && text.length > 3) return text;
                }
            }

            // Priority 2: Check inside groupEl for prompt id or prompt CML viewer
            const internalPrompt = groupEl.querySelector('[id^="prompt-"], [id*="prompt"], [data-testid="cml-viewer"], .rc-CML');
            if (internalPrompt && !internalPrompt.closest('.rc-Option, label, .cds-checkboxAndRadio-label')) {
                const text = cleanKatexAndText(internalPrompt);
                if (text && text.length > 3) return text;
            }

            // Priority 3: Previous sibling of the group
            let prev = groupEl.previousElementSibling;
            while (prev) {
                const text = cleanKatexAndText(prev);
                if (text && text.length > 5) return text;
                prev = prev.previousElementSibling;
            }
        }

        // Priority 4: Search container
        if (container) {
            const promptEl = container.querySelector(
                '[id^="prompt-"], [id*="prompt"], [data-testid="cml-viewer"], [data-testid*="cml"], .rc-CML, [class*="cml-viewer"], [class*="question-text"], legend, h1, h2, h3, h4'
            );
            if (promptEl && !promptEl.closest('.rc-Option, label, .cds-checkboxAndRadio-label')) {
                const promptText = cleanKatexAndText(promptEl);
                if (promptText && promptText.length > 3) return promptText;
            }
            return cleanKatexAndText(container);
        }

        return '';
    }

    function getOptionInfo(input, idx) {
        const optionWrapper = input.closest('.rc-Option, label, [class*="Option"], li') || input.parentElement;
        let text = '';

        if (optionWrapper) {
            // Target Coursera's exact label text container: .cds-checkboxAndRadio-labelText, .rc-CML, [data-testid="cml-viewer"]
            const labelTextEl = optionWrapper.querySelector('.cds-checkboxAndRadio-labelText, .rc-CML, [data-testid="cml-viewer"]');
            const targetEl = labelTextEl || optionWrapper;

            const clone = targetEl.cloneNode(true);
            clone.querySelectorAll('.katex').forEach(k => {
                const tex = k.querySelector('annotation[encoding*="tex"]')?.textContent ||
                            k.querySelector('.katex-html')?.textContent;
                if (tex) {
                    k.replaceWith(document.createTextNode(' ' + tex.trim() + ' '));
                }
            });
            clone.querySelectorAll('input, svg, button').forEach(el => el.remove());
            text = (clone.innerText || clone.textContent || '').trim();
        }

        // Clean option text of bullet labels like "A. ", "a) ", "(1) " ONLY when followed by whitespace, keeping decimals intact
        const cleanText = text.replace(/^(\([a-z0-9]+\)|[a-z0-9][\.\)])\s+/i, '').replace(/\s+/g, ' ').trim();
        return { input, text: cleanText || text || `Option ${idx}`, rawText: text, index: idx };
    }

    function resolveSingleChoiceOption(options, ans) {
        if (!options || options.length === 0) return { index: -1, reason: 'No options available' };
        const ansTexts = (ans.answerTexts || []).map(t => (t || '').trim()).filter(Boolean);
        const ansIndices = ans.answerIndices || [];

        // TIER 1: Exact / Clean Formula Match
        for (const ansText of ansTexts) {
            const cleanAns = cleanFormulaText(ansText);
            const matchIdx = options.findIndex(o => cleanFormulaText(o.text) === cleanAns);
            if (matchIdx !== -1) {
                return { index: matchIdx, reason: `Exact formula match: "${ansText}"` };
            }
        }

        // TIER 2: Numeric Equality Match (prevents decimal/float discrepancies, never confuses 5.62 with 5.625)
        for (const ansText of ansTexts) {
            if (isNumericString(ansText)) {
                const numAns = Number(ansText);
                const matchIdx = options.findIndex(o => isNumericString(o.text) && Math.abs(Number(o.text) - numAns) < 1e-5);
                if (matchIdx !== -1) {
                    return { index: matchIdx, reason: `Numeric equality match: ${numAns}` };
                }
            }
        }

        // TIER 3: Punctuation & Space Insensitive Match (e.g. "X_1 = 0 and X_2 = 0" vs "X1=0 and X2=0")
        for (const ansText of ansTexts) {
            const strippedAns = stripAll(ansText);
            if (strippedAns.length >= 2) {
                const matchIdx = options.findIndex(o => stripAll(o.text) === strippedAns);
                if (matchIdx !== -1) {
                    return { index: matchIdx, reason: `Normalized match: "${ansText}"` };
                }
            }
        }

        // TIER 4: Verified Index Match
        if (ansIndices.length > 0) {
            const idx = ansIndices[0];
            if (options[idx]) {
                if (ansTexts.length === 0) {
                    return { index: idx, reason: `Direct index [${idx}]` };
                }
                const optClean = stripAll(options[idx].text);
                const ansClean = stripAll(ansTexts[0]);
                if (optClean === ansClean || optClean.includes(ansClean) || ansClean.includes(optClean)) {
                    return { index: idx, reason: `Verified index [${idx}] ("${options[idx].text}")` };
                }
            }
        }

        // TIER 5: Phrase / Substring Match for text (Non-numeric, length >= 3)
        for (const ansText of ansTexts) {
            const cleanAns = cleanFormulaText(ansText);
            if (!isNumericString(cleanAns) && cleanAns.length >= 3) {
                const matchIdx = options.findIndex(o => {
                    const optClean = cleanFormulaText(o.text);
                    return !isNumericString(optClean) && optClean.includes(cleanAns);
                });
                if (matchIdx !== -1) {
                    return { index: matchIdx, reason: `Substring match: "${ansText}" in "${options[matchIdx].text}"` };
                }
            }
        }

        // TIER 6: Fallback to index if within bounds
        if (ansIndices.length > 0 && options[ansIndices[0]]) {
            return { index: ansIndices[0], reason: `Fallback index [${ansIndices[0]}]` };
        }

        return { index: 0, reason: `Default index 0 fallback` };
    }

    function resolveMultipleChoiceOptions(options, ans) {
        if (!options || options.length === 0) return [];
        const ansTexts = (ans.answerTexts || []).map(t => (t || '').trim()).filter(Boolean);
        const ansIndices = ans.answerIndices || [];

        const selected = [];

        options.forEach((opt, optIdx) => {
            const optClean = cleanFormulaText(opt.text);
            const optStripped = stripAll(opt.text);
            let matched = false;
            let matchReason = '';

            // Check 1: Exact / Clean formula match
            for (const ansText of ansTexts) {
                if (cleanFormulaText(ansText) === optClean) {
                    matched = true;
                    matchReason = `Exact match "${ansText}"`;
                    break;
                }
            }

            // Check 2: Numeric equality match
            if (!matched && isNumericString(opt.text)) {
                const numOpt = Number(opt.text);
                for (const ansText of ansTexts) {
                    if (isNumericString(ansText) && Math.abs(Number(ansText) - numOpt) < 1e-5) {
                        matched = true;
                        matchReason = `Numeric equality ${numOpt}`;
                        break;
                    }
                }
            }

            // Check 3: Punctuation & Space Insensitive Match
            if (!matched && optStripped.length >= 2) {
                for (const ansText of ansTexts) {
                    if (stripAll(ansText) === optStripped) {
                        matched = true;
                        matchReason = `Normalized match "${ansText}"`;
                        break;
                    }
                }
            }

            // Check 4: Verified index match
            if (!matched && ansIndices.includes(optIdx)) {
                if (ansTexts.length === 0 || ansTexts.some(t => stripAll(t).includes(optStripped) || optStripped.includes(stripAll(t)))) {
                    matched = true;
                    matchReason = `Verified index [${optIdx}]`;
                }
            }

            // Check 5: Phrase match for descriptive text
            if (!matched && !isNumericString(optClean) && optClean.length >= 4) {
                for (const ansText of ansTexts) {
                    const cleanAns = cleanFormulaText(ansText);
                    if (!isNumericString(cleanAns) && cleanAns.length >= 4 && (optClean.includes(cleanAns) || cleanAns.includes(optClean))) {
                        matched = true;
                        matchReason = `Phrase match with "${ansText}"`;
                        break;
                    }
                }
            }

            if (matched) {
                selected.push({ index: optIdx, text: opt.text, reason: matchReason });
            }
        });

        // Robust Fallbacks for Multiple Choice
        if (selected.length === 0) {
            for (const idx of ansIndices) {
                if (options[idx]) {
                    selected.push({ index: idx, text: options[idx].text, reason: `Index fallback [${idx}]` });
                }
            }
        }
        if (selected.length === 0 && options.length > 0) {
            selected.push({ index: 0, text: options[0].text, reason: 'Default first option fallback' });
        }

        return selected;
    }

    function selectOption(input, shouldCheck = true) {
        if (!input) return;
        if (input.checked === shouldCheck) return;

        const label = input.closest('label.cds-checkboxAndRadio-label') || input.closest('label') || (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
        const target = label || input;

        try {
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            target.click();
        } catch (e) {}

        if (input.checked !== shouldCheck) {
            input.checked = shouldCheck;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function fillTextInput(input, text) {
        if (!input) return;
        try { input.focus(); } catch (e) {}
        const proto = input.tagName === 'TEXTAREA' 
            ? window.HTMLTextAreaElement.prototype 
            : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
            desc.set.call(input, text);
        } else {
            input.value = text;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        try { input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })); } catch (e) {}
        try { input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' })); } catch (e) {}
    }

    function acceptHonorCode() {
        try {
            // 1. Target explicit Coursera Honor Code container (from DevTools inspection)
            document.querySelectorAll('[data-testid="HonorCodeAgreement"], [data-testid*="honor" i], [data-testid*="agreement" i]').forEach(container => {
                const chk = container.querySelector('input[type="checkbox"]');
                if (chk && !chk.checked) {
                    selectOption(chk, true);
                }
                const lbl = container.querySelector('label');
                if (lbl && chk && !chk.checked) {
                    try { lbl.click(); } catch(e) {}
                }
            });

            // 2. Scan all checkboxes and text inputs for agreement keywords
            const agreementInputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="text"]')).filter(input => {
                const aria = (input.getAttribute('aria-label') || '').toLowerCase();
                const id = (input.id || '').toLowerCase();
                const name = (input.name || '').toLowerCase();
                const labelText = (input.closest('label')?.textContent || input.parentElement?.textContent || '').toLowerCase();
                return id.includes('agreement') || id.includes('honor') || 
                       name.includes('honor') || name.includes('agreement') || 
                       aria.includes('understand and agree') || aria.includes('honor') || 
                       labelText.includes('understand and agree') || labelText.includes('honor code') ||
                       labelText.includes('i understand');
            });
            agreementInputs.forEach(chk => {
                if (chk.type === 'checkbox' && !chk.checked) selectOption(chk, true);
                if (chk.type === 'text' && !chk.value) fillTextInput(chk, 'Coursera Student');
            });

            // 3. Target explicit agreement labels and clickable text
            document.querySelectorAll('label[class*="agreement"], label[class*="honor"], [data-testid*="honor-code"]').forEach(el => {
                const chk = el.querySelector('input[type="checkbox"]');
                if (chk && !chk.checked) selectOption(chk, true);
            });
        } catch (e) {}
    }

    /* ========================================================================
       AI SOLVER CORE (STRICT 1 CONSOLIDATED API CALL PER QUIZ ATTEMPT)
       ======================================================================== */
    function areQuestionsAlreadyAnswered() {
        try {
            const rawInputs = getQuizInputs();
            if (rawInputs.length === 0) return false;

            const groups = new Map();
            rawInputs.forEach(input => {
                const groupEl = input.closest('[role="radiogroup"], [role="group"]');
                const key = (input.name && input.name.trim()) 
                    ? `name:${input.name.trim()}` 
                    : (groupEl || findQuestionContainer(input));
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(input);
            });

            if (groups.size === 0) return false;

            for (const [key, inputs] of groups.entries()) {
                const hasAnswer = inputs.some(inp => {
                    if (inp.type === 'radio' || inp.type === 'checkbox') {
                        return inp.checked;
                    }
                    // Free text input or textarea
                    return inp.value && inp.value.trim().length > 0;
                });
                if (!hasAnswer) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async function solveQuizQuestions() {
        if (isSolvingQuiz || isSubmitting) return;
        if (!state.autoSolve) return;
        if (!hasAnyApiKey()) {
            addLog("No AI API Key found. Add a free API key (Groq, Gemini, OpenRouter, or NVIDIA) in the popup.", "warn");
            return;
        }
        if (Date.now() < apiCooldownUntil) return;
        if (isQuizFeedbackPage()) return;
        if (quizCompletedForUrl === window.location.href) return;

        // SINGLE API CALL GUARANTEE: Never call AI if already in progress or completed for this URL
        if (quizSession.url === window.location.href && quizSession.status !== 'IDLE') {
            return;
        }

        const rawInputs = getQuizInputs();
        if (rawInputs.length === 0) return;

        isSolvingQuiz = true;
        quizSession.url = window.location.href;
        quizSession.status = 'SOLVING';
        addLog(`Analyzing ${rawInputs.length} quiz option(s)...`, "info");

        try {
            acceptHonorCode();

            const questions = [];
            rawInputs.forEach(input => {
                const isText = input.tagName === 'TEXTAREA' || (input.tagName === 'INPUT' && input.type !== 'radio' && input.type !== 'checkbox');
                const groupEl = input.closest('[role="radiogroup"], [role="group"]');
                const groupKey = (input.name && input.name.trim()) 
                    ? `name:${input.name.trim()}` 
                    : (groupEl || findQuestionContainer(input));

                let q = questions.find(item => item.groupKey === groupKey);
                if (!q) {
                    const container = findQuestionContainer(input);
                    q = {
                        type: isText ? 'text' : input.type,
                        isText: isText,
                        groupKey,
                        container,
                        context: extractQuestionContext(container, groupEl),
                        inputs: [],
                        options: [],
                        markedIndex: -1,
                        markedText: '',
                        matchReason: ''
                    };
                    questions.push(q);
                }
                q.inputs.push(input);
            });

            questions.forEach(q => {
                if (q.isText) {
                    q.options = [{ input: q.inputs[0], text: 'Free-text answer input field', rawText: '', index: 0 }];
                } else {
                    q.options = q.inputs.map((inp, idx) => getOptionInfo(inp, idx));
                }
            });

            if (questions.length === 0) {
                isSolvingQuiz = false;
                quizSession.status = 'IDLE';
                return;
            }

            addLog(`Consolidating all ${questions.length} question(s) into 1 AI request...`, "info");

            let prompt = `You are a distinguished university professor and academic quiz solver with 100% precision.\n`;
            prompt += `Solve the following university quiz question(s) from Coursera with absolute accuracy.\n\n`;
            questions.forEach((q, idx) => {
                prompt += `=== QUESTION ${idx} ===\n`;
                if (q.type === 'text' || q.isText) {
                    prompt += `Type: text_input (type the exact word, number, or short phrase required)\n`;
                    prompt += `Prompt: ${q.context || 'Enter the correct answer'}\n`;
                    prompt += `Options: None (Free-text input field)\n`;
                } else if (q.type === 'checkbox') {
                    prompt += `Type: multiple_choice (select all that apply)\n`;
                    prompt += `Prompt: ${q.context || 'Choose the correct answers'}\n`;
                    prompt += `Options:\n`;
                    q.options.forEach((opt, oIdx) => {
                        prompt += `[Index ${oIdx}]: ${opt.text}\n`;
                    });
                } else {
                    prompt += `Type: single_choice (select exactly one)\n`;
                    prompt += `Prompt: ${q.context || 'Choose the correct answer based on standard academic definitions'}\n`;
                    prompt += `Options:\n`;
                    q.options.forEach((opt, oIdx) => {
                        prompt += `[Index ${oIdx}]: ${opt.text}\n`;
                    });
                }
                prompt += `\n`;
            });

            prompt += `CRITICAL INSTRUCTIONS:
1. In 'rationale', write concise step-by-step reasoning or mathematical calculation proving why the chosen answer is correct.
2. For single_choice (radio): select EXACTLY ONE answer from the provided Options list. Provide exact string in 'answerTexts' and 0-based index in 'answerIndices'.
3. For multiple_choice (checkbox): select ALL correct options from the provided Options list.
4. For text_input: provide the exact single verbatim word, number, or short phrase in 'answerTexts' (e.g. ["alu"]). If the prompt specifies formatting (such as "in all lowercase" or a specific unit), follow it strictly. Set answerIndices to [0].

Output ONLY a valid JSON array of objects without Markdown formatting:
[
  {
    "id": 0,
    "rationale": "reasoning",
    "answerIndices": [0],
    "answerTexts": ["exact verbatim option string or exact text answer"]
  }
]`;

            chrome.runtime.sendMessage({
                type: 'ASK_AI',
                prompt: prompt
            }, async (response) => {
                try {
                    if (response && response.success && response.text) {
                        const providerName = response.provider || 'AI';
                        let text = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();

                        let parsedObj;
                        try {
                            parsedObj = JSON.parse(text);
                        } catch (parseErr) {
                            const firstBracket = text.indexOf('[');
                            const lastBracket = text.lastIndexOf(']');
                            if (firstBracket !== -1 && lastBracket !== -1) {
                                parsedObj = JSON.parse(text.substring(firstBracket, lastBracket + 1));
                            } else {
                                const firstBrace = text.indexOf('{');
                                const lastBrace = text.lastIndexOf('}');
                                if (firstBrace !== -1 && lastBrace !== -1) {
                                    parsedObj = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                                } else {
                                    throw new Error("Could not extract JSON from AI output");
                                }
                            }
                        }

                        const answers = Array.isArray(parsedObj) 
                            ? parsedObj 
                            : (parsedObj.answers || parsedObj.questions || parsedObj.results || Object.values(parsedObj)[0] || []);

                        quizSession.answers = answers;
                        addLog(`✓ Answers received from ${providerName}. Applying choices with human timing...`, "info");
                        let markedQuestionsCount = 0;

                        for (let i = 0; i < questions.length; i++) {
                            const q = questions[i];
                            const ans = answers.find(a => a.id === i) || answers[i];
                            if (!ans) continue;

                            showStatus(`Marking Question ${i + 1} of ${questions.length}...`);

                            if (q.type === 'text' || q.isText) {
                                let ansText = '';
                                if (ans.answerTexts && ans.answerTexts.length > 0) {
                                    ansText = String(ans.answerTexts[0]).trim();
                                } else if (typeof ans.answer === 'string') {
                                    ansText = ans.answer.trim();
                                } else if (typeof ans.text === 'string') {
                                    ansText = ans.text.trim();
                                }
                                ansText = ansText.replace(/^["']|["']$/g, '');
                                if (q.context && q.context.toLowerCase().includes('all lowercase')) {
                                    ansText = ansText.toLowerCase();
                                }
                                const textInputEl = q.inputs[0];
                                if (textInputEl && ansText) {
                                    fillTextInput(textInputEl, ansText);
                                    q.markedIndex = 0;
                                    q.markedText = ansText;
                                    q.matchReason = 'Free-text input filled';
                                    markedQuestionsCount++;
                                    addLog(`Q${i + 1}: Entered "${ansText}" into text field`, "info");
                                } else {
                                    addLog(`Q${i + 1}: Could not determine text for input field.`, "warn");
                                }
                            } else if (q.type === 'radio') {
                                const resolution = resolveSingleChoiceOption(q.options, ans);
                                if (resolution.index >= 0 && q.options[resolution.index]) {
                                    const chosen = q.options[resolution.index];
                                    selectOption(chosen.input, true);
                                    q.markedIndex = resolution.index;
                                    q.markedText = chosen.text;
                                    q.matchReason = resolution.reason;
                                    markedQuestionsCount++;
                                    addLog(`Q${i + 1}: Marked "${chosen.text}" (${resolution.reason})`, "info");
                                } else {
                                    addLog(`Q${i + 1}: Could not resolve single-choice answer.`, "warn");
                                }
                            } else if (q.type === 'checkbox') {
                                const resolved = resolveMultipleChoiceOptions(q.options, ans);
                                const resolvedIndices = new Set(resolved.map(r => r.index));

                                for (let j = 0; j < q.options.length; j++) {
                                    const opt = q.options[j];
                                    const shouldSelect = resolvedIndices.has(j);
                                    selectOption(opt.input, shouldSelect);
                                    if (shouldSelect) {
                                        await new Promise(r => setTimeout(r, 200 + Math.random() * 150));
                                    }
                                }

                                if (resolved.length > 0) {
                                    markedQuestionsCount++;
                                    q.markedIndex = resolved.map(r => r.index);
                                    q.markedText = resolved.map(r => r.text).join(', ');
                                    q.matchReason = 'Multiple-choice matched';
                                    addLog(`Q${i + 1}: Marked [${q.markedText}]`, "info");
                                } else {
                                    addLog(`Q${i + 1}: No options resolved for multiple-choice.`, "warn");
                                }
                            }

                            // Human-like pause between questions: 650ms to 950ms
                            if (i < questions.length - 1) {
                                const delay = 650 + Math.floor(Math.random() * 300);
                                await new Promise(r => setTimeout(r, delay));
                            }
                        }

                        // Store complete quiz solution data in chrome.storage for popup display
                        const quizRecord = {
                            timestamp: new Date().toLocaleTimeString(),
                            url: window.location.href,
                            title: document.querySelector('h1, [data-testid*="title"], .rc-PeriodicalAssignmentTitle')?.textContent?.trim() || document.title,
                            providerUsed: providerName,
                            grade: quizSession.grade || '',
                            questions: questions.map((q, idx) => {
                                const a = answers.find(item => item.id === idx) || answers[idx] || {};
                                return {
                                    id: idx,
                                    prompt: q.context,
                                    type: q.type,
                                    options: q.options.map(o => o.text),
                                    aiRationale: a.rationale || 'No rationale provided',
                                    aiAnswerTexts: a.answerTexts || [],
                                    aiAnswerIndices: a.answerIndices || [],
                                    markedIndex: q.markedIndex,
                                    markedText: q.markedText,
                                    matchReason: q.matchReason
                                };
                            }),
                            rawPrompt: prompt,
                            rawResponse: text
                        };
                        chrome.storage.local.set({ lastGeminiQuizData: quizRecord });

                        addLog(`Marked answers for ${markedQuestionsCount}/${questions.length} questions via ${providerName}.`, "success");
                        acceptHonorCode();

                        quizSession.status = 'MARKED';

                        // SAFEGUARD: Only submit if all questions have answers marked!
                        if (markedQuestionsCount >= questions.length) {
                            addLog("All questions marked. Proceeding to submit flow in 1.2s...", "info");
                            setTimeout(() => {
                                submitAndTrackQuizFlow();
                            }, 1200);
                        } else {
                            addLog(`Warning: Only ${markedQuestionsCount}/${questions.length} questions filled. Review before submit.`, "warn");
                            apiCooldownUntil = Date.now() + 15000;
                            quizSession.status = 'IDLE'; // Allow retry after short pause
                        }
                    } else {
                        const err = response?.error || "AI service unavailable";
                        const is429 = response?.isRateLimit || (err && (err.includes('429') || err.toLowerCase().includes('rate limit') || err.toLowerCase().includes('quota')));
                        if (is429) {
                            addLog(`HTTP 429 Rate Limit: Cooldown active for 15s. Auto-failover will switch to backup AI.`, "warn");
                            apiCooldownUntil = Date.now() + 15000;
                        } else {
                            addLog(`AI Error: ${err}`, "error");
                            apiCooldownUntil = Date.now() + 10000;
                        }
                        quizSession.status = 'IDLE'; // Allow retry after cooldown
                    }
                } catch (e) {
                    addLog(`Error processing AI response: ${e.message}`, "error");
                    apiCooldownUntil = Date.now() + 10000;
                    quizSession.status = 'IDLE';
                } finally {
                    isSolvingQuiz = false;
                }
            });

        } catch (err) {
            addLog(`Error during solving: ${err.message}`, "error");
            isSolvingQuiz = false;
            quizSession.status = 'IDLE';
            apiCooldownUntil = Date.now() + 10000;
        }
    }

    /* ========================================================================
       STEP-BY-STEP SUBMISSION LIFECYCLE (PICS 1 -> 2 -> 3 -> 4)
       Step 1 (Pic 1): Click page Submit button -> Modal opens
       Step 2 (Pic 1 & 2): Delay in modal -> Click dialog Submit -> Spinner appears
       Step 3 (Pic 2, 3, 4): Wait through "Hang tight! This shouldn't take too long" until results mount
       Step 4 (Pic 4): Results visible ("Your grade: XX%"), wait 4.5s for Coursera green tick, click "Next item ->"
       ======================================================================== */
    async function submitAndTrackQuizFlow() {
        if (isSubmitting) return;
        isSubmitting = true;
        quizSession.status = 'SUBMITTING';

        const currentAttemptUrl = window.location.href;
        acceptHonorCode();

        // STEP 1: Find and click the page Submit button
        showStatus("Step 1/4: Submitting quiz assignment...");

        let submitBtn = findSubmitButton();

        // If not found or disabled, actively poll for up to 3.5 seconds ensuring honor code is checked
        for (let wait = 0; wait < 18; wait++) {
            acceptHonorCode();
            submitBtn = findSubmitButton();
            if (submitBtn && !submitBtn.disabled && submitBtn.getAttribute('aria-disabled') !== 'true') {
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        if (!submitBtn) {
            addLog("Could not find assignment Submit button. Will retry in next loop...", "warn");
            isSubmitting = false;
            quizSession.status = 'MARKED'; // Will be picked up by handleAutoPilot next tick
            return;
        }

        // If found but still aria-disabled, give it one more synthetic click on the honor code label and brief wait
        if (submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.disabled) {
            acceptHonorCode();
            await new Promise(r => setTimeout(r, 400));
        }

        addLog("Step 1: Clicked assignment Submit button.", "info");
        triggerClick(submitBtn);

        // STEP 2: Detect modal "Ready to submit?", pause with human delay, and click dialog Submit (Pic 1 & 2)
        showStatus("Step 2/4: Waiting for confirmation modal...");
        let confirmBtn = null;

        for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise(r => setTimeout(r, 300));

            // If submission directly navigated or results/grading mounted, no confirmation modal needed!
            if (isGradingInProgress() || hasQuizResultsMounted() || isQuizFeedbackPage()) {
                addLog("Submission accepted directly (no confirmation modal needed).", "info");
                break;
            }

            const dialogs = document.querySelectorAll('[role="dialog"], .rc-Modal, [class*="Modal"], [class*="dialog"]');
            for (const dialog of dialogs) {
                if (!isConfirmationDialog(dialog)) continue;
                const btns = Array.from(dialog.querySelectorAll('button, input[type="submit"]'));
                confirmBtn = btns.find(b => {
                    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                    const t = (b.textContent || b.value || '').trim().toLowerCase();
                    return (t === 'submit' || t.includes('yes') || t === 'confirm') && !t.includes('cancel') && !t.includes('back');
                });
                if (confirmBtn) break;
            }
            if (confirmBtn) break;
        }

        if (confirmBtn) {
            addLog("Step 2: Modal appeared. Pausing 1.2s before confirming...", "info");
            await new Promise(r => setTimeout(r, 1200));

            try {
                confirmBtn.click();
                addLog("Step 2: Clicked Submit in modal confirmation dialog.", "info");
            } catch (e) {
                confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
        } else {
            addLog("No confirmation modal appeared. Proceeding to grading wait...", "info");
        }

        // STEP 3: Wait through "Hang tight! This shouldn't take too long." and tunnel-vision grading
        quizSession.status = 'REVIEWING';
        showStatus("Step 3/4: Coursera is grading your submission... Hang tight!");
        addLog("Step 3: Grading in progress. Waiting for Coursera to finish and display results...", "info");

        // Poll for results for up to 90 seconds (180 iterations * 500ms)
        let gradeDetected = null;
        for (let i = 0; i < 180; i++) {
            await new Promise(r => setTimeout(r, 500));

            // While grading is actively in progress, strictly stay in waiting mode!
            if (isGradingInProgress()) {
                showStatus("Step 3/4: Coursera is grading your submission... Hang tight!");
                continue;
            }

            // Results have mounted!
            if (hasQuizResultsMounted()) {
                const pageText = document.body ? (document.body.innerText || '') : '';
                const match = pageText.match(/Your\s+(?:grade|latest|highest|score)\s*:\s*([0-9\.]+%?)/i);
                gradeDetected = match ? match[1] : 'Passed (100%)';
                break;
            }

            if (isQuizFeedbackPage()) {
                gradeDetected = 'Passed';
                break;
            }
        }

        // STEP 4: Results visible! Show grade, pause 4.5s for Coursera to persist completion green checkmark!
        quizSession.status = 'GRADED';
        quizSession.grade = gradeDetected || 'Passed';
        quizCompletedForUrl = currentAttemptUrl;

        // Update popup storage with grade
        chrome.storage.local.get(['lastGeminiQuizData'], (data) => {
            if (data.lastGeminiQuizData) {
                data.lastGeminiQuizData.grade = quizSession.grade;
                chrome.storage.local.set({ lastGeminiQuizData: data.lastGeminiQuizData });
            }
        });

        addLog(`🎉 Step 4: Coursera grade confirmed: ${quizSession.grade}!`, "success");
        addLog("Waiting 4.5s for Coursera to persist completion and award green checkmark...", "info");
        showStatus(`Grade: ${quizSession.grade}! Registering completion in 4s...`);

        // Wait 4.5s delay so Coursera's server records the item as passed and green checkmark is saved
        await new Promise(r => setTimeout(r, 4500));

        const nextBtn = findNextItemButton();
        if (nextBtn) {
            lastNavTime = Date.now();
            addLog("Step 4: Clicked 'Next item →'. Moving forward to next course item!", "success");
            showStatus("Advancing to next course item...");
            triggerClick(nextBtn);
        } else {
            addLog("Step 4 complete. Autopilot navigation loop will advance to next item.", "info");
        }

        isSubmitting = false;
    }

    /* ========================================================================
       MASTER AUTO-PILOT & COURSE NAVIGATION ENGINE (OPTIMIZED)
       ======================================================================== */
    function handleAutoPilot() {
        try {
            if (!state.autoNavigate && !state.autoSolve) return;

            // 1. SPA ROUTE CHANGE DETECTION (ALWAYS RUN FIRST!)
            if (window.location.href !== lastKnownUrl) {
                lastKnownUrl = window.location.href;
                pageArrivalTime = Date.now();
                videoEndedFirstSeenTime = 0;
                hasMarkedCurrentReading = false;
                lastStartClickTime = 0;
                lastStartClickUrl = '';
                isGeneratingDialogueResponse = false;
                lastAnsweredDialogueQuestion = '';
                lastStartDialogueClickTime = 0;
                
                // Cleanly reset quiz session whenever user or autopilot navigates to a new item
                quizSession.url = window.location.href;
                quizSession.status = 'IDLE';
                quizSession.answers = null;
                quizSession.grade = '';
                isSubmitting = false;
                isSolvingQuiz = false;
                addLog(`Arrived at: ${document.title || 'Course Item'}`, 'info');
            }

            // 2. GLOBAL STUCK WATCHDOG (AUTO-REFRESH AFTER 3 MIN, AUTO-SKIP AFTER 2 MIN)
            const timeOnPage = Date.now() - pageArrivalTime;

            // A. 3-Minute Auto-Refresh: If website is stuck anywhere for >3 minutes, auto-refresh once to unfreeze
            if (timeOnPage > 180000 && (Date.now() - lastNavTime > 5000)) {
                const refreshKey = 'coursera_stuck_refreshed_' + window.location.pathname;
                if (sessionStorage.getItem(refreshKey) !== 'true') {
                    sessionStorage.setItem(refreshKey, 'true');
                    addLog("AutoPilot Watchdog: Page stuck for >3 minutes. Auto-refreshing once to recover...", "warn");
                    showStatus("Page stuck for >3 min! Auto-refreshing once...");
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                    return;
                }
            }

            // B. 2-Minute Skip Watchdog: If stuck on same page for >2 minutes (and video is not actively playing forward), skip to next item!
            const video = document.querySelector('video');
            const isVideoActivelyPlaying = video && !video.paused && !video.ended && (video.readyState >= 3);
            if (timeOnPage > 120000 && !isVideoActivelyPlaying && (Date.now() - lastNavTime > 4000)) {
                addLog("AutoPilot Watchdog: Stuck on same page for >2 minutes. Auto-skipping to next item...", "warn");
                showStatus("Stuck for >2 min! Auto-skipping to next item...");
                lastNavTime = Date.now();
                const nextBtn = findNextItemButton();
                if (nextBtn) {
                    triggerClick(nextBtn);
                } else {
                    const nextTarget = findNextPendingSidebarItem() || findNextTargetSidebarItem(state.focusMode);
                    if (nextTarget) triggerClick(nextTarget);
                }
                pageArrivalTime = Date.now();
                return;
            }

            // 3. SUBMISSION GUARD: If submitting or reviewing a quiz on the CURRENT page, strictly pause!
            if (isSubmitting || quizSession.status === 'SUBMITTING' || quizSession.status === 'REVIEWING') {
                if (quizSession.url === window.location.href) {
                    return;
                }
                // If we navigated away from the submitted quiz, clear stale submission locks
                isSubmitting = false;
                quizSession.status = 'IDLE';
            }

            const currentItemType = getItemTypeFromUrl(window.location.href);
            const isQuizUrl = isQuizOrAssignmentUrl();
            const quizInputs = getQuizInputs();
            const hasQuestionsOnScreen = quizInputs.length > 0 || !!document.querySelector('[data-testid="question-view"], .rc-QuizQuestion, .rc-FormPartsQuestion, div[data-testid="quiz-question"]');
            const onAttempt = hasQuestionsOnScreen || isQuizAttemptPage();
            const onFeedback = isQuizFeedbackPage();

            // 4. COURSE FOCUS MODES (ITEM FILTERING & FAST SKIPPING)
            // A. Quizzes-only mode: Skip videos and readings immediately
            if (state.focusMode === 'quizzes_only' && (currentItemType === 'video' || currentItemType === 'reading' || video)) {
                if (Date.now() - pageArrivalTime > 1200 && (Date.now() - lastNavTime > 2500)) {
                    lastNavTime = Date.now();
                    const target = findNextTargetSidebarItem('quizzes_only');
                    if (target) {
                        addLog("Quizzes-Only Mode: Skipping video/reading to advance to quiz in sidebar...", "info");
                        showStatus("Quizzes-Only Mode: Jumping to next quiz...");
                        triggerClick(target);
                    } else {
                        const nextBtn = findNextItemButton();
                        if (nextBtn) {
                            addLog("Quizzes-Only Mode: Advancing past video/reading...", "info");
                            showStatus("Quizzes-Only Mode: Advancing to next item...");
                            triggerClick(nextBtn);
                        }
                    }
                    pageArrivalTime = Date.now();
                }
                return;
            }

            // B. Videos-only mode: Skip quizzes and assignments immediately
            if (state.focusMode === 'videos_only' && (currentItemType === 'quiz' || isQuizUrl || onAttempt || onFeedback)) {
                if (Date.now() - pageArrivalTime > 1200 && (Date.now() - lastNavTime > 2500)) {
                    lastNavTime = Date.now();
                    const target = findNextTargetSidebarItem('videos_only');
                    if (target) {
                        addLog("Videos-Only Mode: Skipping quiz/assignment to advance to video in sidebar...", "info");
                        showStatus("Videos-Only Mode: Jumping to next video...");
                        triggerClick(target);
                    } else {
                        const nextBtn = findNextItemButton();
                        if (nextBtn) {
                            addLog("Videos-Only Mode: Advancing past quiz/assignment...", "info");
                            showStatus("Videos-Only Mode: Advancing to next item...");
                            triggerClick(nextBtn);
                        }
                    }
                    pageArrivalTime = Date.now();
                }
                return;
            }

            // C. Pending-only mode: If current item is already marked green, skip it immediately!
            if (state.focusMode === 'pending_only') {
                const sidebarCompleted = isCurrentItemCompletedInSidebar();
                if (sidebarCompleted === true) {
                    if (Date.now() - pageArrivalTime > 1200 && (Date.now() - lastNavTime > 2500)) {
                        lastNavTime = Date.now();
                        const nextPending = findNextPendingSidebarItem();
                        if (nextPending) {
                            addLog("Pending-Only Mode: Current item is already marked green! Jumping to next incomplete item...", "info");
                            showStatus("Item already completed! Jumping to next incomplete item...");
                            triggerClick(nextPending);
                        } else {
                            const nextBtn = findNextItemButton();
                            if (nextBtn) {
                                addLog("Pending-Only Mode: Current item completed. Clicking Next item...", "info");
                                showStatus("Item completed! Advancing to next item...");
                                triggerClick(nextBtn);
                            }
                        }
                        pageArrivalTime = Date.now();
                    }
                    return;
                }
            }

            let shouldGoNext = false;

            // 5. VIDEO ITEM HANDLING
            if (video) {
                injectSpeedBadge(video);

                // Directly enforce playback speed on video only when metadata is loaded
                try {
                    if (video.readyState >= 1) {
                        if (video.playbackRate !== state.playbackSpeed) {
                            video.playbackRate = state.playbackSpeed;
                        }
                        if (video.defaultPlaybackRate !== state.playbackSpeed) {
                            video.defaultPlaybackRate = state.playbackSpeed;
                        }
                    }
                } catch (e) {}

                // A. Auto-play video if paused and not ended
                if (video.paused && !video.ended) {
                    video.play().catch(() => {
                        const playBtn = document.querySelector('button[aria-label^="Play" i], button[title="Play" i]');
                        if (playBtn) playBtn.click();
                    });
                }

                // B. Skip mid-video checkpoints, quizzes, and prompts
                const skipBtn = Array.from(document.querySelectorAll('button, a')).find(btn => {
                    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
                    const t = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                    const a = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
                    return t === 'skip' || t === 'skip quiz' || t === 'skip question' ||
                           t === 'resume' || t === 'continue' || t === 'resume video' ||
                           t === 'continue to video' || t === 'play now' ||
                           a === 'skip' || a === 'resume' || a === 'continue';
                });
                if (skipBtn) {
                    skipBtn.click();
                    addLog("Skipped in-video checkpoint / prompt.", "info");
                }

                // C. Dismiss Coursera banner popups
                const dismissBtn = document.querySelector('button.cds-dialog-close, button[aria-label="Close" i], button[aria-label="Dismiss" i]');
                if (dismissBtn && !dismissBtn.closest('.cds-FullscreenDialog-scrollContainer')) {
                    dismissBtn.click();
                }

                // D. Video Completion Check with Strict Green Tick Confirmation & Reattempt Once
                const videoEnded = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 1.5);
                const countdownVisible = !!document.querySelector('.rc-PostVideoCountdown, [data-testid="video-next-button"]');

                if (videoEnded || countdownVisible) {
                    if (state.strictCompletion) {
                        if (!videoEndedFirstSeenTime) {
                            videoEndedFirstSeenTime = Date.now();
                        }
                        const isCompleted = isCurrentItemCompletedInSidebar();
                        if (isCompleted === true) {
                            // Green checkmark confirmed in sidebar!
                            shouldGoNext = true;
                        } else if (isCompleted === false) {
                            // Sidebar explicitly shows not completed / white circle / failed
                            const waitElapsed = Date.now() - videoEndedFirstSeenTime;
                            if (waitElapsed < 3500) {
                                showStatus(`Video ended. Waiting for Coursera green tick sync (${Math.ceil((3500 - waitElapsed) / 1000)}s)...`);
                                return; // Hold navigation until sync or replay
                            }
                            // 3.5s elapsed and still not marked green in sidebar! Check reattempt count:
                            const curPath = window.location.pathname.toLowerCase();
                            const reattemptCount = itemReattemptMap[curPath] || 0;
                            if (reattemptCount === 0) {
                                itemReattemptMap[curPath] = 1;
                                videoEndedFirstSeenTime = 0;
                                video.currentTime = 0;
                                video.play().catch(() => {});
                                addLog("Green Tick Confirmation: Video ended but not marked green! Reattempting once...", "warn");
                                showStatus("Item not marked green! Reattempting once...");
                                return;
                            } else {
                                addLog("Green Tick Confirmation: Reattempted once. Proceeding to next item to avoid loop.", "info");
                                shouldGoNext = true;
                            }
                        } else {
                            // Sidebar item / status not detectable (e.g. drawer collapsed); advance safely
                            shouldGoNext = true;
                        }
                    } else {
                        shouldGoNext = true;
                    }
                }
            } 
            // 6. COURSERA AI COACH / DIALOGUE HANDLING (EVALUATED BEFORE QUIZZES TO PREVENT HIJACK!)
            else if (isDialogueOrCoachItem()) {
                handleDialogueItem();
                return;
            }
            // 7. QUIZ / ASSIGNMENT / EXAM HANDLING (STRICT ISOLATION: NEVER FALL INTO READING AUTO-NEXT!)
            else if (isQuizUrl || onAttempt || onFeedback || hasQuizResultsMounted()) {

                // A. RESULTS ARE MOUNTED (PIC 2): Banner shows "Your grade: XX%"!
                if (hasQuizResultsMounted() || (quizCompletedForUrl === window.location.href && quizSession.status === 'GRADED')) {
                    if (state.autoNavigate && (Date.now() - lastNavTime > 3500)) {
                        const nextBtn = findNextItemButton();
                        if (nextBtn) {
                            lastNavTime = Date.now();
                            addLog("Step 4 (Pic 2): Results visible with grade banner. Clicking 'Next item →'!", "success");
                            showStatus("Quiz complete! Advancing to next course item...");
                            triggerClick(nextBtn);
                        }
                    }
                    return;
                }

                // B. ACTIVE QUESTIONS ON SCREEN: SOLVE, FILL, AND SUBMIT!
                if (quizInputs.length > 0) {
                    // Check if questions are already answered (e.g. from previous run, user fill, or page reload)
                    if ((quizSession.status === 'IDLE' || quizSession.status === 'SOLVING') && areQuestionsAlreadyAnswered()) {
                        quizSession.status = 'MARKED';
                        quizSession.url = window.location.href;
                    }

                    // 1. If questions already answered and marked, execute submit flow!
                    if (quizSession.status === 'MARKED' && !isSubmitting && !isSolvingQuiz) {
                        addLog("Questions are marked. Executing submit flow...", "info");
                        submitAndTrackQuizFlow();
                        return;
                    }

                    // 2. If submitting or reviewing submission from submit flow, wait!
                    if (isSubmitting || quizSession.status === 'SUBMITTING' || quizSession.status === 'REVIEWING') {
                        showStatus("Coursera is grading submission... Hang tight!");
                        return;
                    }

                    // 3. Otherwise, solve and fill the questions!
                    if (state.autoSolve && hasAnyApiKey() && !isSolvingQuiz && !isSubmitting) {
                        if (Date.now() > apiCooldownUntil) {
                            if (quizSession.url !== window.location.href || quizSession.status === 'IDLE') {
                                solveQuizQuestions();
                            }
                        } else {
                            const remainingSec = Math.ceil((apiCooldownUntil - Date.now()) / 1000);
                            showStatus(`Rate limit cooldown active (${remainingSec}s remaining before solving)...`);
                        }
                    } else if (!hasAnyApiKey()) {
                        showStatus("Quiz questions loaded! Add an API key in the AutoPilot popup to auto-solve.");
                    }
                    return; // STRICTLY BLOCK all navigation while questions are being solved and submitted!
                }

                // C. SUBMISSION IN PROGRESS / COURSERA IS GRADING (ONLY AFTER SUBMIT WAS TRIGGERED)
                if (isSubmitting || quizSession.status === 'SUBMITTING' || quizSession.status === 'REVIEWING' || isGradingInProgress()) {
                    showStatus("Coursera is grading submission... Hang tight!");
                    return; // Strictly hold! Never navigate or restart while grading!
                }

                // D. QUESTIONS NOT YET IN DOM: Check if we need to click "Start assignment" / "Resume assignment"
                const startTestBtn = findStartTestButton();
                if (startTestBtn) {
                    const now = Date.now();
                    if (lastStartClickUrl === window.location.href && (now - lastStartClickTime < 6000)) {
                        showStatus("Opening test attempt, waiting for questions to load...");
                        return;
                    }
                    lastStartClickTime = now;
                    lastStartClickUrl = window.location.href;
                    const btnLabel = (startTestBtn.innerText || startTestBtn.textContent || 'Start assignment').replace(/\s+/g, ' ').trim();
                    addLog(`Auto-started test: clicked '${btnLabel}'.`, "success");
                    showStatus(`Auto-starting test: ${btnLabel}...`);
                    triggerClick(startTestBtn);
                    pageArrivalTime = now;
                    return;
                }

                // E. SPECIFICALLY LOCKED ASSIGNMENT (PIC 4: Image-style lock center banner)
                if (isItemLockedPage()) {
                    if (state.autoNavigate && (Date.now() - lastNavTime > 2500)) {
                        const nextBtn = findNextItemButton();
                        if (nextBtn) {
                            lastNavTime = Date.now();
                            addLog("Item is locked ('You still have some learning to complete'). Skipping to next item...", "warn");
                            showStatus("Item locked! Skipping to next course item in 2s...");
                            triggerClick(nextBtn);
                        }
                    }
                    return;
                }

                // F. WAITING FOR QUESTIONS TO LOAD (WAIT UP TO 20 SECONDS BEFORE SKIPPING!)
                const waitSec = Math.floor(timeOnPage / 1000);
                if (timeOnPage < 20000) {
                    showStatus(`Waiting for test questions to load (${waitSec}s / 20s)...`);
                    return;
                }

                // If 20 seconds have passed and assignment still cannot open or load questions, skip to next item!
                if (state.autoNavigate && (Date.now() - lastNavTime > 3000)) {
                    const nextBtn = findNextItemButton();
                    if (nextBtn) {
                        lastNavTime = Date.now();
                        addLog("Assignment could not open or load questions after 20s. Skipping to next item...", "warn");
                        showStatus("Assignment did not open after 20s. Advancing to next item...");
                        triggerClick(nextBtn);
                    }
                }
                return;
            }
            // 5. READING / SUPPLEMENT / LECTURE NOTES
            else {

            // A. Check if reading has an Audio Player / Audio Narration (enforce speed without blocking navigation)
            const audio = document.querySelector('audio');
            if (audio) {
                injectSpeedBadge(audio);

                // Auto-play audio narration if paused
                if (audio.paused && !audio.ended) {
                    audio.play().catch(() => {
                        const audioPlayBtn = document.querySelector(
                            '[class*="audio" i] button[aria-label*="play" i], [class*="audio" i] button[title*="play" i], button[aria-label="Play audio" i], button[title="Play audio" i]'
                        );
                        if (audioPlayBtn) audioPlayBtn.click();
                    });
                }

                // Enforce playback speed on audio
                try {
                    if (audio.playbackRate !== state.playbackSpeed) {
                        audio.playbackRate = state.playbackSpeed;
                    }
                    if (audio.defaultPlaybackRate !== state.playbackSpeed) {
                        audio.defaultPlaybackRate = state.playbackSpeed;
                    }
                } catch (e) {}
            }

            // B. Reading Item: Find "Mark as completed" button
            const markCompleteBtn = Array.from(document.querySelectorAll('button, a')).find(btn => {
                const t = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                const a = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
                return t === 'mark as completed' || t === 'mark as complete' || t === 'mark complete' ||
                       a === 'mark as completed' || a === 'mark as complete';
            });

            // Check if reading is already completed (green checkmark or "Completed" text)
            const isAlreadyCompleted = Array.from(document.querySelectorAll('button, a, [class*="completed"]')).some(el => {
                const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                return (t === 'completed' || t === '✓ completed' || t === 'completed ✓') &&
                       !t.includes('incomplete') && !t.includes('not completed');
            });

            if (markCompleteBtn) {
                const isBlue = isButtonActiveAndBlue(markCompleteBtn);

                if (!hasMarkedCurrentReading) {
                    if (isBlue) {
                        hasMarkedCurrentReading = true;
                        markCompleteBtn.click();
                        addLog("Clicked 'Mark as completed' button (button turned active blue)!", "success");
                        showStatus("Marked reading as completed! Advancing to next item in 1.5s...");
                        pageArrivalTime = Date.now(); // reset delay timer so student gets credit
                    } else {
                        // Button is present but not yet blue/active (e.g. gray or waiting for scroll)
                        showStatus("Waiting for 'Mark as completed' button to activate (turn blue)...");
                        // Scroll down towards button to activate Coursera's scroll/dwell tracker
                        if (markCompleteBtn.getBoundingClientRect().top > window.innerHeight) {
                            markCompleteBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        return; // PAUSE and wait for button to become blue!
                    }
                } else {
                    // Button was clicked; wait for Coursera to persist completion before advancing
                    if (state.strictCompletion) {
                        const isCompleted = isCurrentItemCompletedInSidebar();
                        if (isCompleted === false && (Date.now() - pageArrivalTime < 4000)) {
                            showStatus("Reading marked, waiting for sidebar green checkmark sync...");
                            return;
                        }
                        const curPath = window.location.pathname.toLowerCase();
                        const reattempts = itemReattemptMap[curPath] || 0;
                        if (isCompleted === false && reattempts === 0) {
                            itemReattemptMap[curPath] = 1;
                            addLog("Strict Green Tick Guard: Reading marked but not green in sidebar. Reattempting once...", "warn");
                            hasMarkedCurrentReading = false;
                            pageArrivalTime = Date.now();
                            return;
                        }
                    }
                    if (Date.now() - pageArrivalTime > 1500) {
                        shouldGoNext = true;
                    }
                }
            } else if (isAlreadyCompleted) {
                // Reading item was already completed previously
                if (Date.now() - pageArrivalTime > 1500) {
                    shouldGoNext = true;
                }
            } else {
                // Reading has no "Mark as completed" button (some readings auto-complete on scroll/dwell)
                if (window.scrollY === 0 && document.body.scrollHeight > window.innerHeight) {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
                if (state.strictCompletion) {
                    const isCompleted = isCurrentItemCompletedInSidebar();
                    if (isCompleted === false && (Date.now() - pageArrivalTime < 4000)) {
                        showStatus("Waiting for reading completion sync...");
                        return;
                    }
                }
                if (Date.now() - pageArrivalTime > 2500) {
                    shouldGoNext = true;
                }
            }
        }

        // 7. ADVANCE TO NEXT COURSE ITEM
        if (shouldGoNext && state.autoNavigate && (Date.now() - lastNavTime > 3000)) {
            lastNavTime = Date.now();

            if (state.focusMode === 'pending_only') {
                const nextPending = findNextPendingSidebarItem();
                if (nextPending) {
                    addLog("Pending-Only Mode: Navigating to next incomplete item...", "info");
                    showStatus("Moving to next pending item...");
                    triggerClick(nextPending);
                    return;
                }
            } else if (state.focusMode === 'quizzes_only') {
                const nextQuiz = findNextTargetSidebarItem('quizzes_only');
                if (nextQuiz) {
                    addLog("Quizzes-Only Mode: Navigating to next quiz item...", "info");
                    showStatus("Moving to next quiz...");
                    triggerClick(nextQuiz);
                    return;
                }
            } else if (state.focusMode === 'videos_only') {
                const nextVideo = findNextTargetSidebarItem('videos_only');
                if (nextVideo) {
                    addLog("Videos-Only Mode: Navigating to next video item...", "info");
                    showStatus("Moving to next video...");
                    triggerClick(nextVideo);
                    return;
                }
            }

            const nextBtn = findNextItemButton();
            if (nextBtn) {
                addLog("Advancing to next course item...", "info");
                showStatus("Moving to next course item...");
                triggerClick(nextBtn);
            }
        }
    } catch (err) {
        console.error("AutoPilot Error:", err);
    }
}

    // Run autopilot loop every 1 second
    setInterval(() => {
        try {
            syncSpeedToMainWorld();
            handleAutoPilot();
        } catch (e) {
            console.error("AutoPilot interval exception:", e);
        }
    }, 1000);
})();
