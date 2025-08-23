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
});
