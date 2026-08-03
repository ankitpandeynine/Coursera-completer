(function() {
    let forcedSpeed = 1.0;
    let spoofingActive = false;

    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!nativeDescriptor) return;

    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        get: function() {
            if (spoofingActive && forcedSpeed > 2.0) return 1.0; 
            return nativeDescriptor.get.call(this);
        },
        set: function(val) {
            if (spoofingActive && forcedSpeed > 1.0) {
                nativeDescriptor.set.call(this, forcedSpeed);
            } else {
                nativeDescriptor.set.call(this, val);
            }
        },
        configurable: true,
        enumerable: true
    });

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'COURSERA_FORCE_SPEED') {
            forcedSpeed = parseFloat(event.data.speed) || 1.0;
            spoofingActive = forcedSpeed > 1.0;
            document.querySelectorAll('video').forEach(video => {
                nativeDescriptor.set.call(video, forcedSpeed);
            });
        }
    });

    setInterval(() => {
        if (spoofingActive) {
            document.querySelectorAll('video').forEach(video => {
                if (video.playbackRate !== forcedSpeed) {
                    nativeDescriptor.set.call(video, forcedSpeed);
                }
            });
        }
    }, 500);
})();