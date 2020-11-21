import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  DeviceEventEmitter
} from 'react-native';
import Video from './video';
import VideoFunctions from './VideoFunctions';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Modalize } from 'react-native-modalize';
import HeadphoneDetection from 'react-native-headphone-detection';

const { width, height } = Dimensions.get('screen');

class App extends React.Component {
  constructor(props) {
    super(props)
    this.modalizeRef = React.createRef();
    this.state = {
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
    this.eventListener = null;
    this.headPhoneListener = null;
}

componentDidMount = () => {
    console.log('In The Call Component');
    this.eventListener = DeviceEventEmitter.addListener('statesUpdated',()=>{
        let currentState = VideoFunctions.currentState();
        // console.log(currentState);
        this.setState(currentState);
    });
    this.headPhoneListener = HeadphoneDetection.addListener(headPhoneStates=>{
        this.setState({
            audioConnected:headPhoneStates.audioJack,
            bluetoothConnected:headPhoneStates.bluetooth
        });
    });
    VideoFunctions.joinRoom();
}

componentWillUnmount(){
    this.eventListener.remove();
    this.headPhoneListener.remove();
    VideoFunctions.disconnect();
}
  
render() {
    const {
      localStream,
      remoteStreams,
    } = this.state;

    // debugger
    const remoteVideos = remoteStreams.map(rStream => {
      return (
        <TouchableOpacity>
          <View
            style={{
              flex: 1,
              width: 100,
              height: 150,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 2,
              margin: 10,
              borderRadius: 20,
              borderWidth:0.5,
              borderColor:'white'
            }}>
            <Video
              key={Math.random()}
              mirror={true}
              style={{ ...styles.rtcViewRemote }}
              objectFit='contain'
              streamURL={rStream.stream}
              type='remote'
            />
          </View>
        </TouchableOpacity>
      )
    })
    const ActionButtons = (
      <View style={{
        ...styles.buttonsContainer,
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 5, position: 'absolute', bottom: 0, alignSelf: 'center'
      }}>
        <TouchableOpacity style={{flex:0.33,margin:4}} onPress={VideoFunctions.cameraToggle}>
          <Text style={styles.BottomButtons}>{this.state.camera?'Hide':'Show'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{flex:0.33,margin:4}} onPress={VideoFunctions.audioToggle}>
          <Text style={styles.BottomButtons}>{this.state.mic?'Mute':'Unmute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{flex:0.33,margin:4}} onPress={()=>{
            VideoFunctions.disconnect();
            this.props.navigation.goBack();       
          }}>
          <Text style={styles.BottomButtons}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    )
    return (
      <SafeAreaView style={{ flex: 1, }}>
        <StatusBar backgroundColor="transparent" barStyle={'light-content'} />
        {localStream ? (
          <View>
            <Modalize
              ref={this.modalizeRef}
              modalHeight={300}
              handlePosition='outside'
              closeOnOverlayTap
              withHandle
            >
              <View>
                {/* AUDIO CONTROLS */}
                <TouchableOpacity style={{flexDirection:'row', padding:5}} onPress={async()=>{
                  await VideoFunctions.toggleSpeakers();;
                }}>
                  <MaterialIcons name="speaker-phone" size={25} color="black" style={{flex:0.2}}/>
                  <Text style={{flex:0.6, fontSize:13, fontWeight:'bold'}}>Speakers</Text>
                  {this.state.speakers&&(
                    <MaterialIcons name="done" size={25} color="blue" style={{flex:0.2}}/>                  
                  )}
                </TouchableOpacity>
                <View style={{padding:5}}>
                  {this.state.audioConnected?(
                    <TouchableOpacity style={{flexDirection:'row'}}>
                      <MaterialIcons name="headset" size={25} color="black" style={{flex:0.2}}/>
                      <Text style={{flex:0.8, fontSize:13, fontWeight:'bold'}}>Wired Headset</Text>
                    </TouchableOpacity>
                  ):(
                    <TouchableOpacity style={{flexDirection:'row'}}>
                    <MaterialIcons name="phone" size={25} color="black" style={{flex:0.2}}/>
                    <Text style={{flex:0.8, fontSize:13, fontWeight:'bold'}}>Phone</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Modalize>
            <View style={{ width: width * 0.90, alignSelf: 'center', borderRadius: 50, marginTop: '5%' }}>
              <View style={{flexDirection:'row'}}>
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', flex:0.6 }}>{this.state.status}</Text>
                <TouchableOpacity style={{flex:0.4}} onPress={()=>{
                  this.modalizeRef.current.open();
                }}>
                  <MaterialCommunityIcons name="menu" color="white" size={15} style={{alignSelf:'flex-end'}}/>
                </TouchableOpacity>
              </View>
              <Video
                key={3}
                zOrder={9998}
                objectFit={'cover'}
                style={{ backgroundColor: 'white', borderWidth: 1, borderColor: 'white', height: height * 0.60, borderRadius: 50 }}
                streamURL={localStream}
              />
            </View>
            {remoteVideos && (
              <ScrollView horizontal style={{ ...styles.scrollView }}>
                {remoteVideos}
              </ScrollView>
            )}            
          </View>

        ) : (
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', padding: 50, textAlignVertical: 'center', textAlign: 'center' }}>Creating a room for you...</Text>
          )}
        {ActionButtons}
      </SafeAreaView>
    );
  }
};

const styles = StyleSheet.create({
  buttonsContainer: {
    flexDirection: 'row',
    width:'90%',
    alignSelf:'center'
  },
  button: {
    margin: 5,
    paddingVertical: 10,
    backgroundColor: 'lightgrey',
    borderRadius: 5,
  },
  textContent: {
    fontFamily: 'Avenir',
    fontSize: 20,
    textAlign: 'center',
  },
  videosContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rtcView: {
    width: 100, //dimensions.width,
    height: 150,//dimensions.height / 2,
    backgroundColor: 'black',
    borderRadius: 5,
  },
  scrollView: {
    // flex: 1,
    // // flexDirection: 'row',
    // backgroundColor: 'black',
    // padding: 15,
    // position: 'absolute',
    // zIndex: 0,
    // bottom: 10,
    height:height*0.20,
    // right: 0,
    // left: 0,
    // width: 100, height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  rtcViewRemote: {
     //dimensions.width,
    width:100,
    height: height*0.20, //dimensions.height / 2,
    // backgroundColor: 'black',
    borderRadius: 5,
  },
  BottomButtons: { 
    padding: 10, 
    fontWeight: 'bold', 
    color: 'white', 
    borderWidth: 1, 
    borderColor: 'white', 
    borderRadius: 15,
    textAlign:'center' 
  }
});

export default App;