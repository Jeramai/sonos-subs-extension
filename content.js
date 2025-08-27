/**
 * Manages the UI for the Sonos Subs extension, including a lyrics overlay
 * and a toggle button in the header.
 */
class SonosSubsUI {
  // --- Constants ---
  static #HEADER_BUTTON_ID = 'sonos-subs-header-button';
  static #OVERLAY_ID = 'sonos-subs-overlay';
  static #OVERLAY_CLOSE_ID = 'sonos-subs-overlay-close';
  static #OVERLAY_CONTENT_ID = 'sonos-subs-overlay-content';

  // SVG icons for the toggle button
  static #SUBTITLES_SVG = `<svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" fill="#FFFFFF" d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12ZM6 15.25C5.58579 15.25 5.25 15.5858 5.25 16C5.25 16.4142 5.58579 16.75 6 16.75H10C10.4142 16.75 10.75 16.4142 10.75 16C10.75 15.5858 10.4142 15.25 10 15.25H6ZM7.75 13C7.75 12.5858 7.41421 12.25 7 12.25H6C5.58579 12.25 5.25 12.5858 5.25 13C5.25 13.4142 5.58579 13.75 6 13.75H7C7.41421 13.75 7.75 13.4142 7.75 13ZM11.5 12.25C11.9142 12.25 12.25 12.5858 12.25 13C12.25 13.4142 11.9142 13.75 11.5 13.75H9.5C9.08579 13.75 8.75 13.4142 8.75 13C8.75 12.5858 9.08579 12.25 9.5 12.25H11.5ZM18.75 13C18.75 12.5858 18.4142 12.25 18 12.25H14C13.5858 12.25 13.25 12.5858 13.25 13C13.25 13.4142 13.5858 13.75 14 13.75H18C18.4142 13.75 18.75 13.4142 18.75 13ZM12.5 15.25C12.0858 15.25 11.75 15.5858 11.75 16C11.75 16.4142 12.0858 16.75 12.5 16.75H14C14.4142 16.75 14.75 16.4142 14.75 16C14.75 15.5858 14.4142 15.25 14 15.25H12.5ZM15.75 16C15.75 15.5858 16.0858 15.25 16.5 15.25H18C18.4142 15.25 18.75 15.5858 18.75 16C18.75 16.4142 18.4142 16.75 18 16.75H16.5C16.0858 16.75 15.75 16.4142 15.75 16Z" />
</svg>`;
  static #CLOSE_OVERLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  // --- Private instance fields ---
  #headerButton = null;
  #overlay = null;
  #overlayContent = null;
  #closeButton = null;
  #observer = null;
  #boundHandleNowPlaying = null; // To hold the bound event handler
  #boundHandleVolumeScroll = null;
  #volumeScrollTimeout = null; // For debouncing volume changes
  #headerButtonInitialized = false;
  #currentTrack = { trackName: null, artistName: null, lyrics: null };

  constructor() {
    this.#injectScript('patch.js');
    this.#waitForDOM();
    // Bind the handler once and store it so it can be removed later.
    this.#boundHandleNowPlaying = this.#handleNowPlaying.bind(this);
    this.#boundHandleVolumeScroll = this.#handleVolumeScroll.bind(this);
    window.addEventListener('message', this.#boundHandleNowPlaying);
    this.#setupCommandListener();
  }

  /**
   * Injects a script into the main page's context.
   * @param {string} filePath - The path to the script to inject.
   */
  #injectScript(filePath) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(filePath);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  /**
   * The Sonos web app is a SPA. We use a MutationObserver to wait for the
   * target header element to appear before injecting the UI.
   */
  #waitForDOM() {
    // The observer calls #initializeUI whenever the DOM changes.
    this.#observer = new MutationObserver(this.#initializeUI.bind(this));
    this.#observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Creates and injects the UI elements into the page.
   * This is the callback for the MutationObserver. It will be called multiple
   * times and will incrementally add UI components as their DOM dependencies become
   * available. The observer is disconnected once all components are initialized.
   */
  #initializeUI() {
    // --- Initialize Header Button & Overlay ---
    // This part only runs once.
    if (!this.#headerButtonInitialized) {
      // Check if the button is already there to avoid re-adding it on hot-reloads.
      if (!document.getElementById(SonosSubsUI.#HEADER_BUTTON_ID)) {
        const headerParent = document.querySelector('header > div:last-of-type');
        if (headerParent) {
          // Create the overlay only once, when we're about to add the button.
          if (!this.#overlay) {
            this.#createOverlay();
          }
          this.#createHeaderButton(headerParent);
          this.#addEventListeners(); // Adds listeners to overlay and header button
          this.#headerButtonInitialized = true;
        }
      } else {
        // Button already exists, maybe from a previous script instance.
        this.#headerButtonInitialized = true;
      }
    }

    // --- Initialize Volume Scroll Listeners (continuously) ---
    // This runs on each mutation to find any new volume sliders that have appeared.
    // We use querySelectorAll to find every instance.
    const volumeSliderHandles = document.querySelectorAll('[aria-label="Volume"]');
    volumeSliderHandles.forEach(handle => {
      const container = handle.parentElement?.parentElement;

      // Use a data attribute to mark elements that already have the listener,
      // preventing us from adding it multiple times.
      if (container && !container.dataset.sonosSubsVolumeListener) {
        container.addEventListener('wheel', this.#boundHandleVolumeScroll, { passive: false });
        container.dataset.sonosSubsVolumeListener = 'true';
      }
    });
  }

  /** Creates the lyrics overlay and appends it to the body. */
  #createOverlay() {
    this.#overlay = document.createElement('div');
    this.#overlay.id = SonosSubsUI.#OVERLAY_ID;
    Object.assign(this.#overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.925)',
      color: '#e1e1e1',
      display: 'none', // Hidden by default
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '99999',
      fontSize: '28px',
      padding: '20px',
      boxSizing: 'border-box',
      transition: 'opacity 0.2s ease-in-out',
      opacity: '0' // For fade-in/out effect
    });

    this.#overlayContent = document.createElement('div');
    this.#overlayContent.id = SonosSubsUI.#OVERLAY_CONTENT_ID;
    this.#overlayContent.textContent = 'Waiting for song...';
    Object.assign(this.#overlayContent.style, {
      whiteSpace: 'pre-wrap',
      overflowY: 'auto',
      maxHeight: '80vh',
      textAlign: 'center',
      lineHeight: '1.5',
      fontSize: '22px',
      padding: '0 20px',
      boxSizing: 'border-box',
    });

    // Create attribution element
    const attribution = document.createElement('div');
    attribution.innerHTML = 'Lyrics by <a href="https://lyrics.ovh" target="_blank" rel="noopener noreferrer" style="color: #888; text-decoration: none;">lyrics.ovh</a>';
    Object.assign(attribution.style, {
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '14px',
      color: '#888',
      textAlign: 'center'
    });

    this.#closeButton = document.createElement('button');
    this.#closeButton.id = SonosSubsUI.#OVERLAY_CLOSE_ID;
    this.#closeButton.innerHTML = SonosSubsUI.#CLOSE_OVERLAY_SVG;
    this.#closeButton.title = 'Close Lyrics';
    Object.assign(this.#closeButton.style, {
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'none',
      border: 'none',
      color: 'inherit',
      cursor: 'pointer',
      padding: '0',
      lineHeight: '1',
    });

    this.#overlay.append(this.#overlayContent, this.#closeButton, attribution);
    document.body.appendChild(this.#overlay);
  }

  /**
   * Creates the toggle button and appends it to the header.
   * @param {HTMLElement} parent - The parent element to append the button to.
   */
  #createHeaderButton(parent) {
    this.#headerButton = document.createElement('button');
    this.#headerButton.id = SonosSubsUI.#HEADER_BUTTON_ID;
    this.#headerButton.innerHTML = SonosSubsUI.#SUBTITLES_SVG;
    this.#headerButton.title = 'Show Lyrics';
    Object.assign(this.#headerButton.style, {
      background: 'none',
      border: 'none',
      color: 'inherit',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '20px',
      padding: '.25rem'
    });

    parent.append(this.#headerButton);
  }

  /** Adds event listeners to the UI elements. */
  #addEventListeners() {
    const toggleFn = this.#toggleOverlay.bind(this);
    this.#headerButton.addEventListener('click', toggleFn);
    this.#closeButton.addEventListener('click', toggleFn);
  }

  /** Toggles the visibility of the lyrics overlay with a fade effect. */
  #toggleOverlay() {
    if (!this.#overlay) return;

    const isHidden = this.#overlay.style.display === 'none';
    if (isHidden) {
      // If we have cached lyrics for the current track, display them immediately.
      if (this.#currentTrack.lyrics) {
        this.#overlayContent.textContent = this.#currentTrack.lyrics;
      }
      // Otherwise, if we have a track, fetch the lyrics.
      else if (this.#currentTrack.trackName && this.#currentTrack.artistName) {
        this.#fetchAndDisplayLyrics(this.#currentTrack.trackName, this.#currentTrack.artistName);
      }
      // If there's no track info at all.
      else {
        this.#overlayContent.textContent = 'Waiting for song...';
      }

      this.#overlay.style.display = 'flex';
      // Use a timeout to allow the display property to apply before starting the transition
      setTimeout(() => {
        this.#overlay.style.opacity = '1';
      }, 10);
    } else {
      this.#overlay.style.opacity = '0';
      // Wait for the transition to finish before hiding the element
      this.#overlay.addEventListener('transitionend', () => {
        this.#overlay.style.display = 'none';
      }, { once: true });
    }
  }

  /**
   * Handles mouse wheel events on the volume slider to adjust volume.
   * @param {WheelEvent} event The wheel event.
   */
  async #handleVolumeScroll(event) {
    event.preventDefault(); // Prevent the page from scrolling

    // Find the handle element for immediate UI feedback. The event's currentTarget
    // is the container we attached the listener to.
    const container = event.currentTarget;
    const handleElement = container.querySelector('[aria-label="Volume"]')?.parentElement;
    const lineElement = handleElement?.parentElement?.firstChild?.firstChild;
    const volumeElement = handleElement?.parentElement?.parentElement?.lastChild;

    // Use the most up-to-date volume from the UI if available, otherwise fetch from storage.
    // This ensures rapid scroll events build on each other correctly.
    let currentVolume;
    if (volumeElement && !isNaN(parseInt(volumeElement.textContent, 10))) {
      currentVolume = parseInt(volumeElement.textContent, 10);
    } else {
      const data = await chrome.storage.local.get({ playSettings: { volume: 50 } });
      currentVolume = data.playSettings.volume;
    }

    const scrollStep = 1;
    // deltaY is negative for scroll up (increase volume), positive for scroll down (decrease)
    const newVolume = event.deltaY < 0
      ? Math.min(100, currentVolume + scrollStep)
      : Math.max(1, currentVolume - scrollStep);

    if (newVolume !== currentVolume) {
      // --- Immediate UI Feedback ---
      if (handleElement) {
        const pixelOffset = Math.abs(newVolume - 50) * 0.12;
        handleElement.style.left = `calc(${newVolume}% + ${pixelOffset}px)`;
      }

      if (lineElement) {
        lineElement.style.right = `${100 - newVolume}%`;
      }

      if (volumeElement) {
        volumeElement.textContent = newVolume;
      }

      // --- Debounced Update Logic ---
      // Clear any pending timeout to reset the debounce timer.
      if (this.#volumeScrollTimeout) {
        clearTimeout(this.#volumeScrollTimeout);
      }

      // Set a new timeout. The actual update will only run after the user stops scrolling.
      this.#volumeScrollTimeout = setTimeout(async () => {
        // Get latest settings from storage to avoid overwriting other properties (like 'muted').
        const data = await chrome.storage.local.get({ playSettings: {} });
        const newPlaySettings = { ...data.playSettings, volume: newVolume };
        await chrome.storage.local.set({ playSettings: newPlaySettings });

        // Send the command to the injected script to change the actual Sonos volume.
        window.postMessage({
          type: 'SONOS_COMMAND',
          command: 'setVolume',
          props: { volume: newVolume }
        }, window.location.origin);
      }, 500); // 500ms delay after the last scroll event.
    }
  }

  /**
   * Handles the 'SONOS_TRACK_INFO' event from the injected script.
   * @param {CustomEvent} event The event containing song details.
   */
  async #handleNowPlaying(event) {
    // If the extension context is invalidated (e.g., on reload), chrome.runtime will be undefined.
    // This check prevents errors when trying to access chrome APIs in an orphaned script.
    if (!chrome.runtime?.id) {
      this.#cleanup();
      return;
    }

    // We only accept messages from the page's own window
    if (event.source !== window) {
      return;
    }

    const { type } = event.data;

    if (type === 'SONOS_TRACK_INFO') {
      const { track, isPlaying } = event.data;
      const trackName = track.title,
        artistName = track.artist,
        imageUrl = track.imageUrl;


      // Get existing settings, update, and set back to avoid overwriting.
      const data = await chrome.storage.local.get({ playSettings: {} });
      const newPlaySettings = { ...data.playSettings, isPlaying };
      await chrome.storage.local.set({ playSettings: newPlaySettings });

      // Don't do anything if the track hasn't changed. This can happen when
      // pausing/playing the same song.
      if (this.#currentTrack.trackName === trackName && this.#currentTrack.artistName === artistName) {
        return;
      }

      // New song, so reset the track info and clear the cached lyrics.
      this.#currentTrack = { trackName, artistName, lyrics: null };

      // If the overlay is visible, refresh the lyrics for the new song.
      if (this.#overlay?.style.display !== 'none') {
        this.#overlayContent.scrollTop = 0;
        this.#fetchAndDisplayLyrics(trackName, artistName);
      }

      // Store current song in storage for popup access
      chrome.storage.local.set({ currentSong: { trackName, artistName, imageUrl } });

      this.#sendNotificationMessage(trackName, artistName, imageUrl);
    } else if (type === "SONOS_VOLUME_INFO") {
      // Get existing settings, update, and set back to avoid overwriting.
      const data = await chrome.storage.local.get({ playSettings: {} });
      const { volume, muted } = event.data;
      const newPlaySettings = { ...data.playSettings, volume, muted };
      await chrome.storage.local.set({ playSettings: newPlaySettings });
    }
  }

  /**
   * Sends a message to the background script to display a notification.
   * @param {string} trackName
   * @param {string} artistName
   * @param {string} imageUrl
   */
  #sendNotificationMessage(trackName, artistName, imageUrl) {
    try {
      // Send the song data to the background script.
      chrome.runtime.sendMessage({ type: 'SONOS_TRACK_INFO', data: { trackName, artistName, imageUrl } }, () => { });
    } catch (error) {
      // This error is expected if the extension was reloaded and this is an old,
      // orphaned content script. We clean up to prevent further errors.
      if (error.message.includes('Extension context invalidated')) {
        this.#cleanup();
      } else {
        console.error("Sonos-Subs: Unexpected error sending message:", error);
      }
    }
  }

  /**
   * Fetches lyrics from an API and displays them in the overlay.
   * @param {string} trackName
   * @param {string} artistName
   */
  async #fetchAndDisplayLyrics(trackName, artistName) {
    if (!this.#overlayContent) return;

    this.#overlayContent.textContent = `Loading lyrics for "${trackName}"...`;

    try {
      const apiUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const notFoundMessage = `Sorry, lyrics for "${trackName}" could not be found.`;
        this.#currentTrack.lyrics = notFoundMessage; // Cache the "not found" state
        this.#overlayContent.textContent = notFoundMessage;
        return;
      }

      const data = await response.json();
      // The API returns an empty string for some instrumentals.
      const lyrics = data.lyrics?.trim();
      // Cache the lyrics or the instrumental message.
      this.#currentTrack.lyrics = lyrics || `No lyrics found for "${trackName}". (The song might be instrumental).`;
      this.#overlayContent.textContent = this.#currentTrack.lyrics;

    } catch (error) {
      console.error("Sonos-Subs: Error fetching lyrics:", error);
      const errorMessage = 'Could not fetch lyrics. Please check your connection or the API status.';
      this.#currentTrack.lyrics = errorMessage; // Cache the error state
      this.#overlayContent.textContent = errorMessage;
    }
  }

  /**
   * Sets up listener for commands from the background script
   */
  #setupCommandListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Use an immediately-invoked async function expression (IIFE) to handle
      // async logic inside the synchronous listener.
      (async () => {
        if (message.action === 'sendSonosCommand') {
          let { command } = message;

          // Extra properties
          let props = {}
          if (command === 'play' || command === 'pause') {
            props = { "allowTvPauseRestore": true, "deviceFeedback": "NONE" }
          }
          if (command === 'setMute') {
            const { playSettings } = await chrome.storage.local.get('playSettings');
            props = { muted: playSettings.muted }
          }
          else if (command === 'setVolume') {
            const { playSettings } = await chrome.storage.local.get('playSettings');
            props = { volume: playSettings.volume }
          }

          window.postMessage({ type: 'SONOS_COMMAND', command, props }, window.location.origin);
          sendResponse({ success: true });
        }
      })();

      // Return true to indicate that sendResponse will be called asynchronously.
      return true;
    });
  }

  /**
   * Cleans up listeners and observers to prevent errors in an
   * invalidated extension context.
   */
  #cleanup() {
    if (this.#boundHandleNowPlaying) {
      window.removeEventListener('message', this.#boundHandleNowPlaying);
    }
    this.#observer?.disconnect();
    console.log("Sonos-Subs: Cleaned up orphaned content script listeners.");
  }
}

// --- Main Execution ---
// The class handles waiting for the DOM to be ready and injects the patch script.
const sonosSubsUI = new SonosSubsUI();
