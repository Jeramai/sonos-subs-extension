/**
 * Manages the UI for the Sonos Subs extension, including a lyrics overlay
 * and a toggle button in the header.
 */
class SonosSubsUI {
  // --- Constants ---
  static #HEADER_BUTTON_ID = 'sonos-subs-header-button';
  static #OVERLAY_ID = 'sonos-subs-overlay';
  static #OVERLAY_TEXT_ID = 'sonos-subs-overlay-text';
  static #OVERLAY_CLOSE_ID = 'sonos-subs-overlay-close';

  // SVG icons for the toggle button
  static #SUBTITLES_SVG = `<svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" fill="#FFFFFF" d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12ZM6 15.25C5.58579 15.25 5.25 15.5858 5.25 16C5.25 16.4142 5.58579 16.75 6 16.75H10C10.4142 16.75 10.75 16.4142 10.75 16C10.75 15.5858 10.4142 15.25 10 15.25H6ZM7.75 13C7.75 12.5858 7.41421 12.25 7 12.25H6C5.58579 12.25 5.25 12.5858 5.25 13C5.25 13.4142 5.58579 13.75 6 13.75H7C7.41421 13.75 7.75 13.4142 7.75 13ZM11.5 12.25C11.9142 12.25 12.25 12.5858 12.25 13C12.25 13.4142 11.9142 13.75 11.5 13.75H9.5C9.08579 13.75 8.75 13.4142 8.75 13C8.75 12.5858 9.08579 12.25 9.5 12.25H11.5ZM18.75 13C18.75 12.5858 18.4142 12.25 18 12.25H14C13.5858 12.25 13.25 12.5858 13.25 13C13.25 13.4142 13.5858 13.75 14 13.75H18C18.4142 13.75 18.75 13.4142 18.75 13ZM12.5 15.25C12.0858 15.25 11.75 15.5858 11.75 16C11.75 16.4142 12.0858 16.75 12.5 16.75H14C14.4142 16.75 14.75 16.4142 14.75 16C14.75 15.5858 14.4142 15.25 14 15.25H12.5ZM15.75 16C15.75 15.5858 16.0858 15.25 16.5 15.25H18C18.4142 15.25 18.75 15.5858 18.75 16C18.75 16.4142 18.4142 16.75 18 16.75H16.5C16.0858 16.75 15.75 16.4142 15.75 16Z" />
</svg>`;
  static #CLOSE_OVERLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  // --- Private instance fields ---
  #headerButton = null;
  #overlay = null;
  #overlayText = null;
  #closeButton = null;
  #observer = null;

  constructor() {
    this.#injectScript('patch.js');
    this.#waitForDOM();
    window.addEventListener('SonosNowPlaying', this.#handleNowPlaying.bind(this));
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
   * This is the callback for the MutationObserver.
   */
  #initializeUI() {
    // Avoid re-creating elements if they already exist
    if (document.getElementById(SonosSubsUI.#HEADER_BUTTON_ID)) {
      this.#observer?.disconnect();
      return;
    }

    // Find the parent for the header button
    const headerParent = document.querySelector('header > div:last-of-type');
    if (!headerParent) {
      // Element not ready yet, observer will try again.
      return;
    }

    this.#createOverlay();
    this.#createHeaderButton(headerParent);
    this.#addEventListeners();

    // UI is successfully initialized, we can stop observing.
    this.#observer.disconnect();
    this.#observer = null; // Clean up reference
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
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
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

    this.#overlayText = document.createElement('span');
    this.#overlayText.id = SonosSubsUI.#OVERLAY_TEXT_ID;
    this.#overlayText.textContent = 'Waiting for song...';

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

    this.#overlay.append(this.#overlayText, this.#closeButton);
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
   * Handles the 'SonosNowPlaying' event from the injected script.
   * @param {CustomEvent} event The event containing song details.
   */
  #handleNowPlaying(event) {
    const { trackName, artistName, imageUrl } = event.detail;

    // Update the overlay text if the UI has been initialized
    if (this.#overlayText) {
      this.#overlayText.textContent = `Now Playing: ${trackName} by ${artistName}`;
    }

    try {
      // Send the song data to the background script.
      const promise = chrome.runtime.sendMessage({
        type: 'show_notification',
        data: { trackName, artistName, imageUrl }
      });
      promise?.catch(() => { /* Ignore promise rejection */ });
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
   * Cleans up listeners and observers to prevent errors in an
   * invalidated extension context.
   */
  #cleanup() {
    window.removeEventListener('SonosNowPlaying', this.#handleNowPlaying.bind(this));
    this.#observer?.disconnect();
    console.log("Sonos-Subs: Cleaned up orphaned content script listeners.");
  }
}

// --- Main Execution ---
// The class handles waiting for the DOM to be ready and injects the patch script.
const sonosSubsUI = new SonosSubsUI();
