const browserAPI = (typeof browser !== "undefined" ? browser : chrome)

const NOTIFICATION_ID = "sonos-now-playing-notification";
const SONOS_URL = "https://play.sonos.com/*";

const COMMAND_MAP = {
  SONOS_TOGGLE_PLAY_PAUSE: (isPlaying) => isPlaying ? 'pause' : 'play',
  SONOS_PREV_SONG: () => 'skipBack',
  SONOS_NEXT_SONG: () => 'skipToNextTrack',
  SONOS_TOGGLE_MUTE: () => 'setMute',
  SONOS_SET_VOLUME: () => 'setVolume'
};

async function getImageDataUrl(imageUrl, fallbackUrl) {
  if (!imageUrl) return fallbackUrl;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Sonos-Subs: Image fetch failed for ${imageUrl}:`, error.message);
    return fallbackUrl;
  }
}
async function broadcastStateUpdate() {
  try {
    const latestState = await browserAPI.storage.local.get(['currentSong', 'playSettings']);
    if (latestState.currentSong || latestState.playSettings) {
      browserAPI.runtime.sendMessage({ type: 'SONG_UPDATED', data: latestState });
    }
  } catch (error) {
    console.warn('Sonos-Subs: Broadcast failed:', error);
  }
}
async function sendSonosCommand(command) {
  const [sonosTab] = await browserAPI.tabs.query({ url: SONOS_URL });
  if (!sonosTab) {
    console.warn('Sonos-Subs: No active Sonos tab found');
    return;
  }
  try {
    await browserAPI.tabs.sendMessage(sonosTab.id, { action: 'sendSonosCommand', command });
    console.log(`Sonos-Subs: Sent '${command}' command`);
  } catch (error) {
    console.warn('Sonos-Subs: Command failed:', error.message);
  }
}

// In background script 
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SONOS_TRACK_INFO') {
    (async () => {
      broadcastStateUpdate();

      if (!browserAPI.storage) {
        console.error("Sonos-Subs: Storage API unavailable");
        return;
      }

      try {
        const { notificationsEnabled = true } = await browserAPI.storage.sync.get('notificationsEnabled');
        if (!notificationsEnabled) return;

        const { trackName, artistName, imageUrl } = message.data;
        const iconUrl = await getImageDataUrl(imageUrl, browserAPI.runtime.getURL('icons/icon128.png'));

        await browserAPI.notifications.clear(NOTIFICATION_ID);

        const notificationData = {
          type: 'basic',
          iconUrl,
          title: trackName,
          message: `by ${artistName}`,
        };

        // these only work on chrome API
        const isFirefox = typeof browser !== 'undefined' && browser.runtime;
        if (!isFirefox) {
          notificationData.silent = true;
          notificationData.priority = 1;
          notificationData.buttons = [{ title: 'Previous' }, { title: 'Next' }];
        }

        await browserAPI.notifications.create(NOTIFICATION_ID, notificationData);
      } catch (error) {
        console.error("Sonos-Subs: Notification failed:", error.message);
      }
    })();
  }
  else if (message.type === 'SONOS_SEEK_SONG') {
    (async () => {
      const [sonosTab] = await browserAPI.tabs.query({ url: SONOS_URL });
      if (!sonosTab) {
        console.warn('Sonos-Subs: No active Sonos tab found');
        return;
      }
      try {
        await browserAPI.tabs.sendMessage(sonosTab.id, {
          action: 'sendSonosCommand',
          command: 'seek',
          positionMillis: message.positionMillis
        });
        console.log(`Sonos-Subs: Seeking to ${message.positionMillis}ms`);
      } catch (error) {
        console.warn('Sonos-Subs: Seek command failed:', error.message);
      }
    })();
  }
  else if (COMMAND_MAP[message.type]) {
    (async () => {
      try {
        const { playSettings } = await browserAPI.storage.local.get('playSettings');
        const isPlaying = playSettings?.isPlaying || false;
        const command = COMMAND_MAP[message.type](isPlaying);
        await sendSonosCommand(command);
      } catch (error) {
        console.error('Sonos-Subs: Command error:', error);
      }
    })();
  }
});
browserAPI.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId !== NOTIFICATION_ID) return;

  const [sonosTab] = await browserAPI.tabs.query({ url: SONOS_URL });
  if (sonosTab) {
    await browserAPI.windows.update(sonosTab.windowId, { focused: true });
    await browserAPI.tabs.update(sonosTab.id, { active: true });
  }
});
browserAPI.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === NOTIFICATION_ID) {
    const command = buttonIndex === 0 ? 'skipBack' : 'skipToNextTrack';
    await sendSonosCommand(command);
  }
}); 
