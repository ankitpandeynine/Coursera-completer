# 🚀 Coursera Ultimate AutoPilot

Welcome to **Coursera Ultimate AutoPilot**! This Chrome extension is designed to completely automate your Coursera learning experience. Sit back and let the extension handle the videos, readings, pop-ups, and navigation for you.

---

## ✨ Features

* **⏩ Speed Spoofing (Bypass Limits):** Watch videos at blazing fast speeds (default 3.0x, up to 16.0x). The extension tricks Coursera's servers into thinking you are watching at 1.0x, so your progress is always saved without errors.
* **👻 Background Play:** Switching tabs or minimizing the window? No problem. This extension forces Coursera to keep playing your video even when the tab is hidden.
* **⏭️ Auto-Navigate:** Automatically clicks the blue "Go to next item" button the exact second a video finishes or a module is cleared.
* **📖 Reading Auto-Complete:** Lands on a reading page? The extension waits out the mandatory 30-second timer and automatically clicks "Mark as completed", then instantly jumps to the next lecture.
* **🛑 Pop-Up Skipper:** Instantly detects and clicks "Skip" on any mid-video quizzes or prompts so your flow is never interrupted.
* **🔇 Error Handler:** Automatically detects and closes annoying "Skipping forward is only available..." error banners.

---

## 🛠️ Installation Guide (Chrome / Edge)

Since this extension is not on the Chrome Web Store, you will need to install it manually using Developer Mode. It only takes 30 seconds!

1. **Download the Code**
   Click the green **Code** button at the top of this repository and select **Download ZIP**. Extract the ZIP file to a folder on your computer. (Alternatively, you can `git clone` the repo).
2. **Open Extensions Page**
   Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/` if you are on Edge).
3. **Enable Developer Mode**
   Toggle the **Developer mode** switch in the top right corner of the screen.
4. **Load the Extension**
   Click the **Load unpacked** button in the top left corner.
5. **Select the Folder**
   Select the unzipped folder containing the extension files (make sure you select the folder that contains the `manifest.json` file).
6. **Pin It!**
   Click the puzzle piece icon 🧩 in your browser toolbar and "pin" the Coursera Auto-Pilot extension so you can access the menu easily.

---

## 🎮 How to Use

Once installed, the extension runs entirely in the background. 

1. Navigate to any Coursera course.
2. Click on the first video or reading material.
3. **Hands off!** The extension will take over, auto-playing the video, answering prompts, and clicking to the next items.
4. **Customize Settings:** Click the extension icon in your browser toolbar to open the popup menu. From here, you can:
   * Adjust your forced playback speed (1x to 16x).
   * Toggle Background Play on or off.
   * Toggle the Master Auto-Navigator on or off.

---

## 📂 File Structure

* `manifest.json`: The configuration file that tells Chrome how to load the extension.
* `content.js`: The "brain" of the extension. It constantly scans the visible webpage to auto-click buttons, detect reading timers, and handle navigation.
* `main_world.js`: The stealth script. It overrides the browser's native video player functions to safely spoof your playback speed back to Coursera's servers.
* `popup.html` & `popup.js`: The user interface and logic for the extension's dropdown menu.

---

## ⚠️ Disclaimer

This extension is built for educational purposes and personal use. Please ensure you are actually learning the material! The creator is not responsible for any actions taken by Coursera regarding your account for using automated tools. 

---
**Made with ❤️ by [ankitpandeynine](https://github.com/ankitpandeynine)**
