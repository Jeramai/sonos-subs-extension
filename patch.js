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
        if (track && track.name && track.artist?.name) {
          const trackInfo = {
            artist: track.artist.name,
            title: track.name,
            album: track.album?.name,
            imageUrl: track.imageUrl,
          };

          const isPlaying = messageText?.[1]?.playback?.playbackState === "PLAYBACK_STATE_PLAYING"
          window.postMessage({ type: 'SONOS_TRACK_INFO', track: trackInfo, isPlaying }, window.location.origin);
        }
      }
      // Check for the groupId
      else if (messageText?.[0]?.type === "devicesStatus" && messageText?.[1]?.devices?.[0]?.groupId) {
        groupId = messageText?.[1]?.devices?.[0]?.groupId
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
  if (event.source !== window || event.data.type !== 'SONOS_COMMAND' || !groupId) return;

  if (currentSocket) {
    const command = event.data.command
    console.log('SONOS-SUBS: Sending command:', command);

    let props = {}
    if (command === 'play' || command === 'pause') {
      // When sending a play command, include this property to avoid TV playback issues
      props = {
        "allowTvPauseRestore": true,
        "deviceFeedback": "NONE"
      }
    }


    const commandMessage = JSON.stringify([{
      "command": command,
      "namespace": "playback",
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


