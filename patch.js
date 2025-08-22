// This script is injected into the page's main world to "monkey-patch"
// the `fetch` function.
(function () {
  // Store the original `fetch` function
  const originalFetch = window.fetch;
  // Keep track of the last song we sent a notification for to avoid duplicates.
  let lastNotifiedTrackId = null;

  // Override the `fetch` function
  window.fetch = function (...args) {
    const url = (args[0] instanceof Request) ? args[0].url : args[0];

    // Intercept the `nowplaying` API call
    if (typeof url === 'string' && url.includes('nowplaying')) {
      // Call the original fetch and then process the response
      return originalFetch(...args).then(response => {
        // Ensure the response is cloned so we can read it without
        // preventing the original page's code from reading it.
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
          // Check if the data has the song information
          const trackName = data?.title;
          const artistName = data?.subtitle;
          const imageUrl = data?.images?.tile1x1;
          const currentTrackId = trackName && artistName ? `${trackName} by ${artistName}` : null;

          // Only send a notification if we have a valid song and it's different from the last one.
          if (currentTrackId && currentTrackId !== lastNotifiedTrackId) {
            // Update the state to the new song.
            lastNotifiedTrackId = currentTrackId;

            // Send the song data to the content script via a custom event
            const event = new CustomEvent('SonosNowPlaying', { detail: { trackName, artistName, imageUrl } });
            window.dispatchEvent(event);
          }
        }).catch(e => console.error("Error processing nowplaying response:", e));

        // Return the original response so the page functions as expected
        return response;
      }).catch(e => {
        console.error("Error during fetch interception:", e);
        // Re-throw the error so the original application sees it
        throw e;
      });
    }
    // For all other requests, just pass them through to the original `fetch`
    return originalFetch(...args);
  };
})();
