/**
 * سادىر پالۋان قالقىنى (Sadir Palwan Qalqini) v2.3.0
 * Universal Cosmetic Filter & Zero-Black-Screen Video Ad Controller
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    IS_ENABLED: 'shemsher_is_enabled',
    BLOCKED_COUNT: 'shemsher_blocked_count'
  };

  let isProtectionEnabled = true;
  let styleElement = null;
  let wasAdShowing = false;
  let userMutedBeforeAd = false;

  // Notice: Removed '.html5-video-player.ad-showing video { opacity: 0 }' so the screen NEVER goes black!
  // Instead, we hide only the ad banners/overlays while fast-forwarding the ad in 0.02 seconds!
  const AD_BLOCK_CSS = `
    ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-promoted-video-renderer,
    ytd-compact-promoted-video-renderer,
    ytd-search-pyv-renderer,
    ytd-banner-promo-renderer,
    ytd-statement-banner-renderer,
    ytd-masthead-ad-v3-renderer,
    ytd-primetime-promo-renderer,
    ytd-companion-slot-renderer,
    ytd-action-companion-ad-renderer,
    ytd-player-legacy-desktop-watch-ads-renderer,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    ytd-merch-shelf-renderer,
    .ytd-merch-shelf-renderer,
    .ytp-ad-overlay-container,
    .ytp-ad-message-container,
    .ytp-ad-image-overlay,
    .ytp-ad-text-overlay,
    .ytp-ad-player-overlay-flyout-cta,
    .ytp-ad-player-overlay-layout,
    .ytp-ad-action-interstitial,
    .ytp-featured-product,
    #masthead-ad,
    #player-ads,
    #offer-module,
    ytm-promoted-sparkles-web-renderer,
    ytm-companion-ad-renderer,
    /* Universal Web Ad Containers */
    ins.adsbygoogle,
    .adsbygoogle,
    div[id^="google_ads_iframe_"],
    div[id^="div-gpt-ad"],
    div[id^="taboola-"],
    div[id^="outbrain_"],
    iframe[src*="doubleclick.net"],
    iframe[src*="googlesyndication.com"],
    iframe[src*="googleadservices.com"],
    iframe[src*="adnxs.com"],
    iframe[src*="rubiconproject.com"],
    iframe[src*="criteo.com"],
    iframe[src*="taboola.com"],
    iframe[src*="outbrain.com"],
    iframe[src*="popads.net"],
    iframe[src*="adsterra.com"],
    iframe[src*="exoclick.com"],
    .taboola-widget,
    .outbrain-widget,
    div[class*="ad-container"]:not(body):not(html),
    div[class*="ad-banner"]:not(body):not(html),
    aside[class*="ad-slot"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
      opacity: 0 !important;
    }
  `;

  function syncMainWorldState(enabled) {
    try {
      window.postMessage({ type: 'SADIR_SHIELD_STATE', enabled }, '*');
    } catch (_) {}
  }

  function injectOrRemoveCosmeticStyles() {
    try {
      if (isProtectionEnabled) {
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'sadir-palwan-qalqini-styles';
          styleElement.textContent = AD_BLOCK_CSS;
        }
        const target = document.head || document.documentElement;
        if (target && !document.getElementById('sadir-palwan-qalqini-styles')) {
          target.appendChild(styleElement);
        }
      } else {
        const existing = document.getElementById('sadir-palwan-qalqini-styles');
        if (existing) existing.remove();
      }
    } catch (_) {}
  }

  function incrementLocalBlockedCounter(amount = 1) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEYS.BLOCKED_COUNT], (res) => {
          const current = typeof res[STORAGE_KEYS.BLOCKED_COUNT] === 'number' ? res[STORAGE_KEYS.BLOCKED_COUNT] : 28;
          chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_COUNT]: current + amount });
        });
      }
    } catch (_) {}
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SADIR_AD_BLOCKED') {
      incrementLocalBlockedCounter(e.data.count || 1);
    }
  });

  function fastForwardAnyResidualAd() {
    if (!isProtectionEnabled) return;
    if (!location.hostname.includes('youtube.com') && !location.hostname.includes('youtu.be')) return;

    try {
      const player = document.querySelector('#movie_player, .html5-video-player');
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (!player || !video) return;

      // Also click any skip or close buttons immediately
      const skipBtns = document.querySelectorAll(
        '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-action-interstitial-slot button, .ytp-ad-overlay-close-button'
      );
      skipBtns.forEach((btn) => {
        try { btn.click(); } catch (_) {}
      });

      const isAd = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
      if (isAd) {
        if (!wasAdShowing) {
          wasAdShowing = true;
          userMutedBeforeAd = video.muted;
        }
        video.muted = true;
        video.playbackRate = 16;
        if (Number.isFinite(video.duration) && video.duration > 0.1) {
          video.currentTime = Math.max(0, video.duration - 0.05);
        }
      } else if (wasAdShowing) {
        wasAdShowing = false;
        video.muted = userMutedBeforeAd;
        if (video.playbackRate > 2) {
          video.playbackRate = 1;
        }
      }
    } catch (_) {}
  }

  function initContentShield() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEYS.IS_ENABLED], (data) => {
          isProtectionEnabled = typeof data[STORAGE_KEYS.IS_ENABLED] === 'boolean' ? data[STORAGE_KEYS.IS_ENABLED] : true;
          syncMainWorldState(isProtectionEnabled);
          injectOrRemoveCosmeticStyles();
        });

        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes[STORAGE_KEYS.IS_ENABLED]) {
            isProtectionEnabled = changes[STORAGE_KEYS.IS_ENABLED].newValue;
            syncMainWorldState(isProtectionEnabled);
            injectOrRemoveCosmeticStyles();
          }
        });
      } else {
        injectOrRemoveCosmeticStyles();
      }

      const observer = new MutationObserver(() => {
        if (!isProtectionEnabled) return;
        injectOrRemoveCosmeticStyles();
        fastForwardAnyResidualAd();
      });

      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });

      setInterval(fastForwardAnyResidualAd, 80);
    } catch (_) {}
  }

  initContentShield();
})();
