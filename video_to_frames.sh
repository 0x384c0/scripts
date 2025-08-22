#!/bin/bash
mkdir -p output_frames
ffmpeg -i $1 -vf "fps=24"  -q:v 2 output_frames/frame_%04d.jpg
