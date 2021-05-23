#################### logging
function banner {
	echo ""
	echo "$(tput setaf 5; tput bold;)######## $1 #######$(tput sgr0)"
	echo ""
}
function warning {
	echo "$(tput setaf 3; tput bold;)WARNING: $1$(tput sgr0)"
}
function info {
	echo "$(tput setaf 2; tput bold;)INFO: $1$(tput sgr0)"
}
function error {
	echo "$(tput setaf 1; tput bold;)ERROR: $1$(tput sgr0)"
	exit 1
}
#################### utils
function cleanup {
	rm animedl_page.html
	rm animedl_page.html.tmp
	rm tmp_fifo
	rm $BATCH_FILE.tmp
	rm -f sibnet_page.htm.tmp
}
#################### initial
function check_parameters {
	if [ -z $1 ]; then
		echo "Usage: sh $0 http://www.animespirit.ru/anime/path_to_anime.html"
		exit
	fi
}
#################### downloading web page
function download_page {
	SITE_URL=$1
	COOKIES=$2
	curl $SITE_URL -A "Mozilla/5.0" -H $COOKIES > animedl_page.html.tmp
	iconv -c -f cp1251 animedl_page.html.tmp > animedl_page.html 
}
#################### prepeare for downloading files
function create_folder {
	OUT_FOLDER="$(cat animedl_page.html | grep "<title>.*&raquo;"  -o | sed "s/<title>//g" | sed "s/&raquo;//g" | tr "\/ " "___")" # get name for folder
	if ! [[ $OUT_FOLDER = *[!\ ]* ]]; then
	  OUT_FOLDER="$(date +%Y-%m-%d:%H:%M:%S)"
	fi
	OUT_FOLDER="$OUT_FOLDER/"
	BATCH_FILE=$OUT_FOLDER"batch.txt"
	mkdir -p $OUT_FOLDER
	echo $BATCH_FILE
}
#################### converting to format type domain url
function write_to_fifo {
	cat animedl_page.html | 
	grep "onClick=\"upAnime" |
	tr -d "	" |
	awk 'gsub("</p><h","\n</p><h")' | awk 'gsub(">[[:space:]]*http",">\nhttp")' | sed 's/<\/p>.$//' > tmp_fifo
}
function read_from_fifo {
	while read line; do
		if [[ $line == *"http"* ]]; then #string with url
			if [[ $line == *"sibnet"* ]]; then
				DOMAIN="sibnet"
			fi
			if [[ $line == *"myvi"* ]]; then
				DOMAIN="myvi"
			fi
			if [[ $line == *"youtube"* ]]; then
				DOMAIN="youtube"
			fi

			if [ $DOMAIN == "nil" ]; then
				warning "UNCNOWN DOMAIN: $line"
			fi

			echo $TYPE 		>> $BATCH_FILE
			echo $DOMAIN 	>> $BATCH_FILE
			echo $line 		>> $BATCH_FILE
		else #string with series title and type
			if echo $line | grep -iqF -e "озвуч" -e "AniDUB" -e "Anilibria" -e "Shiza" -e "Animedia" -e "AniMaunt" -e "Studio"; then
				TYPE="voice"
			fi
			if echo $line | grep -iqF -e "субтит" -e "сабы"; then
				TYPE="subtitles"
			fi

			if [ $TYPE == "nil" ]; then
				error "UNKNOWN TYPE: $line"
			fi
		fi
	done < tmp_fifo
}
function format_links {
	DOMAIN="null"
	TYPE="null"
	rm -f tmp_fifo 
	mkfifo tmp_fifo
	echo "" > $BATCH_FILE

	write_to_fifo &
	read_from_fifo

}
function filter_links {
	cp $BATCH_FILE $BATCH_FILE.tmp
	cat $BATCH_FILE.tmp | grep $TYPE_FILTER -A2 | grep $DOMAIN_FILTER -A1 | grep http > $BATCH_FILE
}


