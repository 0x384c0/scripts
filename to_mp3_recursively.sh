shopt -s nullglob
set -e

for file in *.{aac,wav,opus}; do
	echo $file
	base_name=$(basename "$file")
	file_name="${base_name%.*}"
	ffmpeg -hide_banner -loglevel panic -i "$file" -ac 2 -b:a 320k  -f mp3 "$(dirname "$file")/$file_name.mp3"
	mkdir -p "trash/$(dirname "$file")"
	mv "$file" "trash/$file"
done
