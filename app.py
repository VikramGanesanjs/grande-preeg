# app.py
import time
from flask import Flask
from flask_socketio import SocketIO
from pylsl import StreamInlet, resolve_byprop

app = Flask(__name__)
# cors_allowed_origins="*" allows the mobile app to connect without security blocks
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

def stream_lsl_eeg():
    print("\n[EEG] Looking for LSL stream...")
    # Scans the network for the Unicorn broadcast
    streams = resolve_byprop('type', 'Data', timeout=10)
    
    if not streams:
        print("[EEG] No stream found. Make sure unicornlsl.exe is running!")
        return

    inlet = StreamInlet(streams[0])
    print("[EEG] Connected to headset! Streaming live data to mobile app...")

    while True:
        # Pull the live data
        sample, timestamp = inlet.pull_sample(timeout=1.0)
        if sample:
            # The Unicorn sends 17 channels, but only the first 8 are EEG brainwaves
            eeg_data = sample[:8]
            
            # Emit the array of 8 numbers directly to the React Native app
            socketio.emit('eeg_data', {'data': eeg_data})
            
        # A tiny sleep prevents the while-loop from maxing out your CPU
        time.sleep(0.01)

@socketio.on('connect')
def handle_connect():
    print("\n📱 Mobile app successfully connected!")
    # Start pulling the brainwaves the moment the app opens
    socketio.start_background_task(target=stream_lsl_eeg)

@socketio.on('disconnect')
def handle_disconnect():
    print("\n⚠️ Mobile app disconnected.")

if __name__ == '__main__':
    print("🚀 Starting Python WebSocket Server on port 5000...")
    # host='0.0.0.0' tells the server to accept connections from the phone on the hotspot
    socketio.run(app, host='0.0.0.0', port=5000)

