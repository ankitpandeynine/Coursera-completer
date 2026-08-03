document.addEventListener('DOMContentLoaded', () => {
    const speedInput = document.getElementById('speedInput');
    const bgPlayCB = document.getElementById('bgPlayCB');
    const autoNavigateCB = document.getElementById('autoNavigateCB');

    chrome.storage.local.get(['playbackSpeed', 'bgPlay', 'autoNavigate'], (data) => {
        // Set default to 3
        speedInput.value = data.playbackSpeed !== undefined ? data.playbackSpeed : 3;
        bgPlayCB.checked = data.bgPlay !== undefined ? data.bgPlay : true;
        autoNavigateCB.checked = data.autoNavigate !== undefined ? data.autoNavigate : true;
    });

    speedInput.addEventListener('change', () => {
        const val = parseFloat(speedInput.value) || 1;
        chrome.storage.local.set({ playbackSpeed: val });
    });

    bgPlayCB.addEventListener('change', () => {
        chrome.storage.local.set({ bgPlay: bgPlayCB.checked });
    });

    autoNavigateCB.addEventListener('change', () => {
        chrome.storage.local.set({ autoNavigate: autoNavigateCB.checked });
    });
});