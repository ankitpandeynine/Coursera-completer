// ============================================================================
// Coursera AI AutoPilot - Dedicated Discussion Prompt Runner (v10.0)
// High-precision automated academic discussion response generator and submitter.
// ============================================================================

(function () {
    'use strict';

    // Module internal state
    let isGeneratingResponse = false;
    let responseStartTime = 0;
    let lastReplySubmitTime = 0;
    let lastNavTime = 0;
    const repliedPromptUrls = new Set();

    // Helper: Safe extension ID check
    function isExtensionValid() {
        try {
            return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && typeof chrome.runtime.getManifest === 'function';
        } catch (e) {
            return false;
        }
    }

    // Helper: Is this page a discussion prompt item?
    function isDiscussionPromptItem(url = window.location.href) {
        try {
            const u = new URL(url);
            const p = u.pathname.toLowerCase();
            if (p.includes('/discussionprompt/') || p.includes('/prompt/') || p.includes('/discussions/')) {
                return true;
            }
        } catch (e) {}

        // Never hijack video pages
        if (document.querySelector('video')) {
            return false;
        }

        // Never hijack coach dialogue pages
        if (window.CourseraDialogueRunner && typeof window.CourseraDialogueRunner.isDialogueOrCoachItem === 'function') {
            if (window.CourseraDialogueRunner.isDialogueOrCoachItem(url)) return false;
        }

        // Check main container
        const mainEl = document.querySelector('main, [role="main"], article, #rendered-content, .cds-FullscreenDialog-scrollContainer');
        if (mainEl) {
            const mainText = (mainEl.textContent || '');

            // Check for explicit Coursera Discussion Prompt markers
            const hasDiscussionMarkers = 
                mainText.includes('Questions for discussion:') ||
                mainText.includes('Your Reply') ||
                mainText.includes('Tips for writing posts:') ||
                mainText.includes('Tips for responding to peer responses:');

            const hasReplyInput = !!findDiscussionReplyInput();
            const hasReplyButton = Array.from(mainEl.querySelectorAll('button')).some(b => {
                const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                return t === 'reply' || t === 'post reply' || t === 'submit reply';
            });

            if (hasDiscussionMarkers || (hasReplyInput && hasReplyButton)) {
                return true;
            }
        }

        return false;
    }

    // Helper: Check if already replied
    function isDiscussionAlreadyReplied() {
        const curUrl = window.location.href;
        if (repliedPromptUrls.has(curUrl) && (Date.now() - lastReplySubmitTime > 2000)) {
            return true;
        }

        // Check DOM for user submitted post indicators
        const mainEl = document.querySelector('main, [role="main"], article, #rendered-content, .cds-FullscreenDialog-scrollContainer');
        if (mainEl) {
            // Check if there is an "Edit reply" or "Delete reply" button
            const hasEditOrDelete = Array.from(mainEl.querySelectorAll('button, a')).some(el => {
                const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                return t === 'edit reply' || t === 'delete reply' || t === 'edit post' || t === 'delete post';
            });
            if (hasEditOrDelete) return true;

            // Check if user's reply container shows completed or posted confirmation
            const postedConfirmation = Array.from(mainEl.querySelectorAll('[class*="success" i], [role="alert"], [class*="alert" i]')).some(el => {
                const t = (el.innerText || el.textContent || '').toLowerCase();
                return t.includes('reply posted') || t.includes('your reply has been posted') || t.includes('response submitted');
            });
            if (postedConfirmation) return true;
        }

        return false;
    }

    // Helper: Find reply input element (Draft.js, Slate, Quill, contenteditable, or textarea)
    function findDiscussionReplyInput() {
        // 1. ContentEditable with placeholder / aria-label matching response / reply
        const contentEditables = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"], .public-DraftEditor-content, [data-slate-editor="true"], .ql-editor'));
        for (const el of contentEditables) {
            if (el.closest('aside, nav, header, [role="navigation"], [role="search"], [data-testid="coach-conversation"], [class*="dialogue" i]')) {
                continue;
            }
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.isContentEditable) continue;
            return el;
        }

        // 2. Textarea with placeholder or aria-label matching response / reply
        const textareas = Array.from(document.querySelectorAll('textarea'));
        for (const el of textareas) {
            if (el.closest('aside, nav, header, [role="navigation"], [role="search"], [data-testid="coach-conversation"], [class*="dialogue" i]')) {
                continue;
            }
            const placeholder = (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
            if (placeholder.includes('response') || placeholder.includes('reply') || placeholder.includes('type')) {
                return el;
            }
            // Check if inside "Your Reply" card
            const replyContainer = el.closest('[class*="reply" i], [class*="composer" i], [class*="comment" i], div');
            if (replyContainer && /Your Reply/i.test(replyContainer.textContent || '')) {
                return el;
            }
        }

        // 3. Fallback: Any visible textarea inside main content
        const mainEl = document.querySelector('main, [role="main"], article, #rendered-content, .cds-FullscreenDialog-scrollContainer');
        if (mainEl) {
            const ta = Array.from(mainEl.querySelectorAll('textarea')).find(t => !t.disabled && (t.offsetWidth > 0 || t.offsetHeight > 0));
            if (ta) return ta;
        }

        return null;
    }

    // Helper: Find reply submit button
    function findDiscussionReplyButton(inputEl) {
        // 1. Look inside the parent container / card of the input element
        let container = inputEl ? inputEl.closest('[class*="reply" i], [class*="composer" i], [class*="comment" i], form, [data-testid*="reply" i]') : null;
        if (!container && inputEl) {
            let parent = inputEl.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                if (/Your Reply/i.test(parent.textContent || '')) {
                    container = parent;
                    break;
                }
                parent = parent.parentElement;
            }
        }

        if (container) {
            const btn = Array.from(container.querySelectorAll('button')).find(b => {
                const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                const a = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                return t === 'reply' || t === 'post' || t === 'post reply' || t === 'submit reply' ||
                       a === 'reply' || a === 'post reply' || a === 'submit reply';
            });
            if (btn) return btn;
        }

        // 2. Global search inside main, nearest to inputEl
        const mainEl = document.querySelector('main, [role="main"], article, #rendered-content, .cds-FullscreenDialog-scrollContainer') || document.body;
        const allButtons = Array.from(mainEl.querySelectorAll('button')).filter(b => {
            if (b.closest('aside, nav, header, footer, [role="navigation"], [role="search"]')) return false;
            const t = (b.innerText || b.textContent || '').trim().toLowerCase();
            const a = (b.getAttribute('aria-label') || '').trim().toLowerCase();
            return t === 'reply' || t === 'post reply' || t === 'submit reply' || a === 'reply';
        });

        if (allButtons.length > 0) {
            if (inputEl) {
                const inputRect = inputEl.getBoundingClientRect();
                allButtons.sort((a, b) => {
                    const rectA = a.getBoundingClientRect();
                    const rectB = b.getBoundingClientRect();
                    return Math.abs(rectA.top - inputRect.bottom) - Math.abs(rectB.top - inputRect.bottom);
                });
            }
            return allButtons[0];
        }

        return null;
    }

    // Helper: Type into editor with full React / Draft.js / Slate event firing
    function typeIntoEditor(el, text) {
        if (!el) return;
        try { el.focus(); } catch (e) {}

        const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

        if (isContentEditable) {
            try {
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(el);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) {}

            let inserted = false;
            try {
                inserted = document.execCommand('insertText', false, text);
            } catch (e) {
                inserted = false;
            }

            if (!inserted || !(el.innerText || el.textContent || '').trim()) {
                el.innerText = text;
            }

            try {
                const InputEv = typeof InputEvent !== 'undefined' ? InputEvent : (typeof window !== 'undefined' ? window.InputEvent : null);
                if (InputEv) {
                    el.dispatchEvent(new InputEv('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
                    el.dispatchEvent(new InputEv('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
                } else {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (e) {
                try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (err) {}
            }
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            try {
                const KeyEv = typeof KeyboardEvent !== 'undefined' ? KeyboardEvent : (typeof window !== 'undefined' ? window.KeyboardEvent : null);
                if (KeyEv) {
                    el.dispatchEvent(new KeyEv('keydown', { bubbles: true, key: ' ' }));
                    el.dispatchEvent(new KeyEv('keyup', { bubbles: true, key: ' ' }));
                }
            } catch (e) {}
            return;
        }

        // Textarea / Input
        const tracker = el._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }

        try {
            el.select();
            const success = document.execCommand('insertText', false, text);
            if (success && el.value === text) {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        } catch (e) {}

        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
            desc.set.call(el, text);
        } else {
            el.value = text;
        }

        try { el.selectionStart = el.selectionEnd = text.length; } catch (e) {}
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Helper: Extract prompt topic, context, and questions
    function extractDiscussionPromptDetails() {
        const mainEl = document.querySelector('main, [role="main"], article, #rendered-content, .cds-FullscreenDialog-scrollContainer') || document.body;

        // Title
        let title = '';
        const titleEl = mainEl.querySelector('h1, h2, [data-testid*="title"], [class*="title" i]');
        if (titleEl) {
            title = (titleEl.innerText || titleEl.textContent || '').trim();
        }

        // Content
        let fullText = (mainEl.innerText || mainEl.textContent || '').replace(/\r\n/g, '\n').trim();

        // Cut off tips, instructions, and reply section
        let cleanText = fullText;
        const cutoffPatterns = [
            /Tips for writing posts/i,
            /Tips for responding to peer responses/i,
            /Participation is optional/i,
            /Your Reply/i,
            /Comments\s*\(\d+\)/i
        ];
        for (const pattern of cutoffPatterns) {
            const idx = cleanText.search(pattern);
            if (idx !== -1) {
                cleanText = cleanText.substring(0, idx).trim();
            }
        }

        return {
            title: title || 'Course Discussion',
            promptText: cleanText || fullText
        };
    }

    // Helper: Clean AI response text
    function cleanDiscussionAnswer(rawText) {
        if (!rawText || typeof rawText !== 'string') return '';
        let text = rawText.trim();

        // 1. Strip code fences first
        text = text.replace(/```(?:json)?\s*\n?/gi, '').replace(/```/g, '').trim();

        // 2. JSON parsing if wrapped in brackets
        if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    text = typeof parsed[0] === 'string' ? parsed[0] : (parsed[0].response || parsed[0].answer || Object.values(parsed[0])[0] || text);
                } else if (typeof parsed === 'object' && parsed !== null) {
                    text = parsed.response || parsed.answer || parsed.text || parsed.reply || Object.values(parsed)[0] || text;
                }
            } catch (e) {
                const match = text.match(/"(?:response|answer|text|reply)"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
                if (match && match[1]) {
                    text = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
            }
        }

        // 3. Strip conversational intro prefixes
        text = text.replace(/^(?:Here is(?:\s+(?:my|a))?(?:\s+(?:discussion\s+)?(?:response|reply|answer|post))?|Below is(?:\s+(?:my|a))?(?:\s+(?:discussion\s+)?(?:response|reply|answer|post))?|Sure(?:\s+thing)?|Certainly|My\s+response|Student\s+response|Response|Answer)\s*:\s*/i, '');
        text = text.replace(/^Based on (?:the|these) questions?[\s\S]*?(?:answer|response):?\s*/i, '');

        // 4. Strip markdown bold headers like **Question 1:** or ### Heading
        text = text.replace(/^#+\s+[^\n]+\n+/gm, '');
        text = text.replace(/^\*\*Response:?\*\*\s*/i, '');

        // 5. Normalize whitespace
        text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

        return text;
    }

    // Main Discussion Handler
    async function handleDiscussionPrompt(options = {}) {
        const {
            showStatus = () => {},
            addLog = () => {},
            triggerClick = (el) => el?.click(),
            findNextItemButton = () => null,
            findNextPendingSidebarItem = () => null,
            findNextTargetSidebarItem = () => null,
            getCourseSlugFromUrl = () => 'default_course',
            hasAnyApiKey = () => false,
            autoNavigate = true,
            focusMode = 'all'
        } = options;

        const curUrl = window.location.href;

        // 1. If currently generating response from AI, hold and show progress
        if (isGeneratingResponse) {
            const elapsed = Math.floor((Date.now() - responseStartTime) / 1000);
            if (elapsed > 60) {
                // Timeout safeguard
                isGeneratingResponse = false;
                addLog("Discussion AI generation timed out (60s). Retrying...", "warn");
            } else {
                showStatus(`Generating academic discussion response with AI (${elapsed}s)...`);
                return;
            }
        }

        // 2. Check if this discussion prompt was already replied to or completed
        if (isDiscussionAlreadyReplied() || (repliedPromptUrls.has(curUrl) && Date.now() - lastReplySubmitTime > 2000)) {
            if (autoNavigate && (Date.now() - lastNavTime > 3000)) {
                lastNavTime = Date.now();
                addLog("Discussion prompt already submitted. Advancing to next item...", "info");
                showStatus("Discussion complete! Advancing to next course item...");

                if (focusMode === 'pending_only') {
                    const nextPending = findNextPendingSidebarItem();
                    if (nextPending) { triggerClick(nextPending); return; }
                } else if (focusMode === 'quizzes_only') {
                    const nextQuiz = findNextTargetSidebarItem('quizzes_only');
                    if (nextQuiz) { triggerClick(nextQuiz); return; }
                } else if (focusMode === 'videos_only') {
                    const nextVideo = findNextTargetSidebarItem('videos_only');
                    if (nextVideo) { triggerClick(nextVideo); return; }
                }

                const nextBtn = findNextItemButton();
                if (nextBtn) {
                    triggerClick(nextBtn);
                }
            }
            return;
        }

        // 3. Check for API keys
        if (!hasAnyApiKey()) {
            showStatus("Discussion prompt detected! Add an API key in AutoPilot popup to auto-respond.");
            return;
        }

        // 4. Find the editor input element
        const inputEl = findDiscussionReplyInput();
        if (!inputEl) {
            showStatus("Locating discussion reply editor...");
            return;
        }

        // Check if editor already has text entered (e.g. from user or previous fill)
        const currentInputText = (inputEl.value || inputEl.innerText || inputEl.textContent || '').trim();
        if (currentInputText.length > 20) {
            // Text already filled! Check if reply button is ready
            const replyBtn = findDiscussionReplyButton(inputEl);
            if (replyBtn && !replyBtn.disabled && replyBtn.getAttribute('aria-disabled') !== 'true') {
                addLog("Response text already present in editor. Clicking 'Reply'...", "info");
                showStatus("Submitting discussion reply...");
                triggerClick(replyBtn);
                repliedPromptUrls.add(curUrl);
                lastReplySubmitTime = Date.now();
                return;
            }
        }

        // 5. Extract prompt details and generate academic response
        isGeneratingResponse = true;
        responseStartTime = Date.now();

        const { title, promptText } = extractDiscussionPromptDetails();
        addLog(`Discussion prompt found: "${title}". Generating response with AI...`, "info");
        showStatus("Analyzing discussion questions with AI...");

        const systemPrompt = `You are an articulate university student participating in an academic course discussion forum. Provide a comprehensive, high-quality, academic paragraph response directly answering the discussion prompt.
Write in a clear, formal, and insightful academic tone.
Do NOT include greetings, intro phrases (like "Here is my response" or "In this discussion"), markdown headers, bullet lists, or meta-commentary.
Output ONLY the response text as one or two well-structured paragraphs ready to be submitted to the discussion board.`;

        const userPrompt = `Course Discussion Topic: ${title}\n\nPrompt & Questions:\n${promptText}\n\nWrite a complete, articulate academic student discussion reply answering these questions thoroughly.`;

        const courseSlug = getCourseSlugFromUrl();

        if (!isExtensionValid()) {
            isGeneratingResponse = false;
            return;
        }

        try {
            chrome.runtime.sendMessage({
                type: 'ASK_AI',
                prompt: userPrompt,
                systemPrompt: systemPrompt,
                courseSlug: courseSlug
            }, async (response) => {
                try {
                    if (chrome.runtime?.lastError) {
                        addLog(`Discussion API error: ${chrome.runtime.lastError.message}`, "warn");
                        isGeneratingResponse = false;
                        return;
                    }

                    if (response && response.success && response.text) {
                        const providerName = response.provider || 'AI';
                        const cleanedAnswer = cleanDiscussionAnswer(response.text);

                        if (!cleanedAnswer || cleanedAnswer.length < 15) {
                            addLog("AI generated an empty or too short response. Retrying...", "warn");
                            isGeneratingResponse = false;
                            return;
                        }

                        addLog(`✓ Academic response received from ${providerName} (${cleanedAnswer.length} chars). Typing into website...`, "success");
                        showStatus("Typing response into discussion editor...");

                        // Locate editor again in case DOM re-rendered
                        const activeInput = findDiscussionReplyInput();
                        if (activeInput) {
                            try {
                                activeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } catch (e) {}

                            await new Promise(r => setTimeout(r, 600));

                            // Type text into editor
                            typeIntoEditor(activeInput, cleanedAnswer);

                            await new Promise(r => setTimeout(r, 800));

                            // Find and click reply button
                            const replyBtn = findDiscussionReplyButton(activeInput);
                            if (replyBtn) {
                                if (replyBtn.disabled || replyBtn.getAttribute('aria-disabled') === 'true') {
                                    replyBtn.disabled = false;
                                    replyBtn.removeAttribute('disabled');
                                    replyBtn.setAttribute('aria-disabled', 'false');
                                }
                                triggerClick(replyBtn);
                                addLog("✓ Clicked 'Reply' button! Post submitted.", "success");
                                showStatus("Reply submitted! Advancing to next item in 2.5s...");
                                repliedPromptUrls.add(curUrl);
                                lastReplySubmitTime = Date.now();

                                // Proactively advance to next item after 2.5 seconds
                                setTimeout(() => {
                                    if (autoNavigate && (Date.now() - lastNavTime > 2000)) {
                                        lastNavTime = Date.now();
                                        if (focusMode === 'pending_only') {
                                            const nextPending = findNextPendingSidebarItem();
                                            if (nextPending) { triggerClick(nextPending); return; }
                                        } else if (focusMode === 'quizzes_only') {
                                            const nextQuiz = findNextTargetSidebarItem('quizzes_only');
                                            if (nextQuiz) { triggerClick(nextQuiz); return; }
                                        } else if (focusMode === 'videos_only') {
                                            const nextVideo = findNextTargetSidebarItem('videos_only');
                                            if (nextVideo) { triggerClick(nextVideo); return; }
                                        }
                                        const nextBtn = findNextItemButton();
                                        if (nextBtn) {
                                            addLog("Discussion reply confirmed. Advancing to next item...", "info");
                                            showStatus("Moving to next course item...");
                                            triggerClick(nextBtn);
                                        }
                                    }
                                }, 2500);
                            } else {
                                addLog("Response typed, but could not locate 'Reply' button.", "warn");
                            }
                        } else {
                            addLog("Could not find discussion input box to type response.", "error");
                        }
                    } else {
                        const err = response?.error || 'AI did not return text';
                        addLog(`Discussion AI request failed: ${err}`, "warn");
                        showStatus(`Discussion AI failed: ${err}`);
                    }
                } finally {
                    isGeneratingResponse = false;
                }
            });
        } catch (err) {
            isGeneratingResponse = false;
            addLog(`Failed to send discussion AI message: ${err.message}`, "warn");
        }
    }

    // Expose to window for content.js and testing
    window.CourseraDiscussionRunner = {
        isDiscussionPromptItem,
        isDiscussionAlreadyReplied,
        findDiscussionReplyInput,
        findDiscussionReplyButton,
        typeIntoEditor,
        extractDiscussionPromptDetails,
        cleanDiscussionAnswer,
        handleDiscussionPrompt,
        resetState: () => {
            isGeneratingResponse = false;
            repliedPromptUrls.clear();
            lastReplySubmitTime = 0;
            lastNavTime = 0;
        }
    };

})();
