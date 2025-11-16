#!/usr/bin/env bash
set -e

# Require caller to provide both files via CLI (no defaults)
csv_file=""
m3u8_file=""

print_usage() {
    cat <<EOF
Usage: $0 --csv <csv_file> --m3u8 <playlist_file>
Both --csv and --m3u8 are required.
Options:
  --csv,  -c   Path to CSV file (required)
  --m3u8, -m   Path to m3u8 playlist file (required)
  --help, -h   Show this help
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --csv|-c)
                if [[ -n "$2" && "${2:0:1}" != "-" ]]; then
                    csv_file="$2"
                    shift 2
                else
                    echo "Error: --csv requires a value."
                    print_usage
                    exit 1
                fi
                ;;
            --m3u8|-m)
                if [[ -n "$2" && "${2:0:1}" != "-" ]]; then
                    m3u8_file="$2"
                    shift 2
                else
                    echo "Error: --m3u8 requires a value."
                    print_usage
                    exit 1
                fi
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            *)
                echo "Unknown argument: $1"
                print_usage
                exit 1
                ;;
        esac
    done
}

# Parse CLI args
parse_args "$@"

# Enforce that both paths are provided
if [[ -z "$csv_file" || -z "$m3u8_file" ]]; then
    echo "Error: both --csv and --m3u8 must be provided."
    print_usage
    exit 1
fi

# Compute tmp output path based on chosen m3u8 file
tmp_output_file="${m3u8_file}.tmp"

# Validate files
if [[ ! -f "$csv_file" ]]; then
    echo "CSV file not found: $csv_file"
    exit 1
fi
if [[ ! -f "$m3u8_file" ]]; then
    echo "Playlist file not found: $m3u8_file"
    exit 1
fi

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
done < "$m3u8_file" > "$tmp_output_file"

rm "$m3u8_file"
mv "$tmp_output_file" "$m3u8_file"

echo "New playlist created: $m3u8_file"