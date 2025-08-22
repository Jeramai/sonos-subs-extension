// This script is injected into the page's main world to "monkey-patch"
// the `fetch` function.
(function () {
  // Store the original `fetch` function
  const originalFetch = window.fetch;

  // Override the `fetch` function
  window.fetch = function (...args) {
    // Log every fetch request for debugging purposes.
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
          const trackName = data.title;
          const artistName = data.subtitle;
          console.log(`Sonos-Subs Extension: Now playing "${trackName}" by "${artistName}"`);
          // Send desktop notification here
          new Notification('Now Playing', {
            body: `${trackName} by ${artistName}`,
            icon: 'icons/icon48.png' // Use your extension's icon
          });

          // TODO: Send this data back to the content script for processing
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
