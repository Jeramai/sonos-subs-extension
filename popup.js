document.addEventListener('DOMContentLoaded', () => {
  const notificationsToggle = document.getElementById('notificationsToggle');

  // Load the saved setting and update the checkbox state.
  // Default to `true` (enabled) if no setting is found.
  chrome.storage.sync.get({ notificationsEnabled: true }, (items) => {
    notificationsToggle.checked = items.notificationsEnabled;
  });

  // Save the setting whenever the toggle is changed.
  notificationsToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ notificationsEnabled: notificationsToggle.checked });
  });

  const ICONS = {
    play: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z"/></svg>`,
    pause: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/></svg>`,
    prev: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 6H8V18H6V6ZM9.5 12L18 18V6L9.5 12Z"/></svg>`,
    next: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 18H18V6H16V18ZM6 18L14.5 12L6 6V18Z"/></svg>`,
  };

  const updatePopupUI = (data) => {
    const songInfoElement = document.querySelector('.song-info');
    const playbackControlsContainer = document.querySelector('.playback-controls');

    // Display song info
    if (data.currentSong && data.currentSong.trackName) {
      const { trackName, artistName, imageUrl } = data.currentSong;
      songInfoElement.innerHTML = `
        ${imageUrl ? `<img src="${imageUrl}" class="song-image" alt="Album art">` : ''}
        <div class="song-info-wrapper">
          <div class="song-title truncate">${trackName}</div>
          <div class="song-artist truncate">by ${artistName}</div>
        </div>
      `;
    } else {
      songInfoElement.innerHTML = `
        <div class="song-info-wrapper">
          <div class="song-title">No song playing</div>
        </div>
      `;
    }

    // Display playback controls and handle clicks
    if (playbackControlsContainer && data.playSettings) {
      playbackControlsContainer.innerHTML = ''; // Clear previous controls
      let { isPlaying } = data.playSettings;

      const createIconButton = (iconHtml, messageType, onClickHandler) => {
        const button = document.createElement('button');
        button.innerHTML = iconHtml;
        button.classList.add('control-button');
        button.addEventListener('click', () => {
          if (onClickHandler) {
            onClickHandler(button); // For optimistic UI updates
          }
          chrome.runtime.sendMessage({ type: messageType });
        });
        return button;
      };

      // PREV button
      playbackControlsContainer.appendChild(createIconButton(ICONS.prev, 'SONOS_PREV_SONG'));

      // Play/Pause button
      const playPauseButton = createIconButton(
        isPlaying ? ICONS.pause : ICONS.play,
        'SONOS_TOGGLE_PLAY_PAUSE',
        (button) => {
          // Optimistically update UI
          isPlaying = !isPlaying;
          button.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
        }
      );
      playbackControlsContainer.appendChild(playPauseButton);

      // NEXT button
      playbackControlsContainer.appendChild(createIconButton(ICONS.next, 'SONOS_NEXT_SONG'));
    }
  };

  // Get current song and playback information from storage for initial load
  chrome.storage.local.get(['currentSong', 'playSettings'], (result) => {
    updatePopupUI(result);
  });

  // Listen for updates from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SONG_UPDATED') {
      updatePopupUI(message.data);
    }
  });
});