function pre_donwload_sibnet {
	SIBNET_BATCH_FILE_TMP=$1".tmp"
	mv $1 $SIBNET_BATCH_FILE_TMP
	touch $BATCH_FILE

	while read SIBNET_VIDEO_URL; do
		SIBNET_VIDEO_ID=$(echo $SIBNET_VIDEO_URL | grep -o "/[0-9]*\.flv" | grep -o "[0-9]\+")
		if ! [ -z "$SIBNET_VIDEO_ID" ]; then
			warning "Trying to get file url for: "$SIBNET_VIDEO_URL 
			SIBNET_REDIRECT_URL=$(curl -Ls -o /dev/null -w %{url_effective} http://video.sibnet.ru/video$SIBNET_VIDEO_ID)
			curl -X POST -F 'buffer_method=full' $SIBNET_REDIRECT_URL | iconv -c -f cp1251 > sibnet_page.htm.tmp
			SIBNET_VIDEO_FILE_URL=$(cat sibnet_page.htm.tmp  | grep -o "player.src...src:.\".*\",.type" | grep -o "/v/.*mp4")
			SIBNET_VIDEO_FILE_URL="http://video.sibnet.ru"$SIBNET_VIDEO_FILE_URL
			info "File url: "$SIBNET_VIDEO_FILE_URL
			echo $SIBNET_VIDEO_FILE_URL >> $1
		else
			echo $SIBNET_VIDEO_URL >> $1
		fi
	done < $SIBNET_BATCH_FILE_TMP
}


function get_url_muvi {
	if [[ $1 = *"https://www.myvi.tv/embed/"* ]]; then
		urldecode() { : "${*//+/ }"; echo -e "${_//%/\\x}"; }
		URL_STRING=$( curl $1 | grep "stream" )
		URL_STRING=$( urldecode $URL_STRING | sed "s|.*yer(\"v=||g" | sed "s|\\\\u0026tp=video.*||g")
		echo  $URL_STRING
	else
		echo $1 #extraction is no needed
	fi
}
function pre_download_muvi {
	MUVI_BATCH_FILE_TMP=$1".tmp"
	mv $1 $MUVI_BATCH_FILE_TMP
	touch $BATCH_FILE

	cat $MUVI_BATCH_FILE_TMP | sed "s|myvi.ru|ourvideo.ru|g" | sed "s|http://myvi.tv/player/embed/|https://www.myvi.tv/embed/|g" > $BATCH_FILE
	
	rm $MUVI_BATCH_FILE_TMP
	mv $1 $MUVI_BATCH_FILE_TMP
	touch $BATCH_FILE
	while read MUVI_VIDEO_URL; do
		get_url_muvi $MUVI_VIDEO_URL >> $1
	done < $MUVI_BATCH_FILE_TMP
}

function generate_batch {
	format_links
	filter_links
	pre_donwload_sibnet $BATCH_FILE #todo refactor
	pre_download_muvi $BATCH_FILE
	cat $BATCH_FILE
}
#################### downlaoding
function download {
    DOWNLOAD_SCRIPT="cd \"\$(dirname \"\$0\")\"; FILE_INDEX=1; set -e; while read VIDEO_URL; do youtube-dl -c -o \$FILE_INDEX\" %(title)s.%(ext)s\" \$VIDEO_URL; FILE_INDEX=\$((FILE_INDEX + 1)); test \$? -gt 128 && break; done < batch.txt"
    # read in loop links from batch.txt and send them to youtube-dl
    # break loop if exit code 128 (invalid arguments)
    echo $DOWNLOAD_SCRIPT > "$OUT_FOLDER""continue.sh"
    info "For continue run:   sh \"$OUT_FOLDER""continue.sh\""
    sh "$OUT_FOLDER""continue.sh"
}

####################
# main
####################
SITE_URL=$1
TYPE_FILTER="subtitles"
DOMAIN_FILTER="myvi"
		
check_parameters	$SITE_URL

banner				"DOWNLOADING PAGE"
download_page		$SITE_URL "Cookie:DDOSEXPERT_COM_V6=9fe544535ef70b5575ca1f23ec80aec1"

banner				"CREATING FOLDER"
create_folder

banner				"GENERATING BATCH FILE"
generate_batch

banner				"DOWNLOADING VIDEOS"
cleanup
download

banner				"FINISHED"