import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
    MediaStream,
    MediaStreamTrack,
    mediaDevices,
    registerGlobals
} from 'react-native-webrtc';
import { DeviceEventEmitter } from 'react-native';  
import io from 'socket.io-client';
import RNSwitchAudioOutput from 'react-native-switch-audio-output';

let states = {
    localStream: null,    // used to hold local stream object to avoid recreating the stream everytime a new offer comes
    remoteStream: null,    // used to hold remote stream object that is displayed in the main screen
    remoteStreams: [],    // holds all Video Streams (all remote streams)
    peerConnections: {},  // holds all Peer Connections
    selectedVideo: null,
    status: 'Please wait...',
    pc_config: {
      "iceServers": [
        {
          "url": 'stun:stun.l.google.com:19302'
        },
      ]
    },
    sdpConstraints: {
      'mandatory': {
        'OfferToReceiveAudio': true,
        'OfferToReceiveVideo': true
      }
    },
    messages: [],
    sendChannels: [],
    disconnected: false,
    room: 'room1',
    connect: false,
    camera: true,
    mic: true,
    audioConnected:false,
    bluetoothConnected:false,
    speakers:false
}
const serviceIP = 'https://52d65ec21c23.ngrok.io/webrtcPeer';
let socket = null;
// ALL FUNCTIONS
whoisOnline = () => {
    // let all peers know I am joining
    sendToPeer('onlinePeers', null, { local: socket.id })
}
function sendToPeer(messageType, payload, socketID){
    socket.emit(messageType, {
        socketID,
        payload
    });
}
function getLocalStream(){
    const success = (stream) => {
        console.log('localStream... ', stream.toURL())
        states.localStream = stream;
        emitEventForStateChange('LocalStream');
        whoisOnline()
    }
    const failure = (e) => {
        console.log('getUserMedia Error: ', e)
    }
    let isFront = true;
    mediaDevices.enumerateDevices().then(sourceInfos => {
        console.log(sourceInfos);
        let videoSourceId;
        for (let i = 0; i < sourceInfos.length; i++) {
            const sourceInfo = sourceInfos[i];
            if (sourceInfo.kind == "videoinput" && sourceInfo.facing == (isFront ? "front" : "environment")) {
                videoSourceId = sourceInfo.deviceId;
            }
        }
        const constraints = {
            audio: true,
            video: {
                mandatory: {
                    minWidth: 500, // Provide your own width, height and frame rate here
                    minHeight: 300,
                    minFrameRate: 30
                },
                facingMode: (isFront ? "user" : "environment"),
                optional: (videoSourceId ? [{ sourceId: videoSourceId }] : [])
            }
        }
        mediaDevices.getUserMedia(constraints)
            .then(success)
            .catch(failure);
    });
}
function createPeerConnection(socketID, callback){
    try {
      let pc = new RTCPeerConnection(states.pc_config);

      // ADD PC to PeerConnections Object
      const peerConnections = { ...states.peerConnections, [socketID]: pc };
      states.peerConnections = peerConnections;
      emitEventForStateChange();
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendToPeer("candidate", e.candidate, {
            local: socket.id,
            remote: socketID,
          });
        }
      };
      pc.oniceconnectionstatechange = (e) => {
        if (pc.iceConnectionState === "disconnected") {
            const remoteStreams = states.remoteStreams.filter(
                (stream) => stream.id !== socketID
            );
            states.remoteStream =
                (remoteStreams.length > 0 && remoteStreams[0].stream) || null;
            emitEventForStateChange();
        }
      };
      pc.onaddstream = (e) => {
        debugger;
        let _remoteStream = null;
        let remoteStreams = states.remoteStreams;
        let remoteVideo = {};
        // if (e.stream.getTracks().length === 2) alert(e.stream.getTracks()[0].kind)
        // let swappedStream = new MediaStream()
        // console.log('0...', swappedStream)
        // e.stream.getAudioTracks() && swappedStream.addTrack(e.stream.getAudioTracks()[0])
        // console.log('1...', swappedStream)
        // e.stream.getVideoTracks() && swappedStream.addTrack(e.stream.getVideoTracks()[0])
        // console.log('2...', swappedStream)
        // 1. check if stream already exists in remoteStreams
        // const rVideos = this.state.remoteStreams.filter(stream => stream.id === socketID)
        remoteVideo = {
          id: socketID,
          name: socketID,
          stream: e.stream,
        };
        remoteStreams = [...states.remoteStreams, remoteVideo];
        states.remoteStreams = remoteStreams;
        emitEventForStateChange();
        // 2. if it does exist then add track
        // if (rVideos.length) {
        //   _remoteStream = rVideos[0].stream
        //   _remoteStream.addTrack(e.track, _remoteStream)
        //   remoteVideo = {
        //     ...rVideos[0],
        //     stream: _remoteStream,
        //   }
        //   remoteStreams = this.state.remoteStreams.map(_remoteVideo => {
        //     return _remoteVideo.id === remoteVideo.id && remoteVideo || _remoteVideo
        //   })
        // } else {
        //   // 3. if not, then create new stream and add track
        //   _remoteStream = new MediaStream()
        //   _remoteStream.addTrack(e.track, _remoteStream)

        //   remoteVideo = {
        //     id: socketID,
        //     name: socketID,
        //     stream: _remoteStream,
        //   }
        //   remoteStreams = [...this.state.remoteStreams, remoteVideo]
        // }
        // const remoteVideo = {
        //   id: socketID,
        //   name: socketID,
        //   stream: e.streams[0]
        // }
        //   this.setState(prevState => {
        //     // If we already have a stream in display let it stay the same, otherwise use the latest stream
        //     // const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.streams[0] }
        //     const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.stream }
        //     // get currently selected video
        //     let selectedVideo = prevState.remoteStreams.filter(stream => stream.id === prevState.selectedVideo.id)
        //     // if the video is still in the list, then do nothing, otherwise set to new video stream
        //     selectedVideo = selectedVideo.length ? {} : { selectedVideo: remoteVideo }

        //     return {
        //       // selectedVideo: remoteVideo,
        //       ...selectedVideo,
        //       // remoteStream: e.streams[0],
        //       ...remoteStream,
        //       remoteStreams, //: [...prevState.remoteStreams, remoteVideo]
        //     }
        //   })
      };
      pc.close = (e) => {
        console.log("Connection Dropped Out");
        console.log(e);
      };
      if (states.localStream) {
        pc.addStream(states.localStream);
        //   // this.state.localStream.getTracks().forEach(track => {
        //   //   pc.addTrack(track, this.state.localStream)
        //   // })
      }
      // return pc
      callback(pc);
    } catch (e) {
      console.log("Something went wrong! pc not created!!", e);
      // return;
      callback(null);
    }
}
function joinRoom(){
    const room = states.room || '';
    socket = io.connect(
        serviceIP,
        {
          path: '/io/webrtc',
          query: {
            room: `/${room}`, //'/',
          }
        }
    );
    socket.on('connection-success', data => {
        getLocalStream();
        console.log(data.success);
        const status = data.peerCount > 1 ? `Total Connected Peers to room ${states.room}: ${data.peerCount}` : states.status
        states.status = status;
        states.messages = data.messages;
        emitEventForStateChange();
    });
    socket.on('joined-peers', data => {
        states.status = data.peerCount > 1 ? `No. of users in this chat: ${data.peerCount}` : 'Waiting for others to connect';
        emitEventForStateChange();
    });
    socket.on('peer-disconnected', data => {
        console.log('peer-disconnected', data)
        const remoteStreams = states.remoteStreams.filter(stream => stream.id !== data.socketID)
        states.remoteStreams = remoteStreams;
        states.status = data.peerCount > 1 ? `No. of users in this chat: ${data.peerCount}` : 'Waiting for others to connect';
        emitEventForStateChange();
    });
    socket.on('online-peer', socketID => {
        debugger
        console.log('connected peers ...', socketID)
        // create and send offer to the peer (data.socketID)
        // 1. Create new pc
        createPeerConnection(socketID, pc => {
          // 2. Create Offer
        if (pc) {
            // Send Channel
            const handleSendChannelStatusChange = (event) => {
              console.log('send channel status: ' + states.sendChannels[0].readyState)
            }
            const sendChannel = pc.createDataChannel('sendChannel')
            sendChannel.onopen = handleSendChannelStatusChange;
            sendChannel.onclose = handleSendChannelStatusChange;
            states.sendChannels.push(sendChannel);
            emitEventForStateChange();
            // Receive Channels
            let receiveChannel = null;
            const handleReceiveMessage = (event) => {
                const message = JSON.parse(event.data)
                console.log(message)
                states.messages.push(message);
                emitEventForStateChange();
            }
            const handleReceiveChannelStatusChange = (event) => {
              if (receiveChannel) {
                console.log("receive channel's status has changed to " + receiveChannel.readyState);
              }
            }
            const receiveChannelCallback = (event) => {
              receiveChannel = event.channel
              receiveChannel.onmessage = handleReceiveMessage
              receiveChannel.onopen = handleReceiveChannelStatusChange
              receiveChannel.onclose = handleReceiveChannelStatusChange
            }
            pc.ondatachannel = receiveChannelCallback
            pc.createOffer(states.sdpConstraints)
              .then(sdp => {
                pc.setLocalDescription(sdp)
                sendToPeer('offer', sdp, {
                  local: socket.id,
                  remote: socketID
                })
            });
        }
        });
    });
    socket.on('offer', data => {
        createPeerConnection(data.socketID, pc => {
            pc.addStream(states.localStream)
            // Send Channel
            const handleSendChannelStatusChange = (event) => {
                console.log('send channel status: ' + states.sendChannels[0].readyState)
            }
            const sendChannel = pc.createDataChannel('sendChannel')
            sendChannel.onopen = handleSendChannelStatusChange
            sendChannel.onclose = handleSendChannelStatusChange
            states.sendChannels.push(sendChannel); 
            emitEventForStateChange();    
              // Receive Channels
            const handleReceiveMessage = (event) => {
            const message = JSON.parse(event.data)
            console.log(message)
            states.messages.push(message);
            emitEventForStateChange();
            }
            let receiveChannel = null;
            const handleReceiveChannelStatusChange = (event) => {
                if (receiveChannel) {
                    console.log("receive channel's status has changed to " + receiveChannel.readyState);
                }
            }
            const receiveChannelCallback = (event) => {
                receiveChannel = event.channel
                receiveChannel.onmessage = handleReceiveMessage
                receiveChannel.onopen = handleReceiveChannelStatusChange
                receiveChannel.onclose = handleReceiveChannelStatusChange
            }
            pc.ondatachannel = receiveChannelCallback
              //debugger
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
                // 2. Create Answer
                pc.createAnswer(states.sdpConstraints)
                  .then(sdp => {
                    pc.setLocalDescription(sdp)
      
                    sendToPeer('answer', sdp, {
                      local: socket.id,
                      remote: data.socketID
                    })
                  })
                })
            })
        });
    socket.on('answer', data => {
        // get remote's peerConnection
        const pc = states.peerConnections[data.socketID]
        // console.log(data.sdp)
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => { })
    });
    socket.on('candidate', (data) => {
        // get remote's peerConnection
        const pc = states.peerConnections[data.socketID]
        if (pc)
            pc.addIceCandidate(new RTCIceCandidate(data.candidate))
    });
}
function currentState(){
    return states;
}
function emitEventForStateChange(stateName){
    stateName = stateName ? stateName : 'unknown';
    console.log('State Updated: ' + stateName);
    DeviceEventEmitter.emit('statesUpdated', states);
}
function closeSocket(){
    socket.close();
}
function stopTracks(stream){
    if(stream){
        stream.getTracks().forEach(track => track.stop())
    }
    return stream;
}
function stopPeerConnections(){
    states.peerConnections && Object.values(states.peerConnections).forEach(pc => pc.close())
}
function resetStates(){
    states = Object.assign(states,{
        connect: false,
        peerConnections: {},
        remoteStreams: [],
        localStream: null,
        remoteStream: null,
        selectedVideo: null,
    });
}
function cameraToggle(){
    if(states.localStream){
        debugger
        const videoTrack = states.localStream.getTracks().filter(track => track.kind === 'video')
        videoTrack[0].enabled = !videoTrack[0].enabled
        states.camera = videoTrack[0].enabled;
        emitEventForStateChange();
    }
}
function audioToggle(){
    debugger
    if(states.localStream){
        const audioTrack = states.localStream.getTracks().filter(track => track.kind === 'audio')
        audioTrack[0].enabled = !audioTrack[0].enabled
        states.mic = audioTrack[0].enabled;
        emitEventForStateChange();    
    }
}
function disconnect(){
    closeSocket();
    if(states.localStream){
      stopTracks(states.localStream)
      states.remoteStreams.forEach(rVideo => stopTracks(rVideo.stream))
      stopPeerConnections();
      resetStates();
      emitEventForStateChange();
    }
}
async function toggleSpeakers(){
    if(states.speakers){
        const promise = Promise.resolve(RNSwitchAudioOutput.selectAudioOutput(RNSwitchAudioOutput.AUDIO_HEADPHONE));
        promise.then(response=>{
            states.speakers = false;
            emitEventForStateChange();
        }).catch(err=>{
          console.log(err);
        });
    }
    else{
        const promise = Promise.resolve(RNSwitchAudioOutput.selectAudioOutput(RNSwitchAudioOutput.AUDIO_SPEAKER));
        promise.then(response=>{
            states.speakers = true;
            emitEventForStateChange();
        }).catch(err=>{
          console.log(err);
        }); 
    }
}
const AllFunctions = {
    joinRoom,
    currentState,
    cameraToggle,
    audioToggle,
    disconnect,
    toggleSpeakers
}
export default AllFunctions;