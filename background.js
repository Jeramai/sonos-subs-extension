// This background script handles extension tasks like showing notifications.
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

        // First, clear the previous notification to ensure the new one re-appears.
        await chrome.notifications.clear(NOTIFICATION_ID);

        // After clearing, create the new notification.
        const notificationId = await chrome.notifications.create(NOTIFICATION_ID, {
          type: 'basic',
          iconUrl: imageUrl ?? chrome.runtime.getURL('icons/icon128.png'),
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
