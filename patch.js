const OriginalWebSocket = window.WebSocket;
let currentSocket = null;
let groupId = null;

window.WebSocket = function (url, protocols) {
  const socket = new OriginalWebSocket(url, protocols);
  currentSocket = socket;

  const messageListener = (event) => {
    try {
      const messageText = JSON.parse(event.data);
      // console.log('E', ...messageText)

      // Look for messages containing playback state information
      if (messageText?.[0]?.type === "extendedPlaybackStatus" && (
        messageText?.[1]?.playback?.playbackState === "PLAYBACK_STATE_PLAYING" ||
        messageText?.[1]?.playback?.playbackState === "PLAYBACK_STATE_PAUSED"
      )) {

        const track = messageText?.[1]?.metadata?.currentItem?.track
        const positionMillis = messageText?.[1]?.playback?.positionMillis ?? 0
        if (track && track.name && track.artist?.name) {
          const trackInfo = {
            id: track.id.objectId,
            artist: track.artist.name,
            title: track.name,
            album: track.album?.name,
            imageUrl: null,
            durationMillis: track.durationMillis
          };

          const isPlaying = messageText?.[1]?.playback?.playbackState === "PLAYBACK_STATE_PLAYING"
          window.postMessage({ type: 'SONOS_TRACK_INFO', track: trackInfo, isPlaying, positionMillis }, window.location.origin);
        }
      }
      // Check for the groupId
      else if (messageText?.[0]?.type === "devicesStatus" && messageText?.[1]?.devices?.[0]?.groupId) {
        groupId = messageText?.[1]?.devices?.[0]?.groupId
      }
      // Get volume info
      else if (messageText?.[0]?.type === "groupVolume") {
        window.postMessage({
          type: 'SONOS_VOLUME_INFO',
          volume: messageText?.[1]?.volume,
          muted: messageText?.[1]?.muted
        }, window.location.origin);
      }
    } catch (e) {
      console.warn('SONOS-SUBS: ', e)
    }
  };

  socket.addEventListener('message', messageListener);
  return socket;
};
window.WebSocket.prototype = OriginalWebSocket.prototype;

// Listen for commands from content script
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data.type !== 'SONOS_COMMAND' || !groupId) return;

  if (currentSocket) {
    const command = event.data.command
    console.log('SONOS-SUBS: Sending command:', command);

    // namespace
    let namespace = "playback"
    if (command === 'setMute' || command === 'setVolume') {
      namespace = "groupVolume"
    }

    // Props
    let props = event.data.props ?? {}

    const commandMessage = JSON.stringify([{
      "command": command,
      "namespace": namespace,
      "groupId": groupId,
      "corrId": crypto.randomUUID()
    },
    {
      ...props
    }]
    );
    currentSocket.send(commandMessage);
  }
});

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  // Log every fetch request for debugging purposes.
  const url = (args[0] instanceof Request) ? args[0].url : args[0];

  // Intercept the `nowplaying` API call
  if (typeof url === 'string' && url.includes('nowplaying')) {
    // Call the original fetch and then process the response
    try {
      const response = await originalFetch(...args);
      // Ensure the response is cloned so we can read it without
      // preventing the original page's code from reading it.
      const clonedResponse = response.clone();
      clonedResponse.json().then(data => {
        // Check if the data has the song information
        const trackId = data.item.resource.id.objectId;
        const httpsImage = data.images.tile1x1;

        // Send to content script
        window.postMessage({
          type: 'SONOS_ARTWORK_UPDATE',
          trackId,
          httpsImage
        }, window.location.origin);
      }).catch(e => console.error("Error processing nowplaying response:", e));
      return response;
    } catch (e_1) {
      console.error("Error during fetch interception:", e_1);
      // Re-throw the error so the original application sees it
      throw e_1;
    }
  }
  // For all other requests, just pass them through to the original `fetch`
  return originalFetch(...args);
};
