const OriginalWebSocket = window.WebSocket;
window.WebSocket = function (url, protocols) {
  const socket = new OriginalWebSocket(url, protocols);

  const messageListener = (event) => {
    try {
      const messageText = JSON.parse(event.data);

      // Look for messages containing playback state information
      if (messageText?.[1]?.playback?.playbackState === "PLAYBACK_STATE_PLAYING") {
        const track = messageText?.[1]?.metadata?.currentItem?.track
        if (track && track.name && track.artist?.name) {
          const trackInfo = {
            artist: track.artist.name,
            title: track.name,
            album: track.album?.name,
            imageUrl: track.imageUrl,
          };
          window.postMessage({ type: 'SONOS_TRACK_INFO', track: trackInfo }, window.location.origin);
        }
      }
    } catch (e) {
      console.warn('SONOS-SUBS: ', e)
    }
  };

  socket.addEventListener('message', messageListener);
  return socket;
};

window.WebSocket.prototype = OriginalWebSocket.prototype;
