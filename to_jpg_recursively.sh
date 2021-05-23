shopt -s nullglob
set -e

for file in *.{png,PNG}; do
	echo $file
	base_name=$(basename $file)
	file_name="${base_name%.*}"
	ffmpeg -hide_banner -loglevel panic -i "$file" $(dirname $file)/$file_name".jpg"; 
	mkdir -p trash/$(dirname $file)
	mv "$file" trash/$file
done
