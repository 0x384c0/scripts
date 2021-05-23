# for i in *.jpg; do echo "Processing $i"; exiftool -all= "$i"; done

find "." -print | grep -e ".*jpg" -e ".*png" -e ".*bmp" | while read filename; do
	date_from_name=$(echo $filename | grep -o "\d\d\d\d-\d\d-\d\d \d\d-\d\d-\d\d" | tr -d " -")
	echo $date_from_name
	date_from_name="$(date -jf "%Y%m%d%H%M%S" $date_from_name +"%Y:%m:%d %H:%M:%S" )" 
	echo $date_from_name
	exiftool -AllDates="$date_from_name" "$filename"
done