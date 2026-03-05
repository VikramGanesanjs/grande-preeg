#!/usr/bin/env python3
"""
LSL EEG Reader Script

This script reads EEG data from an LSL stream and outputs it as JSON to stdout.
It's designed to be spawned by the Node.js server for real-time EEG data streaming.

Usage:
    python lsl_reader.py [--source-type TYPE] [--source-value VALUE] [--channels N]

Output format (one JSON object per line):
    {"type": "data", "data": [ch1, ch2, ...], "timestamp": 1234567890.123}
    {"type": "status", "message": "Connected to stream"}
    {"type": "error", "message": "Error description"}
"""

import sys
import json
import time
import argparse
from pylsl import StreamInlet, resolve_byprop, resolve_stream


def send_message(msg_type: str, **kwargs):
    """Send a JSON message to stdout for Node.js to consume."""
    message = {"type": msg_type, **kwargs}
    print(json.dumps(message), flush=True)


def main():
    parser = argparse.ArgumentParser(description='Read EEG data from LSL stream')
    parser.add_argument('--source-type', default='type', 
                        help='Property type to search for (default: type)')
    parser.add_argument('--source-value', default='Data',
                        help='Property value to search for (default: Data)')
    parser.add_argument('--channels', type=int, default=8,
                        help='Number of EEG channels to extract (default: 8)')
    parser.add_argument('--timeout', type=float, default=10.0,
                        help='Stream discovery timeout in seconds (default: 10)')
    args = parser.parse_args()

    send_message("status", message="Looking for LSL stream...")
    
    try:
        streams = resolve_byprop(args.source_type, args.source_value, timeout=args.timeout)
        
        if not streams:
            send_message("error", message=f"No LSL stream found with {args.source_type}='{args.source_value}'. Make sure the headset software is running!")
            sys.exit(1)
        
        inlet = StreamInlet(streams[0])
        stream_info = streams[0]
        
        send_message("status", 
                     message="Connected to LSL stream",
                     stream_name=stream_info.name(),
                     stream_type=stream_info.type(),
                     channel_count=stream_info.channel_count(),
                     sample_rate=stream_info.nominal_srate())
        
        send_message("ready", message="Stream ready, starting data flow")
        
        while True:
            sample, timestamp = inlet.pull_sample(timeout=1.0)
            
            if sample:
                eeg_data = sample[:args.channels]
                send_message("data", data=eeg_data, timestamp=timestamp)
            
            time.sleep(0.001)
            
    except KeyboardInterrupt:
        send_message("status", message="Stream stopped by user")
        sys.exit(0)
    except Exception as e:
        send_message("error", message=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
