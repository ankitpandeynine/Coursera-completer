# ⚡ Coursera AI AutoPilot (v9.8)

<p align="center">
  <img src="icons/icon128.png" alt="Coursera AI AutoPilot Logo" width="110" height="110" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0, 86, 210, 0.4);">
</p>

<p align="center">
  <b>The ultimate autonomous study assistant for Coursera.</b><br>
  Automates video playback with server-safe speed spoofing, skips popups, completes readings, passes AI dialogue sessions, and solves practice quizzes with multi-provider AI (Gemini, Groq, OpenRouter, NVIDIA).
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-9.8-0056D2?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Manifest-V3-success?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/AI%20Providers-Gemini%20%7C%20Groq%20%7C%20OpenRouter%20%7C%20NVIDIA-8A2BE2?style=flat-square" alt="AI Providers">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License">
</p>

---

## ✨ Features

* **🧠 Multi-Provider AI Quiz Auto-Solver (Radios, Checkboxes & Free-Text Fields):** Automatically parses practice quiz questions, code snippets, multiple-choice options, formulas, and free-text/fill-in-the-blank input fields. Dynamically queries AI models, fills text answers via React state synchronization, marks correct choices, agrees to honor codes, and submits assignments.
* **💬 Multi-Turn AI Coach & Dialogue Automation:** Automatically converses with Coursera's interactive AI Dialogue coach across every turn. Reads replies from the coach, tracks conversation history, drafts humanized technical answers, types and sends replies, and clicks "End Dialogue" with modal confirmation upon completion.
* **🛡️ Strict Green Tick Confirmation & Reattempt-Once Safeguard:** Inspects the sidebar outline to verify items are marked green before advancing. If an item or video is completed but not marked green, the extension reattempts it strictly once and proceeds forward, ensuring courses are 100% completed without getting stuck in infinite loops.
* **⏱️ Global Stuck Watchdogs (3-Min Auto-Refresh & 2-Min Auto-Skip):** If a page freezes or remains stuck for more than 3 minutes, the extension automatically refreshes the page once to unfreeze the session. If stuck for more than 2 minutes without video playback, it automatically advances to the next item.
* **⏩ Optimized Hybrid Speed Force Engine:** Seamlessly enforces playback speeds (0.25x - 16x) with pitch correction without stalling video buffering or causing media playback freezes.
* **🎯 Course Focus Modes:**
  * **🎯 Complete All Items:** Sequentially completes all videos, readings, discussions, and quizzes.
  * **🧠 Practice Quizzes Only:** Skips videos and readings, jumping directly to practice questions and quizzes.
  * **🎬 Videos & Readings Only:** Focuses exclusively on lectures and readings, skipping quizzes and assignments.
  * **⚡ Incomplete Items Only:** Skips every item already marked green in the sidebar, jumping straight to pending items.
* **👻 True Background Play:** Overrides visibility APIs (`document.hidden`, `visibilityState`) so lectures keep playing even when you switch tabs or minimize the window.
* **⏭️ Smart Auto-Navigation:** Detects video conclusion, passing grades, or completed readings and transitions to the next course item seamlessly.
* **🛑 In-Video Checkpoint & Popup Skipper:** Bypasses mid-video pause checkpoints, practice popups, and dismisses alert dialogs.
* **⏱️ Locked Module Discrimination:** Automatically identifies locked assignments (`"You still have some learning to complete"`) or items taking longer than 20s to load, gracefully advancing without infinite loops.

---

## 🔑 How to Get Free AI API Keys

The extension requires an API key from at least **one** of the supported providers to auto-solve quizzes and dialogues. All supported providers offer generous **100% free tiers**:

