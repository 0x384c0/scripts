shopt -s nullglob
set -e

for file in *.{png,PNG}; do
	echo $file
	base_name=$(basename "$file")
	file_name="${base_name%.*}"
	new_file=$(dirname "$file")/$file_name".out.jpg"
	ffmpeg -hide_banner -loglevel panic -i "$file" -q:v 7 "$new_file"
	if command -v powershell &> /dev/null; then # windows workaround
		powershell "(Get-ChildItem \"$new_file\").CreationTime = (Get-ChildItem \"$file\").CreationTime"
	fi
	touch -r "$file" "$new_file"
	mkdir -p "trash/$(dirname "$file")"
	mv "$file" "trash/$file"
done
