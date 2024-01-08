shopt -s nullglob
shopt -s nocaseglob

set -e


for file in *.{png,PNG,bmp,BMP,tif,TIF,tiff,TIFF}; do
    case "$file" in
        *.jpg|*.jpeg)
            continue  # Skip jpg and jpeg files
            ;;
        *)
            # Image processing for other file types
            echo "Processing: $file"
			base_name=$(basename "$file")
			file_name="${base_name%.*}"
			new_file=$(dirname "$file")/$file_name".out.jpg"
			ffmpeg -hide_banner -loglevel panic -i "$file" -q:v 5 "$new_file"
			if command -v powershell &> /dev/null; then # windows workaround
				powershell "(Get-ChildItem \"$new_file\").CreationTime = (Get-ChildItem \"$file\").CreationTime"
			fi
			touch -r "$file" "$new_file"
			mkdir -p "trash/$(dirname "$file")"
			mv "$file" "trash/$file"
            ;;
    esac
done

shopt -u nocaseglob