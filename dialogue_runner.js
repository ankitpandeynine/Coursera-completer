// ============================================================================
// Coursera AI AutoPilot - Dedicated Dialogue Runner (v10.0)
// High-precision, zero-loop, to-the-point AI coach dialogue automation.
// ============================================================================

(function () {
    'use strict';

    // Module internal state
    let isGeneratingResponse = false;
    let responseStartTime = 0;
    let lastSentAnswer = '';
    let lastMessageSentTime = 0;
    let lastAnsweredQuestion = '';
    let lastNavTime = 0;
    let lastStartDialogueClickTime = 0;
    const sentDialogueAnswers = [];

    // Helper: Safe extension ID check
    function isExtensionValid() {
        try {
            return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && typeof chrome.runtime.getManifest === 'function';
        } catch (e) {
            return false;
        }
    }

    // Helper: Find chat input field (textarea or contenteditable)
    function findChatInput() {
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
            const els = Array.from(document.querySelectorAll(sel));
            for (const el of els) {
                if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) {
                    if (!el.closest('aside, nav, [role="navigation"], .rc-CourseNavigation, [class*="sidebar" i]')) {
                        return el;
                    }
                }
            }
        }
        return null;
    }

    // Helper: Find chat send button
    function findSendButton(inputEl) {
        if (inputEl) {
            const parent = inputEl.closest('form, [class*="composer" i], [class*="input" i], [class*="chat" i], [class*="footer" i], .cds-FullscreenDialog-bottomBar, div[class*="css-t7gn38"]') || inputEl.parentElement?.parentElement;
            if (parent) {
                const btn = parent.querySelector('button[aria-label*="send" i], button[data-testid*="send" i], button[title*="send" i], button[aria-label*="submit" i]') ||
                            Array.from(parent.querySelectorAll('button')).find(b => {
                                if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                                const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                                return t === 'send' || aria.includes('send') || (!!b.querySelector('svg') && !aria.includes('mic'));
                            });
                if (btn) return btn;
            }
        }
        return document.querySelector('button[aria-label*="send" i], button[data-testid*="send" i]');
    }

    // Helper: React input setter
    function setReactInputValue(el, value) {
        if (!el) return;
        try { el.focus(); } catch (e) {}

        if (el.isContentEditable) {
            el.innerText = value;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        const tracker = el._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }

        try {
            el.select();
            const success = document.execCommand('insertText', false, value);
            if (success && el.value === value) {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        } catch (e) {}

        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
            desc.set.call(el, value);
        } else {
            el.value = value;
        }

        try { el.selectionStart = el.selectionEnd = value.length; } catch (e) {}
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        try {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
        } catch (e) {}
    }

    // Helper: Find the genuine dialogue conversation container
    function getConversationContainer() {
        const input = findChatInput();
        if (input) {
            let curr = input.parentElement;
            let best = null;
            while (curr && curr !== document.body) {
                if (curr.matches && curr.matches('aside, nav, [role="navigation"], .rc-CourseNavigation, [class*="sidebar" i]')) {
                    break;
                }
                const txt = (curr.innerText || '').trim();
                // Ensure container has real text beyond just the input
                if (txt.length > 60) {
                    best = curr;
                    if (curr.tagName === 'MAIN' || curr.getAttribute('role') === 'main' || 
                        curr.classList.contains('cds-FullscreenDialog-scrollContainer') ||
                        curr.querySelector('h1, h2, [data-testid*="coach" i]')) {
                        return curr;
                    }
                }
                curr = curr.parentElement;
            }
            if (best) return best;
        }

        const main = document.querySelector('main, [role="main"], article, #rendered-content');
        if (main && (main.innerText || '').trim().length > 60) {
            return main;
        }

        return document.body;
    }

    // Helper: Get clean full text of dialogue (stripped of sidebar & composer buttons)
    function getCleanDialogueText(container) {
        const c = container || getConversationContainer();
        const clone = c.cloneNode(true);

        clone.querySelectorAll(
            'nav, aside, header, [role="navigation"], [class*="navigation" i], [class*="drawer" i], ' +
            '[class*="sidebar" i], [class*="CourseItem" i], [data-testid*="nav" i], ' +
            'button, svg, [role="button"], textarea, input, form, [class*="composer" i]'
        ).forEach(el => el.remove());

        let txt = (clone.innerText || clone.textContent || '').trim();
        txt = txt.replace(/Dialogue is powered by AI[\s\S]*$/i, '');
        txt = txt.replace(/Send a message\s*$/i, '');
        txt = txt.replace(/End Dialogue\s*$/i, '');
        txt = txt.replace(/I'm stuck\s*$/i, '');
        return txt.trim();
    }

    // Helper: Detect student message bubbles directly from the DOM
    function detectStudentMessagesFromDOM(container) {
        const c = container || getConversationContainer();
        const studentMessages = [];
        const allElements = Array.from(c.querySelectorAll('div, p, [class*="bubble" i], [class*="message" i]'));

        for (const el of allElements) {
            if (el.closest('form, [class*="composer" i], [class*="input" i], aside, nav, header')) continue;
            
            const style = window.getComputedStyle(el);
            const bg = style.backgroundColor;
            const radius = parseInt(style.borderRadius) || 0;
            const isRightAligned = style.alignSelf === 'flex-end' || style.marginLeft === 'auto' || style.textAlign === 'right';
            const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)';

            if ((hasBg && radius >= 6) || isRightAligned || el.getAttribute('data-testid')?.includes('user')) {
                const txt = (el.innerText || '').trim();
                if (txt.length >= 15 && !txt.includes('Dialogue is powered by AI') && !txt.includes('Send a message')) {
                    if (!studentMessages.some(m => m.includes(txt) || txt.includes(m))) {
                        studentMessages.push(txt);
                    }
                }
            }
        }
        return studentMessages;
    }

    // Core Extractor: Extract the LATEST coach question
    function extractLatestCoachQuestion(container) {
        const c = container || getConversationContainer();
        const fullCleanText = getCleanDialogueText(c);

        // Populate known student answers from DOM if local array is empty (e.g. after refresh)
        if (sentDialogueAnswers.length === 0) {
            const domStudentAnswers = detectStudentMessagesFromDOM(c);
            for (const a of domStudentAnswers) {
                if (!sentDialogueAnswers.includes(a)) {
                    sentDialogueAnswers.push(a);
                    lastSentAnswer = a;
                }
            }
        }

        // Strategy 1: Find latest coach feedback action buttons (🗎 👍 👎)
        const actionBtns = Array.from(c.querySelectorAll('button, [role="button"], div[tabindex="0"]')).filter(b => {
            if (b.closest('form, [class*="composer" i], [class*="input" i], aside, nav, header')) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const title = (b.getAttribute('title') || '').toLowerCase();
            const testId = (b.getAttribute('data-testid') || '').toLowerCase();
            const hasSvg = !!b.querySelector('svg');
            return hasSvg && (aria.includes('thumb') || aria.includes('helpful') || aria.includes('like') || 
                              aria.includes('copy') || title.includes('thumb') || title.includes('helpful') || 
                              title.includes('copy') || testId.includes('thumb') || testId.includes('copy'));
        });

        if (actionBtns.length > 0) {
            const latestAction = actionBtns[actionBtns.length - 1];
            let current = latestAction.parentElement;
            while (current && current !== c && current !== document.body) {
                const clone = current.cloneNode(true);
                clone.querySelectorAll('button, svg, textarea, input, form, [class*="composer" i]').forEach(el => el.remove());
                let txt = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
                txt = txt.replace(/Dialogue is powered by AI[\s\S]*$/i, '').trim();
                txt = txt.replace(/^AI Coach:?\s*/i, '').trim();

                const containsOldStudentAns = sentDialogueAnswers.length > 0 && sentDialogueAnswers.some(ans => {
                    const normAns = ans.slice(0, 30).toLowerCase();
                    return normAns.length >= 10 && txt.toLowerCase().includes(normAns);
                });

                if (txt.length > 25 && !containsOldStudentAns) {
                    return txt;
                }
                current = current.parentElement;
            }
        }

        // Strategy 2: Extract text following the last sent student answer
        if (sentDialogueAnswers.length > 0) {
            const lastAns = lastSentAnswer || sentDialogueAnswers[sentDialogueAnswers.length - 1];
            const cleanAns = lastAns.replace(/\s+/g, ' ').trim();
            const candidates = [
                cleanAns.slice(0, 40),
                cleanAns.slice(10, 50),
                cleanAns.slice(-30),
                cleanAns.slice(0, 25)
            ].filter(s => s && s.length >= 10);

            for (const snip of candidates) {
                const idx = fullCleanText.lastIndexOf(snip);
                if (idx !== -1) {
                    let after = fullCleanText.slice(idx + snip.length).trim();
                    const endSnip = cleanAns.slice(-20);
                    const endIdx = after.indexOf(endSnip);
                    if (endIdx !== -1) {
                        after = after.slice(endIdx + endSnip.length).trim();
                    }
                    after = after.replace(/Dialogue is powered by AI[\s\S]*$/i, '').trim();
                    if (after.length > 15) {
                        return after;
                    }
                }
            }
        }

        // Strategy 3: Turn 1 (before student answers)
        let turn1 = fullCleanText;
        if (/Start Dialogue/i.test(turn1)) {
            const parts = turn1.split(/Start Dialogue["']?/i);
            turn1 = parts[parts.length - 1];
        }
        turn1 = turn1.replace(/^[\s\S]*?(?=Great|Welcome|Let's|In this|During this|Hello|To get started|What is|Can you|Could you)/i, '').trim();
        turn1 = turn1.replace(/Dialogue is powered by AI[\s\S]*$/i, '').trim();
        if (turn1.length > 15) {
            return turn1;
        }

        // Strategy 4: Tail paragraphs of clean text
        const paras = fullCleanText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 15);
        if (paras.length > 0) {
            return paras.slice(-2).join('\n\n');
        }

        return fullCleanText;
    }

    // Answer Sanitizer: Strip JSON, quotes, LaTeX, markdown, and unwanted meta-talk
    function cleanDialogueAnswer(rawText) {
        if (!rawText || typeof rawText !== 'string') return '';
        let text = rawText.trim();

        // 1. JSON parse fallback
        if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const first = parsed[0];
                    text = typeof first === 'string' ? first : (first.response || first.answer || first.text || text);
                } else if (typeof parsed === 'object' && parsed !== null) {
                    text = parsed.response || parsed.answer || parsed.text || text;
                }
            } catch (e) {}
        }

        // 2. Aggressively strip AI conversational prefixes, meta-commentary, and question repetition
        let prevText = '';
        while (prevText !== text) {
            prevText = text;
            text = text.replace(/^Based on (?:the )?(?:conversation|transcript|dialogue|history)[^:\n]*:?\s*(?:"[^"\n]*"\s*)?(?:Direct student answer:?)?\s*/i, '').trim();
            text = text.replace(/^(?:The latest question (?:from the AI coach )?is:[^\n]*\n?)+(?:Direct student answer:?)?\s*/i, '').trim();
            text = text.replace(/^(?:QUESTION ASKED BY [^:\n]*:?\s*(?:"[^"\n]*"\s*)?)+\s*/i, '').trim();
            text = text.replace(/^(?:Direct student answer|Student answer|Student response|Direct answer|My answer|Answer|Response):?\s*/i, '').trim();
            text = text.replace(/^(?:Here (?:is|are) (?:the|a) [^\n:]*(?:coach|response|answer|reply|solution|simplification)?:?|As a student,?|Certainly!?|Sure!?)\s*[:\-\n]*/i, '').trim();
            text = text.replace(/^(?:I(?:'m| am) ready to (?:start|begin)(?: the dialogue)?\.?|Please proceed with the first question\.?)\s*/i, '').trim();
        }

        // 3. Clean LaTeX math expressions so equations appear as clean plain text
        text = text.replace(/\\cdot/g, '·').replace(/\\times/g, '*').replace(/\\le(?:q)?\b/g, '<=').replace(/\\ge(?:q)?\b/g, '>=').replace(/\\ne(?:q)?\b/g, '!=');
        text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
        text = text.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
        text = text.replace(/\$\$([^\$]+)\$\$/g, '$1').replace(/\$([^\$]+)\$/g, '$1');
        text = text.replace(/\\\((.*?)\\\)/g, '$1').replace(/\\\[(.*?)\\\]/g, '$1');

        // 4. Strip markdown bold, italics, headers, bullets, tables
        text = text.replace(/^#{1,6}\s+/gm, '');
        text = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/__(.*?)__/g, '$1').replace(/_(.*?)_/g, '$1');
        text = text.replace(/^[\*\-•]\s+/gm, '');
        text = text.split('\n').filter(line => !line.trim().startsWith('|')).join('\n');
        text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
        text = text.replace(/`([^`]+)`/g, '$1');
        text = text.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
        text = text.replace(/^\{+\s*/, '').replace(/\s*\}+$/, '');
        text = text.replace(/\n{3,}/g, '\n\n').trim();

        return text;
    }

    // Helper: Completion check
    function isDialogueCompleted() {
        const input = findChatInput();
        if (input && input.offsetWidth > 0 && input.offsetHeight > 0 && !input.disabled) {
            return false;
        }

        const text = (document.body ? document.body.textContent || '' : '').toLowerCase();
        return text.includes('the dialogue has ended') ||
               text.includes('start a new chat to clear your chat history') ||
               (text.includes("you've completed") && text.includes("topic")) ||
               text.includes('good job, you have completed') ||
               text.includes('you have completed all the topics') ||
               text.includes('up next - view your feedback') ||
               (text.includes('your strengths') && (text.includes('areas for improvement') || text.includes("during today's session")));
    }

    // ========================================================================
    // MAIN DIALOGUE HANDLER
    // ========================================================================
    async function handleDialogue(options = {}) {
        const {
            showStatus = () => {},
            addLog = () => {},
            triggerClick = (el) => el?.click(),
            findNextItemButton = () => null,
            findNextPendingSidebarItem = () => null,
            findNextTargetSidebarItem = () => null,
            getCourseSlugFromUrl = () => 'default_course',
            hasAnyApiKey = () => true,
            autoNavigate = true,
            focusMode = 'normal'
        } = options;

        // Stage 3: Completed / Summary page
        if (isDialogueCompleted()) {
            if (autoNavigate && (Date.now() - lastNavTime > 2000)) {
                const nextBtn = findNextItemButton();
                if (nextBtn) {
                    lastNavTime = Date.now();
                    addLog("Dialogue completed! Advancing to next course item...", "success");
                    showStatus("Dialogue complete! Moving to next course item...");
                    triggerClick(nextBtn);
                    return;
                }
                const nextSidebar = findNextPendingSidebarItem() || findNextTargetSidebarItem(focusMode);
                if (nextSidebar) {
                    lastNavTime = Date.now();
                    addLog("Dialogue completed! Advancing to next sidebar item...", "success");
                    showStatus("Advancing to next item in sidebar...");
                    triggerClick(nextSidebar);
                    return;
                }
            }
            showStatus("Dialogue complete! Waiting to navigate...");
            return;
        }

        // Stage 0: Modal confirmation check ('End Dialogue' modal confirmation)
        const confirmModalBtn = Array.from(document.querySelectorAll('[role="dialog"] button, .cds-dialog button, div[class*="modal" i] button')).find(b => {
            if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
            const t = (b.innerText || b.textContent || '').trim().toLowerCase();
            return t === 'end dialogue' || t === 'end' || t === 'confirm' || t === 'yes';
        });
        if (confirmModalBtn) {
            addLog("Detected open 'End Dialogue' modal. Confirming session end...", "info");
            triggerClick(confirmModalBtn);
            return;
        }

        // Stage 1: Start Dialogue button
        const startDialogueBtn = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(b => {
            if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
            const t = (b.innerText || b.textContent || '').trim().toLowerCase();
            return t === 'start dialogue' || t === 'begin dialogue' || (t.includes('start dialogue') && t.length < 30);
        });

        if (startDialogueBtn && startDialogueBtn.offsetWidth > 0 && startDialogueBtn.offsetHeight > 0) {
            const now = Date.now();
            if (now - lastStartDialogueClickTime > 4000) {
                lastStartDialogueClickTime = now;
                addLog("Found 'Start Dialogue' button. Initiating AI Dialogue...", "info");
                showStatus("Starting AI Dialogue session...");
                triggerClick(startDialogueBtn);
            }
            return;
        }

        // Stage 2: Active Dialogue Chat Input
        const chatInput = findChatInput();
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

        // Watchdog: clear generating lock if stuck > 25s
        if (isGeneratingResponse) {
            if (Date.now() - responseStartTime > 25000) {
                addLog("AI response generation timed out after 25s. Resetting lock...", "warn");
                isGeneratingResponse = false;
            } else {
                showStatus(`Thinking and drafting response for AI coach (Turn ${sentDialogueAnswers.length + 1})...`);
                return;
            }
        }

        // Mandatory 5s interval after sending each message
        const elapsedSinceLastSend = Date.now() - lastMessageSentTime;
        if (lastMessageSentTime > 0 && elapsedSinceLastSend < 5000) {
            const waitSec = Math.ceil((5000 - elapsedSinceLastSend) / 1000);
            showStatus(`Response sent! Waiting ${waitSec}s before checking next turn...`);
            return;
        }

        const container = getConversationContainer();
        const fullCleanText = getCleanDialogueText(container);

        // Check if coach is requesting "Generate final session summary"
        if (/Generate final session summary/i.test(fullCleanText.slice(-300))) {
            const summaryCmd = "Generate final session summary";
            if (lastAnsweredQuestion !== summaryCmd) {
                lastAnsweredQuestion = summaryCmd;
                lastMessageSentTime = Date.now();
                addLog("Coach requested session summary. Submitting 'Generate final session summary'...", "info");
                showStatus("Submitting 'Generate final session summary' to coach...");
                
                setReactInputValue(chatInput, summaryCmd);
                await new Promise(r => setTimeout(r, 600));

                const sendBtn = findSendButton(chatInput);
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.removeAttribute('aria-disabled');
                    triggerClick(sendBtn);
                }
                await new Promise(r => setTimeout(r, 400));
                chatInput.focus();
                chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                chatInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                chatInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                return;
            }
        }

        // Extract the specific latest question asked by the coach
        const latestCoachQuestion = extractLatestCoachQuestion(container);
        if (!latestCoachQuestion || latestCoachQuestion.length < 10) {
            showStatus("Waiting for AI coach message...");
            return;
        }

        // Check if coach has responded to our last sent message
        let coachHasReplied = false;
        if (sentDialogueAnswers.length === 0) {
            coachHasReplied = true;
        } else {
            const lastAns = lastSentAnswer || sentDialogueAnswers[sentDialogueAnswers.length - 1];
            const cleanAns = lastAns.replace(/\s+/g, ' ').trim();
            const normAns = cleanAns.slice(0, 30).toLowerCase();

            if (!latestCoachQuestion.toLowerCase().includes(normAns) && latestCoachQuestion.length > 15) {
                coachHasReplied = true;
            } else {
                // Secondary check: if 12s passed and chat input is enabled and empty
                if (elapsedSinceLastSend > 12000 && !chatInput.disabled && chatInput.value === '') {
                    coachHasReplied = true;
                }
            }
        }

        if (!coachHasReplied) {
            showStatus(`Response sent (Turn ${sentDialogueAnswers.length})! Waiting for AI coach reply...`);
            return;
        }

        // Deduplication: Avoid re-answering the exact same question
        const normQ = latestCoachQuestion.replace(/\s+/g, ' ').trim();
        if (normQ === lastAnsweredQuestion && elapsedSinceLastSend < 15000) {
            showStatus(`Waiting for AI coach to respond to Turn ${sentDialogueAnswers.length}...`);
            return;
        }

        if (!hasAnyApiKey()) {
            showStatus("Dialogue scenario loaded! Add an API key in the AutoPilot popup to auto-respond.");
            return;
        }

        isGeneratingResponse = true;
        responseStartTime = Date.now();
        lastAnsweredQuestion = normQ;
        const currentTurn = sentDialogueAnswers.length + 1;

        addLog(`AI Coach Turn ${currentTurn}: Answering latest coach question: "${latestCoachQuestion.slice(0, 70)}..."`, "info");
        showStatus(`Thinking and drafting response for AI coach (Turn ${currentTurn})...`);

        const systemPrompt = `You are a knowledgeable university student directly answering a question asked by your course instructor in an interactive Coursera learning dialogue.

STRICT INSTRUCTIONS (MANDATORY):
1. Answer the question DIRECTLY, accurately, and immediately.
2. Output ONLY the factual, conceptual student answer in 1-2 concise academic paragraphs (3-5 sentences total).
3. ABSOLUTELY NO commentary, conversational intros, or meta-talk. NEVER say "Based on the conversation history", "The latest question is", "Direct student answer:", "Here is the answer", "Certainly", "Sure", "I am ready", or "As a student".
4. NEVER repeat or quote the question. Start immediately with the core answer.
5. NO markdown headings (#, ##), NO bullet lists, NO markdown bold/italics (**), NO tables, and NO JSON/brackets. Plain academic text only.
6. NO LaTeX formatting or dollar signs (e.g., write A + B, never $A + B$). Keep all formulas and equations in plain standard text.`;

        const prompt = `QUESTION ASKED BY INSTRUCTOR:
"${latestCoachQuestion}"

Provide your direct, to-the-point student answer to the above question right now. Output ONLY your answer text without any comments, intros, or repeating the question.`;

        const courseSlug = getCourseSlugFromUrl();

        if (!isExtensionValid()) {
            isGeneratingResponse = false;
            return;
        }

        try {
            chrome.runtime.sendMessage({
                type: 'ASK_AI',
                prompt: prompt,
                systemPrompt: systemPrompt,
                courseSlug: courseSlug
            }, async (response) => {
                try {
                    if (chrome.runtime?.lastError) {
                        addLog(`Dialogue message error: ${chrome.runtime.lastError.message}`, "warn");
                        return;
                    }

                    if (response && response.success && response.text) {
                        let answer = cleanDialogueAnswer(response.text);
                        if (!answer || answer.length < 5 || /^I(?:'m| am) ready to (?:start|begin)/i.test(answer)) {
                            answer = response.text.replace(/^Based on [\s\S]*?Direct student answer:?\s*/i, '').trim();
                            answer = cleanDialogueAnswer(answer);
                        }
                        if (!answer || answer.length < 5) {
                            answer = response.text.trim();
                        }

                        addLog(`Generated student response (${answer.length} chars). Typing into chat...`, "info");
                        await new Promise(r => setTimeout(r, 600));

                        const inputEl = findChatInput();
                        if (inputEl) {
                            setReactInputValue(inputEl, answer);
                            await new Promise(r => setTimeout(r, 600));

                            const sendBtn = findSendButton(inputEl);
                            if (sendBtn) {
                                sendBtn.disabled = false;
                                sendBtn.removeAttribute('aria-disabled');
                                triggerClick(sendBtn);
                            }

                            await new Promise(r => setTimeout(r, 400));
                            inputEl.focus();
                            inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                            inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                            inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                            if (inputEl.form && typeof inputEl.form.requestSubmit === 'function') {
                                try { inputEl.form.requestSubmit(); } catch (e) {}
                            }

                            sentDialogueAnswers.push(answer);
                            lastSentAnswer = answer;
                            lastMessageSentTime = Date.now();
                            addLog(`Sent response to Coursera AI (Turn ${currentTurn})!`, "success");
                            showStatus(`Response sent (Turn ${currentTurn})! Waiting 5s before next turn...`);
                        }
                    } else {
                        addLog(`Dialogue AI error: ${response?.error || 'No response'}`, "warn");
                    }
                } catch (e) {
                    addLog(`Error during dialogue submission: ${e.message}`, "error");
                } finally {
                    isGeneratingResponse = false;
                }
            });
        } catch (err) {
            isGeneratingResponse = false;
            addLog(`Failed to send dialogue request: ${err.message}`, "warn");
        }
    }

    // Expose to window for content.js and easy interactive debugging in DevTools
    window.CourseraDialogueRunner = {
        handleDialogue,
        findChatInput,
        findSendButton,
        extractLatestCoachQuestion,
        cleanDialogueAnswer,
        isDialogueCompleted,
        getConversationContainer,
        detectStudentMessagesFromDOM,
        resetState: () => {
            isGeneratingResponse = false;
            sentDialogueAnswers.length = 0;
            lastSentAnswer = '';
            lastMessageSentTime = 0;
            lastAnsweredQuestion = '';
        }
    };

})();
