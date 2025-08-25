document.addEventListener('DOMContentLoaded', () => {
  const notificationsToggle = document.getElementById('notificationsToggle');
  const songInfoElement = document.querySelector('.song-info');

  // Load the saved setting and update the checkbox state.
  // Default to `true` (enabled) if no setting is found.
  chrome.storage.sync.get({ notificationsEnabled: true }, (items) => {
    notificationsToggle.checked = items.notificationsEnabled;
  });

  // Save the setting whenever the toggle is changed.
  notificationsToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ notificationsEnabled: notificationsToggle.checked });
  });

  // Get current song information from storage
  chrome.storage.local.get(['currentSong'], (result) => {
    if (result.currentSong && result.currentSong.trackName) {
      const { trackName, artistName, imageUrl } = result.currentSong;
      songInfoElement.innerHTML = `
        ${imageUrl ? `<img src="${imageUrl}" class="song-image" alt="Album art">` : ''}
        <div>
          <div class="song-title">${trackName}</div>
          <div class="song-artist">by ${artistName}</div>
        </div>
      `;
    }
  });
});
