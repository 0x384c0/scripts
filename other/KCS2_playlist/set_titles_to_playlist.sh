#!/bin/bash

csv_file="output.csv"
m3u8_file="kcs2_bgm_playlist.m3u"
output_file="new_playlist.m3u8"

declare -A bgm_mapping

# Read the CSV file and populate the mapping
while IFS=, read -r key value; do
    bgm_mapping["$key"]="$value"
done < "$csv_file"

# Process the m3u8 file
while IFS= read -r line; do
    if [[ $line == \#EXTINF* ]]; then
        # Extract the key from the line
        key=$(echo "$line" | awk -F, '{print $2}')
        
        # Replace the key with the corresponding value from the mapping
        if [[ -n "${bgm_mapping[$key]}" ]]; then
            line="#EXTINF:-1,${bgm_mapping[$key]}"
        fi
    fi
    echo "$line"
done < "$m3u8_file" > "$output_file"

echo "New playlist created: $output_file"

rm "$m3u8_file"
mv "$output_file" "$m3u8_file"