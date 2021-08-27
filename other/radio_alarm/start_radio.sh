#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/1000 
cd "${0%/*}"
sh smooth_volume_increase.sh &
ffplay -hide_banner -nodisp -volume 5 http://anon.fm:8000/radio
# cvlc http://anon.fm:8000/radio