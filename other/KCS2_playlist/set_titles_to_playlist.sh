#!/usr/bin/env bash
set -e

csv_file="output.csv"
m3u8_file="kcs2_bgm_playlist.m3u"
output_file="new_playlist.m3u8"

# Read the CSV file and process the mapping using awk
bgm_mapping=$(awk -F, '{print $1 "|" $2}' "$csv_file")

# Process the m3u8 file
while IFS= read -r line; do
    if [[ $line == \#EXTINF* ]]; then
        # Extract the key from the line
        key=$(echo "$line" | awk -F, '{print $2}')
        
        # Replace the key with the corresponding value from the mapping
        value=$(echo "$bgm_mapping" | awk -v k="$key" -F'|' '$1 == k {print $2}')
        if [[ -n "$value" ]]; then
            line="#EXTINF:0,$value"
        fi
    fi
    echo "$line"
done < "$m3u8_file" > "$output_file"

rm "$m3u8_file"
mv "$output_file" "$m3u8_file"

echo "New playlist created: $m3u8_file"