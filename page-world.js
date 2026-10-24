/**
 * سادىر پالۋان قالقىنى (Sadir Palwan Qalqini) v2.3.0
 * Zero-Black-Screen MAIN-World Engine (Object.prototype Trap + Instant Player API Skipper)
 */

(function () {
  'use strict';

  let shieldEnabled = true;
  let lastCountTime = 0;

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SADIR_SHIELD_STATE') {
      shieldEnabled = Boolean(e.data.enabled);
    }
  });

  function notifyAdBlocked(count = 1) {
    const now = Date.now();
    if (now - lastCountTime < 800) return;
    lastCountTime = now;
    try {
      window.postMessage({ type: 'SADIR_AD_BLOCKED', count }, '*');
    } catch (_) {}
  }

  const isYouTube = location.hostname.includes('youtube.com') || location.hostname.includes('youtu.be');

  if (isYouTube) {
    // A. Trap Object.prototype.adPlacements, playerAds, and adSlots!
    // Whenever YouTube creates ANY object containing adPlacements or playerAds, it immediately returns an empty array []!
    const trappedKeys = ['adPlacements', 'playerAds', 'adSlots'];
    trappedKeys.forEach((prop) => {
      try {
        Object.defineProperty(Object.prototype, prop, {
          configurable: true,
          enumerable: false,
          get() {
            return shieldEnabled ? undefined : this['_' + prop];
          },
          set(val) {
            if (shieldEnabled && val) {
              notifyAdBlocked(1);
              Object.defineProperty(this, '_' + prop, {
                value: [],
                writable: true,
                configurable: true,
                enumerable: false
              });
            } else {
              Object.defineProperty(this, '_' + prop, {
                value: val,
                writable: true,
                configurable: true,
                enumerable: true
              });
            }
          }
        });
      } catch (_) {}
    });

    // B. Deep Pruner for any parsed JSON
    const YT_AD_KEYS = [
      'adPlacements',
      'playerAds',
      'adSlots',
      'adBreakHeartbeatParams',
      'instreamAdPlayerOverlayRenderer',
      'linearAdSequenceRenderer',
      'actionCompanionAdRenderer',
      'promotedSparklesWebRenderer'
    ];

    function pruneYouTubePayload(obj) {
      if (!shieldEnabled || !obj || typeof obj !== 'object') return obj;
      let found = false;

      function walk(node, depth) {
        if (!node || typeof node !== 'object' || depth > 7) return;
        for (const k of YT_AD_KEYS) {
          if (Object.prototype.hasOwnProperty.call(node, k)) {
            found = true;
            delete node[k];
          }
        }
        if (node.playerResponse && typeof node.playerResponse === 'object') walk(node.playerResponse, depth + 1);
        if (node.contents && typeof node.contents === 'object') walk(node.contents, depth + 1);
      }

      try {
        walk(obj, 0);
        if (found) notifyAdBlocked(1);
      } catch (_) {}
      return obj;
    }

    // Hook JSON.parse & Response.prototype.json
    const origParse = JSON.parse;
    JSON.parse = function (...args) {
      const res = origParse.apply(this, args);
      if (shieldEnabled && res && typeof res === 'object') {
        pruneYouTubePayload(res);
      }
      return res;
    };

    const origJson = Response.prototype.json;
    Response.prototype.json = async function (...args) {
      const data = await origJson.apply(this, args);
      if (shieldEnabled && data && typeof data === 'object') {
        pruneYouTubePayload(data);
      }
      return data;
    };

    // C. Direct YouTube #movie_player Internal API Controller (Eliminates 6s / 15s Black Screen!)
    function instantSkipViaPlayerAPI() {
      if (!shieldEnabled) return;
      try {
        const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (!player) return;

        const isAdShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
        if (!isAdShowing) return;

        // 1. Click any native skip button inside Shadow DOM or main DOM
        const skipBtns = player.querySelectorAll(
          '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[id^="skip-button"]'
        );
        skipBtns.forEach((b) => {
          try { b.click(); } catch (_) {}
        });

        // 2. Call YouTube's internal player methods if available
        if (typeof player.skipAd === 'function') {
          try { player.skipAd(); } catch (_) {}
        }
        if (typeof player.finishAd === 'function') {
          try { player.finishAd(); } catch (_) {}
        }

        // 3. Fast-forward the underlying HTML5 video stream to its exact end without freezing
        const video = player.querySelector('video.html5-main-video') || player.querySelector('video');
        if (video) {
          video.muted = true;
          video.playbackRate = 16;
          if (Number.isFinite(video.duration) && video.duration > 0.1) {
            video.currentTime = Math.max(0, video.duration - 0.05);
            video.play().catch(() => {});
          } else if (typeof player.getDuration === 'function') {
            const d = player.getDuration();
            if (Number.isFinite(d) && d > 0.1 && typeof player.seekTo === 'function') {
              player.seekTo(d, true);
            }
          }
        }

        notifyAdBlocked(1);
      } catch (_) {}
    }

    // Run high-speed check every 50ms so an ad never sits on a black screen
    setInterval(instantSkipViaPlayerAPI, 50);
  }

  // Universal Pop-under Blocker
  const origOpen = window.open;
  window.open = function (url) {
    if (shieldEnabled && url && typeof url === 'string') {
      const lower = url.toLowerCase();
      if (
        lower.includes('doubleclick') ||
        lower.includes('popads') ||
        lower.includes('popcash') ||
        lower.includes('propellerads') ||
        lower.includes('adsterra') ||
        lower.includes('exoclick')
      ) {
        notifyAdBlocked(1);
        return null;
      }
    }
    return origOpen.apply(this, arguments);
  };
})();
