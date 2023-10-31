#!/bin/bash

# Function to renumber and copy files to a new directory
resequence_frames() {
  local input_pattern="$1"
  local output_directory="$2"
  local output_pattern="$3"
  local frame_number=1
  
  # Create the output directory if it doesn't exist
  mkdir -p "$output_directory"
  
  # Loop through the files matching the input pattern
  for file in $(ls -v1 $input_pattern); do
    local new_filename="$output_directory/$(printf "$output_pattern" "$frame_number")"
    
    # Check if the new filename already exists
    if [ -e "$new_filename" ]; then
      echo "Skipping file: $new_filename (already exists)"
    else
      cp "$file" "$new_filename"
      echo "Renamed $file to $new_filename"
    fi
    
    ((frame_number++))
  done
}

resequence_frames $1 $2 $3

# Usage
# sh resequence_frames.sh  "out*.png" "reseqenced" "ground_truth%d.png"
# For CopyCat use AppendClip