#!/bin/bash
shopt -s nullglob
set -e
mkdir -p trash
for file_name in *.mp4 *.MP4 *.mpg *.MPG *.wmv *.webm *.avi *.mov *.MOV *.MOV *.3gp; do 
	ffmpeg -i "$file_name" -c:v libx265 -crf 26 "$file_name.x265.mp4"; # CPU 
	# ffmpeg -hwaccel cuvid -extra_hw_frames 8 -i "$file_name" -c:v hevc_nvenc -cq 28 -qmin 28 -qmax 30 "$file_name.hevc.mp4";  # GPU
	mv "$file_name" trash
done