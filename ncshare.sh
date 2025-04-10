#!/bin/bash

# Warning: This script cannot be runned with sh

# Check for input file
if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/file"
  exit 1
fi

FILE="$1"
FILENAME=$(basename "$FILE")
PORT=8080

# Get local IP (assuming en0 for Wi-Fi, fallback to en1)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1)

if [ -z "$IP" ]; then
  echo "Could not determine local IP address"
  exit 1
fi

echo "Serving '$FILENAME' at http://$IP:$PORT/"
echo "Waiting for connection..."

(
  echo -e "HTTP/1.1 200 OK\r"
  echo -e "Content-Type: application/octet-stream\r"
  echo -e "Content-Disposition: attachment; filename=\"$FILENAME\"\r"
  echo -e "\r"
  cat "$FILE"
) | nc -l $PORT && echo "File sent. Server stopped."