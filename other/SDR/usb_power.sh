#!/bin/bash

HUB="1-1"

if [ "$1" != "0" ] && [ "$1" != "1" ]; then
    echo "Usage: $0 0|1"
    echo "  0 = power OFF"
    echo "  1 = power ON"
    exit 1
fi

echo "Setting USB power to $1 on hub $HUB"
sudo uhubctl -l "$HUB" -a "$1"