| Provider | Recommended Model | Free Tier? | Link |
| :--- | :--- | :--- | :--- |
| **Google Gemini** *(Recommended)* | `gemini-2.5-flash` / `gemini-1.5-flash` | **Yes (Free tier)** | [Get Gemini Key](https://aistudio.google.com/app/apikey) |
| **Groq Cloud** | `llama-3.3-70b-versatile` | **Yes (Ultra-fast & Free)** | [Get Groq Key](https://console.groq.com/keys) |
| **OpenRouter** | `deepseek-chat` / `free` models | **Yes (Free tier)** | [Get OpenRouter Key](https://openrouter.ai/keys) |
| **NVIDIA NIM** | `meta/llama-3.1-70b-instruct` | **Yes (Free 1,000 credits)** | [Get NVIDIA Key](https://build.nvidia.com/) |

---

### Step-by-Step API Key Setup Guides

#### 1. Google Gemini API (Recommended)
1. Go to [Google AI Studio (aistudio.google.com)](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click the blue **"Create API key"** button.
4. Select or create any Google Cloud project, then click **"Create API key in existing project"**.
5. Copy your key (starts with `AIzaSy...`).

#### 2. Groq Cloud API
1. Visit the [Groq Console](https://console.groq.com/keys).
2. Sign in with Google or GitHub.
3. Click **"Create API Key"**, give it a name (e.g., `Coursera AutoPilot`), and copy your key (starts with `gsk_...`).

#### 3. OpenRouter API
1. Go to [OpenRouter Keys](https://openrouter.ai/keys).
2. Sign up or log in.
3. Click **"Create Key"**, assign a name, and copy the generated token (starts with `sk-or-...`).

#### 4. NVIDIA NIM API
1. Go to [NVIDIA Build](https://build.nvidia.com/).
2. Click **Sign In** in the top right.
3. Select any model (e.g., *Meta Llama 3.1 70B*) and click **"Get API Key"**.
4. Generate and copy your NVIDIA token (starts with `nvapi-...`).

---

## 📥 How to Paste API Keys into the Extension

1. **Open the Extension Popup:**
   * Click the **Coursera AutoPilot icon (cA logo)** in your Chrome browser extensions toolbar (pin it if it's hidden under the puzzle icon 🧩).
2. **Navigate to the Controls / Settings Tab:**
   * In the popup, make sure you are on the **⚡ Controls** tab.
3. **Enter Your Key:**
   * Scroll down to the **"AI Provider API Keys"** section.
   * Paste your copied key into the corresponding field:
     * **Gemini API Key:** Paste your `AIzaSy...` key here.
     * **Groq API Key:** Paste your `gsk_...` key here.
     * **OpenRouter API Key:** Paste your `sk-or-...` key here.
     * **NVIDIA API Key:** Paste your `nvapi-...` key here.
4. **Enable Automation:**
   * Toggle **"Auto-Solve Quizzes"** to **ON**.
   * Toggle **"Auto-Navigate"** to **ON**.
   * Pick your preferred primary provider from the dropdown (or leave as Google Gemini).
5. **Done!** Your key is automatically saved to your local browser storage. The extension will automatically test and cycle through models with automatic failover!

---

## 🛠️ Installation Guide (Chrome / Edge / Brave)

1. **Download or Clone the Repository:**
   ```bash
   git clone https://github.com/ankitpandeynine/Coursera-completer.git
   ```
   *(Or download the ZIP from GitHub and extract it to a folder).*

2. **Open the Extensions Manager:**
   * In Google Chrome, go to `chrome://extensions/`
   * In Microsoft Edge, go to `edge://extensions/`
   * In Brave, go to `brave://extensions/`

3. **Enable Developer Mode:**
   * Toggle the **"Developer mode"** switch in the top-right corner.

4. **Load the Extension:**
   * Click **"Load unpacked"** in the top-left corner.
   * Select the folder containing `manifest.json`.

5. **Pin the Extension:**
   * Click the puzzle icon 🧩 in your browser toolbar and pin **Coursera AI AutoPilot**.

---

## 🎮 How to Use on Coursera

1. Open any Coursera course page (e.g., `coursera.org/learn/...`).
2. Click the **Coursera AutoPilot** icon in your toolbar, enter your API key, and configure your desired playback speed (e.g., `3.0x`).
3. Click on any video, reading, or assignment.
4. **Hands-free Automation:**
   * **Videos:** Plays automatically at chosen speed, skips checkpoints, and auto-navigates upon completion.
   * **Readings:** Waits the required duration and clicks *"Mark as completed"*.
   * **Quizzes & Assignments:** Detects questions, queries Gemini/Groq, marks correct answers, accepts honor codes, and submits.
   * **AI Dialogues:** Reads scenarios, writes humanized student responses, and submits replies to Coursera AI coaches.

---

## 📁 File Structure

```
├── manifest.json            # Manifest V3 extension configuration
├── background.js           # Ephemeral multi-provider AI dispatcher & failover engine
├── content.js              # Core automation engine, quiz solver & route coordinator
├── main_world.js           # Stealth speed-spoofing engine & visibility spoofer
├── popup.html              # Modern, sleek extension control interface
├── popup.js                # Settings manager, real-time log streaming & solution viewer
├── icons/                  # High-resolution extension brand icons (16, 32, 48, 128px)
├── CHROMEWEBSTORE.md       # Chrome Web Store metadata & store description
└── scratch/                # Unit test suites & automated validation scripts
```

---

## 🔒 Privacy & Security

* **Local Storage Only:** API keys and credentials never leave your browser; they are saved strictly in `chrome.storage.local`.
* **Direct Official Endpoints:** Requests are made directly from your browser to official provider APIs (`googleapis.com`, `groq.com`, `openrouter.ai`, `nvidia.com`). No third-party proxy servers are involved.

---

## ⚠️ Disclaimer

*This extension is created for educational and productivity research purposes. Please ensure you review course concepts and engage with the learning material. The authors assume no liability for individual platform usage.*

---

**Made with ❤️ by [ankitpandeynine](https://github.com/ankitpandeynine)**
