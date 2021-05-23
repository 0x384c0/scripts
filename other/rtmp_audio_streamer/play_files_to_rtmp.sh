function info {
	echo "$(tput setaf 2; tput bold;)$1$(tput sgr0)"
}

PLAYLIST_FILE=$1

# while read file; do #play all files from list
#     ffplay -nodisp -autoexit -- "$file" || break;
# done < files.txt

while true; do #play random file from list indefinitely
    file=$(head -$((${RANDOM} % `wc -l < $PLAYLIST_FILE` + 1)) $PLAYLIST_FILE | tail -1)
    info "PLAYING:   $file"
    ffmpeg -re -i "$file" -vn -c copy -f flv "rtmp://localhost:1935/live" || break;
done

# play stream
# ffplay -nodisp -volume 50 -i rtmp://localhost:1935/live