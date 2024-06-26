let APP_ID = "9afb4ffababd49b7b23b54e1779f7ab5";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId){
    window.location = 'lobby.html'
}

let localStream;
let remoteStream;
let peerConnection;


const servers  = {
    iceServers:[
        {
            urls:['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
        }
    ]
}


let constraints = {
    video:{
        width:{min:640, ideal: 1920, max:1920},
        height:{min:480, ideal: 1080, max:1080},
    },
    audio: true
}


let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleUserJoined)
    channel.on('MemberLeft', handleUserLeft)

    client.on('MessageFromPeer', handleMessageFromPeer)
    document.getElementById('camera-off-btn').style.display = 'block'
    document.getElementById('camera-btn').style.display = 'none'    
    document.getElementById('mic-off-btn').style.display = 'block'
    document.getElementById('mic-btn').style.display = 'none'

    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user-1').srcObject = localStream


}

let addAnswer =  async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        await peerConnection.setRemoteDescription(answer)
    }
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse( message.text)
    if (message.type == 'offer') {
        await createAnswer(MemberId, message.offer);
    }

    if (message.type == 'answer') {
        await addAnswer(message.answer);
    }

    if (message.type == 'candidate') {
        if (peerConnection) {
            await peerConnection.addIceCandidate(message.candidate); // Wait for remote description to be set
        }
    }
    console.log('Message: ', message)
}

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel. UID:', uid )
    createOffer(MemberId)

}

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('small-frame')

}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream =  new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'
   
    document.getElementById('user-1').classList.add('small-frame')

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
        
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }


    peerConnection.onicecandidate = async (event) =>  {
        if (event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
        }
    }
}

let createOffer = async (MemberId) => {

    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
}

let createAnswer = async (MemberId, offer) => {

    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)


}


let leaveChannel = async () =>{
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-off-btn').style.display = 'block'
        document.getElementById('camera-btn').style.display = 'none'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-off-btn').style.display = 'none'
        document.getElementById('camera-btn').style.display = 'block'

    }
}   

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-off-btn').style.display = 'block'
        document.getElementById('mic-btn').style.display = 'none'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-off-btn').style.display = 'none'
        document.getElementById('mic-btn').style.display = 'block'

    }
}   


window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('camera-off-btn').addEventListener('click', toggleCamera)


document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('mic-off-btn').addEventListener('click', toggleMic)


init()