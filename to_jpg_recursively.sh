shopt -s nullglob
set -e

for file in *.{png,PNG}; do
	echo $file
	base_name=$(basename "$file")
	file_name="${base_name%.*}"
	new_file=$(dirname "$file")/$file_name".jpg"
	ffmpeg -hide_banner -loglevel panic -i "$file" "$new_file"
	touch -r "$file" "$new_file"
	mkdir -p "trash/$(dirname $file)"
	mv "$file" "trash/$file"
done
