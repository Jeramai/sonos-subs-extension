// This background script handles extension tasks like showing notifications.
// A consistent ID for our notification to ensure we can update it.
const NOTIFICATION_ID = "sonos-now-playing-notification";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Listener for showing a desktop notification
  if (message.type === 'show_notification') {
    // Defensive check: Ensure the storage API is available. This error typically
    // means the "storage" permission is missing from the manifest.json file.
    if (!chrome.storage) {
      console.error("Sonos-Subs: Chrome Storage API is not available. Please ensure the 'storage' permission is in your manifest.json file.");
      sendResponse({ status: "error", message: "Storage API unavailable." });
      return true; // Keep the message channel open.
    }

    // Check the user's preference from storage before showing the notification.
    chrome.storage.sync.get({ notificationsEnabled: true }, (items) => {
      if (items.notificationsEnabled) {
        const { trackName, artistName, imageUrl } = message.data;

        // First, clear the previous notification to ensure the new one re-appears.
        chrome.notifications.clear(NOTIFICATION_ID, () => {
          // After clearing, create the new notification.
          chrome.notifications.create(NOTIFICATION_ID, {
            type: 'basic',
            iconUrl: imageUrl ?? chrome.runtime.getURL('images/icon128.png'),
            title: trackName,
            message: `by ${artistName}`,
            silent: true,
            priority: 1
          }, (notificationId) => {
            if (chrome.runtime.lastError) {
              console.error("Sonos-Subs: Notification creation failed:", chrome.runtime.lastError.message);
              sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            } else {
              console.log(`Sonos-Subs: Notification created/updated successfully with ID: ${notificationId}`);
              sendResponse({ status: "notification_sent" });
            }
          });
        });
      } else {
        // Notifications are disabled, do nothing.
        sendResponse({ status: "notifications_disabled" });
      }
    });
  }
  // Return true to indicate that the response will be sent asynchronously.
  // This is crucial for keeping the message port open in Manifest V3.
  return true;
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
