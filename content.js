/**
 * Injects a script into the main page's context.
 * @param {string} filePath - The path to the script to inject.
 */
function injectScript(filePath) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(filePath);
  // The script will be removed from the DOM after it has been loaded.
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

injectScript('patch.js');

/**
 * Handles the 'SonosNowPlaying' event from the injected script.
 * @param {CustomEvent} event The event containing song details.
 */
function handleNowPlaying(event) {
  const { trackName, artistName, imageUrl } = event.detail;

  try {
    // Send the song data to the background script. This returns a promise in MV3.
    const promise = chrome.runtime.sendMessage({
      type: 'show_notification',
      data: { trackName, artistName, imageUrl }
    });

    // Handle the promise to prevent an "Uncaught (in promise)" error if the
    // background script's port closes before a response is sent.
    promise?.catch(() => { /* Ignore promise rejection */ });
  } catch (error) {
    // This error is expected if the extension was reloaded and this is an old, orphaned
    // content script. We can safely ignore it, as the new content script will handle the message.
    if (error.message.includes('Extension context invalidated')) {
      // The context is invalid, so we should remove this listener to prevent further errors.
      window.removeEventListener('SonosNowPlaying', handleNowPlaying);
    } else {
      // Log any other unexpected errors.
      console.error("Sonos-Subs: Unexpected error sending message:", error);
    }
  }
}

// Listen for the custom event from the injected script (patch.js)
window.addEventListener('SonosNowPlaying', handleNowPlaying);

