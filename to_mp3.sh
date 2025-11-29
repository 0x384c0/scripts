shopt -s globstar nullglob
set -e

for file in **/*; do
	[ -f "$file" ] || continue
	case "$file" in
		trash/*) continue ;;
	esac
	base_name=$(basename "$file")
	ext="${base_name##*.}"
	ext_lc="${ext,,}"
	if [[ "$ext_lc" == "mp3" ]]; then
		continue
	fi
	file_name="${base_name%.*}"
	out_dir="$(dirname "$file")"
	out_file="$out_dir/$file_name.mp3"
	printf 'Converting: "%s"\n' "$file"
	ffmpeg -hide_banner -loglevel panic -y -i "$file" -ac 2 -b:a 320k -f mp3 "$out_file" || { echo "ffmpeg failed: $file"; continue; }
	mkdir -p "trash/$(dirname "$file")"
	mv "$file" "trash/$file"
done
