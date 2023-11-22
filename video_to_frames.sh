#!/bin/bash
mkdir -p output_frames
ffmpeg -i $1 -vf "fps=24" output_frames/frame_%04d.jpg
