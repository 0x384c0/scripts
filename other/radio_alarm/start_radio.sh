#!/bin/bash
cd "${0%/*}"
sh smooth_volume_increase.sh &
ffplay -nodisp -volume 5 http://anon.fm:8000/radio
