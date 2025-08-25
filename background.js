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


// A consistent ID for our notification to ensure we can update it.
const NOTIFICATION_ID = "sonos-now-playing-notification";

chrome.runtime.onMessage.addListener(async (message, sender) => {
  // Listener for showing a desktop notification

  if (message.type === 'SONOS_TRACK_INFO') {
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
  } else {
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
