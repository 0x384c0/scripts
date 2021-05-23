#!/bin/bash
cd "${0%/*}"
echo "starting session with: sh $PWD/start_radio.sh"
tmux new-session -d -s "radioSession" "sh $PWD/start_radio.sh"