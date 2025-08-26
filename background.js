// This background script handles extension tasks like showing notifications.

/**
 * Fetches an image from a URL and converts it to a Data URL.
 * This is necessary to use local network images (http://) in notifications,
 * which are otherwise blocked by security policies. If fetching fails,
 * it returns a fallback icon URL.
 * @param {string | null | undefined} imageUrl The URL of the image to fetch.
 * @param {string} fallbackUrl The default icon to use if fetching fails.
 * @returns {Promise<string>} A promise that resolves to a Data URL or the fallback URL.
 */
async function getImageDataUrl(imageUrl, fallbackUrl) {
  if (!imageUrl) return fallbackUrl;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject; // Pass reader errors to the promise
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Sonos-Subs: Could not fetch image from ${imageUrl}. Using fallback. Error: ${error.message}`);
    return fallbackUrl;
  }
}

/**
 * Fetches the latest state from storage and broadcasts it to other parts of
 * the extension, like the popup, so the UI can be updated live.
 */
async function broadcastStateUpdate() {
  try {
    // Fetch the latest state that the content script has saved.
    const latestState = await chrome.storage.local.get(['currentSong', 'playSettings']);
    // If there's any state to broadcast, send it.
    if (latestState.currentSong || latestState.playSettings) {
      chrome.runtime.sendMessage({ type: 'SONG_UPDATED', data: latestState });
      console.log('Sonos-Subs: Broadcasted state update to popup.');
    }
  } catch (error) {
    console.error('Sonos-Subs: Failed to broadcast state update.', error);
  }
}

// A consistent ID for our notification to ensure we can update it.
const NOTIFICATION_ID = "sonos-now-playing-notification";

chrome.runtime.onMessage.addListener(async (message, sender) => {
  // Listener for showing a desktop notification

  if (message.type === 'SONOS_TRACK_INFO') {
    // This message indicates a state change. The first thing we do is
    // broadcast this change to any open UI, like the popup.
    broadcastStateUpdate();

    // Defensive check: Ensure the storage API is available. This error typically
    // means the "storage" permission is missing from the manifest.json file.
    if (!chrome.storage) {
      console.error("Sonos-Subs: Chrome Storage API is not available. Please ensure the 'storage' permission is in your manifest.json file.");
      return { status: "error", message: "Storage API unavailable." };
    }

    try {
      // Check the user's preference from storage before showing the notification.
      const items = await chrome.storage.sync.get({ notificationsEnabled: true });

      if (items.notificationsEnabled) {
        const { trackName, artistName, imageUrl } = message.data;

        const finalImageUrl = await getImageDataUrl(imageUrl, chrome.runtime.getURL('icons/icon128.png'));

        // First, clear the previous notification to ensure the new one re-appears.
        await chrome.notifications.clear(NOTIFICATION_ID);

        // After clearing, create the new notification.
        const notificationId = await chrome.notifications.create(NOTIFICATION_ID, {
          type: 'basic',
          iconUrl: finalImageUrl,
          title: trackName,
          message: `by ${artistName}`,
          silent: true,
          priority: 1
        });
        console.log(`Sonos-Subs: Notification created/updated successfully with ID: ${notificationId}`);
        return { status: "notification_sent" };
      } else {
        // Notifications are disabled, do nothing.
        return { status: "notifications_disabled" };
      }
    } catch (error) {
      console.error("Sonos-Subs: Notification creation failed:", error.message);
      return { status: "error", message: error.message };
    }
  } else if (
    ['SONOS_TOGGLE_PLAY_PAUSE', 'SONOS_PREV_SONG', 'SONOS_NEXT_SONG'].includes(message.type)
  ) {
    try {
      // Get the current playback state from storage to decide which command to send
      const { playSettings } = await chrome.storage.local.get('playSettings');

      // Determine the current state, defaulting to false (paused) if not set
      const isPlaying = playSettings?.isPlaying || false;
      // Choose the command to send based on the current state
      let command = isPlaying ? 'pause' : 'play';
      if (message.type === 'SONOS_PREV_SONG') command = 'skipBack'
      if (message.type === 'SONOS_NEXT_SONG') command = 'skipToNextTrack'

      // Find the Sonos tab to send the command to the content script
      const [sonosTab] = await chrome.tabs.query({ url: "https://play.sonos.com/*" });

      if (sonosTab) {
        // Forward the command to the content script (patch.js) which has the WebSocket
        try {
          await chrome.tabs.sendMessage(sonosTab.id, { action: 'sendSonosCommand', command });
          // NOTE: We don't broadcast a state update here directly.
          // The popup UI has already been updated optimistically. The actual,
          // authoritative state change will be detected by the content script
          // after the command is processed by Sonos, which will then send a
          // 'SONOS_TRACK_INFO' message back to this background script.
          // That message triggers the `broadcastStateUpdate()` call, ensuring
          // the UI is eventually consistent with the true system state.
          console.log(`Sonos-Subs: Relayed '${command}' command to content script.`);
        } catch (error) {
          console.warn('Sonos-Subs: Failed to send command to content script:', error.message);
        }
      } else {
        console.warn('Sonos-Subs: Could not find an active Sonos tab to send command.');
      }
    } catch (error) {
      console.error('Sonos-Subs: Error relaying play/pause command:', error);
    }
  }
  else {
    // It's good practice to indicate that this listener does not handle other
    // message types, preventing potential "port closed" errors elsewhere.
    return false;
  }
});

// Add a listener for when the user clicks on the notification.
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId === NOTIFICATION_ID) {
    // Find the Sonos player tab and focus it.
    const tabs = await chrome.tabs.query({ url: "https://play.sonos.com/*" });
    if (tabs.length > 0) {
      const sonosTab = tabs[0];
      // Focus the window and the tab.
      await chrome.windows.update(sonosTab.windowId, { focused: true });
      await chrome.tabs.update(sonosTab.id, { active: true });
    }
  }
});
