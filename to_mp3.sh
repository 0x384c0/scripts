#!/bin/bash
shopt -s nullglob

convert_file() {
    local file="$1"
    
    # skip the script itself
    [[ "$file" == "./to_mp3.sh" ]] && return
    
    # compute relative path without leading ./
    local file_rel="${file#./}"
    local ext="${file_rel##*.}"
    
    # skip already-mp3 files
    if [[ "${ext,,}" == "mp3" ]]; then
        echo "Skipping existing mp3: $file_rel"
        return
    fi
    
    echo "Processing: $file_rel"
    local base_name=$(basename "$file_rel")
    local file_name="${base_name%.*}"
    local dir_rel=$(dirname "$file_rel")
    local out_mp3="$dir_rel/$file_name.mp3"
    
    # ensure target directory exists
    mkdir -p "$dir_rel"
    
    # run ffmpeg with extra quoting
    if ffmpeg -hide_banner -loglevel error -i "$file" -ac 2 -b:a 320k -f mp3 "$out_mp3"; then
        echo "Converted: $out_mp3"
        mkdir -p "trash/$dir_rel"
        mv "$file" "trash/$file_rel"
    else
        echo "Failed to convert: $file_rel" >&2
        [ -f "$out_mp3" ] && rm -f "$out_mp3"
    fi
}

export -f convert_file

# Use find -exec to avoid pipe/read issues with special characters
find . -type f ! -path './trash/*' -exec bash -c 'convert_file "$0"' {} \;