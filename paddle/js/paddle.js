// Global vars
var state = {
    SpkEnabled: false,
    SpkSampleRate: 8000,
    SpkChannels: 1,
    SpkCodec: "pcm",
    MicEnabled: false,
    MicSampleRate: 8000,
    MicChannels: 1,
    MicCodec: "pcm",

};

let ws;
let socketURL = "wss://qth.w6xm.org:8443/";
let player = new PCMPlayer({
    encoding: "16bitInt",
    channels: 1,
    sampleRate: 8000,
    flushingTime: 100
});
let audioContext;
let mediaStream;
let audioProcessorNode;

////////////////////////////////////////////////////////////////////////////////
// Setup
////////////////////////////////////////////////////////////////////////////////

// spkButton.disabled = true;
// micButton.disabled = true;
// ping.disabled = true;
// heading.disabled = true; 

resampler = new Resampler(48000, 8000, 1, 4096);  // TODO fix this for 44.1khz devices

////////////////////////////////////////////////////////////////////////////////
// Functions
////////////////////////////////////////////////////////////////////////////////

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function paddle_connect() {
    try {
	ws = new WebSocket(socketURL);
	ws.binaryType = "arraybuffer";
	ws.addEventListener("message", function(event){
	    var data = new Int16Array(event.data);
	    player.feed(data);
	    player.volume(1);
	});
	console.log("Connected to", socketURL);
	return 0;
    }
    catch (error) {
	console.error("Error connecting: ", error);
    }
}

function paddle_disconnect() {
    stopMicrophone();
    stopSpeaker();
    ws.close();
    console.log("Disconnected from", socketURL);
}

function handleAudioProcess(event) {
    const inputData = resampler.resample(event.inputBuffer.getChannelData(0));

    // Convert audio data to PCM format
    const pcmData = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = inputData[i] * 32767; // Convert to 16-bit PCM
    }
    
    // Send PCM data to WebSocket server
    if (ws && ws.readyState === WebSocket.OPEN && state.MicEnabled) {
	ws.send(pcmData);
    }
}

function startSpeaker() {
    state.SpkEnabled = true;
    try {
	ws.send(JSON.stringify(state));
	console.log("Speaker started");
    }
    catch(error) {
	console.error("Error starting speaker: ", error);
    }
}

function stopSpeaker() {
    state.SpkEnabled = false;
    try {
	ws.send(JSON.stringify(state));
	console.log("Speaker stopped");
    }
    catch(error){
	console.error("Error stopping speaker: ", error);
    }
}

async function startMicrophone() {
    // Initialize the audio context and get the user microphone
    let constraints = {
	audio: {
	    channelCount: 1,
	    sampleRate: { exact: 48000 },
	    sampleSize: 16,
	    volume: 1
	},
    };
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Create a ScriptProcessorNode to process audio
    const audioProcessorNode = audioContext.createScriptProcessor(4096, 1, 1); // deprecated
    audioProcessorNode.onaudioprocess = handleAudioProcess;              // deprecated

    // Connect the microphone stream to the processor node
    const microphoneSource = audioContext.createMediaStreamSource(mediaStream);
    microphoneSource.connect(audioProcessorNode);
    audioProcessorNode.connect(audioContext.destination);

    state.MicEnabled = true;
    try {
	ws.send(JSON.stringify(state));
	console.log("Microphone started");
    }
    catch(error){
	console.error("Error starting microphone: ", error);
    }
}

function stopMicrophone() {
    try {
	if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); };
	if (audioProcessorNode) { audioProcessorNode.disconnect(); };
	if (audioProcessorNode) { audioProcessorNode.close(); };
	
    }
    catch(error) {
	console.error("Error stopping audio things:", error);
    }

    state.MicEnabled = false;
    try {
	ws.send(JSON.stringify(state));
	console.log("Microphone stopped");
    }
    catch(error){
	console.error("Error stopping microphone: ", error);
    }
}


function toggleHeadphones() {
    const btn = document.getElementById('paddle_toggle_headphones_button');
    if (btn.classList.contains("noVNC_selected")) {
	console.log("trying to stop the speaker");
	stopSpeaker()
        btn.classList.remove("noVNC_selected");
    } else {
	console.log("trying to start the speaker");
	startSpeaker();
        btn.classList.add("noVNC_selected");
    }
}

function toggleMicrophone() {
    const btn = document.getElementById('paddle_toggle_microphone_button');
    if (btn.classList.contains("noVNC_selected")) {
	console.log("trying to stop the microphone");
	stopMicrophone()
        btn.classList.remove("noVNC_selected");
    } else {
	console.log("trying to start the microphone");
	startMicrophone();
        btn.classList.add("noVNC_selected");
    }
}

// Make the function wait until the connection is made...
function waitForSocketConnection(socket, callback){
    setTimeout(
        function () {
            if (socket.readyState === 1) {
                console.log("Connection is made")
                if (callback != null){
                    callback();
                }
            } else {
                console.log("wait for connection...")
                waitForSocketConnection(socket, callback);
            }

        }, 5); // wait 5 milisecond for the connection...
}

function paddle_start() {
    paddle_connect();

    waitForSocketConnection(ws, function(){
        console.log("message sent!!!");
       	toggleHeadphones();
	toggleMicrophone();
    });
}

////
// paddle_connect();
