#!/usr/bin/env bash

# Must be run with bash, not sh
set -e

# Check for input file
if [ -z "$1" ] || [ ! -f "$1" ]; then
  echo "Usage: $0 /path/to/file"
  exit 1
fi

FILE="$1"
FILENAME="$(basename "$FILE")"
PORT=8080

OS="$(uname -s)"

# Get local IP
if [ "$OS" = "Darwin" ]; then
  IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
else
  IP="$(hostname -I | awk '{print $1}')"
fi

if [ -z "$IP" ]; then
  echo "Could not determine local IP address"
  exit 1
fi

echo "Serving '$FILENAME' at http://$IP:$PORT/"
echo "Waiting for connection..."

# Choose correct nc command
if [ "$OS" = "Darwin" ]; then
  NC_CMD=(nc -l "$PORT")
else
  NC_CMD=(nc -l -p "$PORT")
fi

{
  printf "HTTP/1.1 200 OK\r\n"
  printf "Content-Type: application/octet-stream\r\n"
  printf "Content-Disposition: attachment; filename=\"%s\"\r\n" "$FILENAME"
  printf "\r\n"
  cat "$FILE"
} | "${NC_CMD[@]}" && echo "File sent. Server stopped."