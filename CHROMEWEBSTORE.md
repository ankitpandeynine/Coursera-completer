# Chrome Web Store Listing — Coursera AI AutoPilot

> Last Updated: 2026-09-21

## Store Listing

**Extension Name**
Coursera AI AutoPilot

**Short Description**
Automates video speed, background playback, reading completion, and answers quizzes accurately with Google Gemini AI.

**Detailed Description**
Coursera AI AutoPilot simplifies and accelerates your learning journey on Coursera.

Key Features:
- Custom Video Playback Speed: Watch lecture videos at any speed from 0.5x up to 16x with an intuitive on-screen overlay control and keyboard shortcuts.
- Continuous Background Playback: Keep lecture videos playing smoothly even when switching tabs or multitasking in other windows.
- Auto-Skip In-Video Checkpoints: Automatically bypasses or continues past in-video question overlays without manual clicking.
- Automatic Course Navigation: Moves seamlessly to the next lecture or reading assignment when your current item finishes.
- Smart AI Quiz Solver: Leverages Google Gemini AI to analyze complex questions, mathematical formulas, and code snippets, accurately selecting answers and submitting practice quizzes and assignments.

How to Use:
1. Install the extension.
2. Click the extension icon to set your preferred playback speed and enter your Google AI Studio API key.
3. Open any Coursera course video, reading, or assignment.
4. Let AutoPilot manage playback, background listening, and quiz solving automatically!

Privacy Note:
Your Gemini API key is stored strictly on your local device via Chrome's secure storage. No personal data, browsing history, or user credentials are collected or sent to external servers.

**Category**
Productivity

**Single Purpose**
Automates video playback speed, background play, and quiz completion on Coursera.

**Primary Language**
English

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Saves user preferences such as preferred playback speed, background play toggle, and the user's Google AI Studio API key locally. |
| `https://generativelanguage.googleapis.com/*` | host_permissions | Communicates with the Google AI Studio Gemini API from the extension service worker to analyze questions and generate quiz solutions. |

## Privacy & Data Use

### Data Collection
- Does this extension collect user data? No.
- The user's Gemini API key is saved locally in `chrome.storage.local` to authenticate requests directly against Google's Gemini API. No third-party servers are used.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 8.0 | 2026-09-21 | Modularized codebase into 3 dedicated feature files (`video_playback.js`, `background_playback.js`, `ai_solver.js`). Added Main-World Page Visibility API spoofing for background play. Fixed modern Coursera item navigation and LaTeX equation parsing. |
| 7.0 | 2026-08-03 | Speed enforcement and structured Gemini solver flow. |
