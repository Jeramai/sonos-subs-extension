document.addEventListener('DOMContentLoaded', () => {
  const notificationsToggle = document.getElementById('notificationsToggle');
  const volumeSlider = document.getElementById('volumeSlider');
  const muteButton = document.getElementById('muteButton');
  const volumeLevel = document.getElementById('volumeLevel');

  /**
   * Attaches a click listener to a button to send a command to the background script.
   * @param {HTMLElement} button The button element.
   * @param {string} messageType The message type to send.
   * @param {function(HTMLElement): void} [optimisticUpdate] Optional function to update the UI immediately on click.
   */
  const addCommandListener = (button, messageType, optimisticUpdate) => {
    button.addEventListener('click', () => {
      if (optimisticUpdate) optimisticUpdate(button);
      chrome.runtime.sendMessage({ type: messageType });
    });
  };

  // Load the saved setting and update the checkbox state.
  // Default to `true` (enabled) if no setting is found.
  chrome.storage.sync.get({ notificationsEnabled: true }, (items) => {
    notificationsToggle.checked = items.notificationsEnabled;
  });

  // Save the setting whenever the toggle is changed.
  notificationsToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ notificationsEnabled: notificationsToggle.checked });
  });

  // Send volume changes to the background script.
  if (volumeSlider) {
    volumeSlider.addEventListener('input', async () => {
      const volume = parseInt(volumeSlider.value, 10);
      // Optimistically update the volume level display and slider progress
      volumeSlider.style.setProperty('--slider-progress', `${volume}%`);
      volumeLevel.innerHTML = volume;
      chrome.runtime.sendMessage({ type: 'SONOS_SET_VOLUME', volume });

      const data = await chrome.storage.local.get({ playSettings: {} });
      const newPlaySettings = { ...data.playSettings, volume };
      chrome.storage.local.set({ playSettings: newPlaySettings });
    });
  }

  const ICONS = {
    play: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z"/></svg>`,
    pause: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/></svg>`,
    prev: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 6H8V18H6V6ZM9.5 12L18 18V6L9.5 12Z"/></svg>`,
    next: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 6H18V18H16V6ZM6 18L14.5 12L6 6V18Z"/></svg>`,
    volumeOn: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
    volumeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
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
        addCommandListener(button, messageType, onClickHandler);
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

    // Update volume slider visibility and value
    if (volumeSlider && data.playSettings && typeof data.playSettings.volume !== 'undefined') {
      const volume = data.playSettings.volume;
      volumeSlider.value = volume;
      volumeSlider.style.setProperty('--slider-progress', `${volume}%`);
      volumeSlider.parentElement.style.display = '';

      // Show the volume amount
      volumeLevel.innerHTML = volume;
    }

    // Update mute button icon
    if (muteButton && data.playSettings && typeof data.playSettings.muted !== 'undefined') {
      let muted = data.playSettings.muted; // Local state for the closure
      muteButton.innerHTML = muted ? ICONS.volumeOff : ICONS.volumeOn;
      muteButton.style.display = '';

      // By using onclick, we replace any previous handler, ensuring the closure
      // captures the fresh `muted` state from this render.
      muteButton.onclick = async () => {
        // Optimistically update UI
        muted = !muted;
        muteButton.innerHTML = muted ? ICONS.volumeOff : ICONS.volumeOn;

        const newPlaySettings = { ...data.playSettings, muted };
        await chrome.storage.local.set({ playSettings: newPlaySettings });

        // Send command
        chrome.runtime.sendMessage({ type: 'SONOS_TOGGLE_MUTE' });
      };
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
