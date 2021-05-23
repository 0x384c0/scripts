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

#################### initial
function check_parameters {
	if [ -z $1 ]; then
		echo "Usage: sh $0 http://ts.kg/show/<show name>/"
		exit
	fi
}
#################### downloading web page
function download_page {
    HTML_PAGE=$(curl $1) #donwload page to var
}

#################### prepeare for downloading files
function create_folder {
    TITLE=$( 
        echo $HTML_PAGE | tr "<>" "\n\n" | #send page to pipe
        grep -o "meta property=\"og:title\" content=\".*/" | #find title
        sed "s/meta.*content=\"//g" | sed "s/\"\///g" #clear title
        )
    OUT_FOLDER="$TITLE/"
    BATCH_FILE=$OUT_FOLDER"batch.txt"
    mkdir -p "$OUT_FOLDER"
    info "Will save to folder \"$OUT_FOLDER\""
}


function generate_batch {
    if [ -e "$BATCH_FILE" ]; then
        info "Found existing file \"$BATCH_FILE\""
        return
    fi
    # get datail urls
    DETAIL_URLS=($(
        echo $HTML_PAGE | tr "<>" "\n\n" | #send page to pipe
        grep -o "href=\"/show/.*data-toggle=\"tooltip\".*data-id" | #find tags with url
        sed "s/^.*href=\"//g" | sed "s/\" data-.*$//g" | #clear urls
        sed "s/^/http:\/\/www.ts.kg/" #add site
       ))
    info ${#DETAIL_URLS[*]}" links found"

    info "fetching detail pages"
    DOWNLOAD_PAGE_URLS=()
    for detail_link in ${DETAIL_URLS[*]}
    do
        echo $detail_link
        DOWNLOAD_PAGE_URLS+=($(
            curl -s $detail_link | tr "<>" "\n\n" | #send page to pipe
            grep "id=\"download-button"| #find tags with url
            sed "s/^.*href=\"//g" | sed "s/\" class=\"btn.*$//g" | #clear urls
            sed "s/^/http:\/\/www.ts.kg/" #add site
            ))
    done

    info "fetching download pages"
    FILE_URLS=()
    for download_page_url in ${DOWNLOAD_PAGE_URLS[*]}
    do
        echo $download_page_url
        FILE_URLS+=($(
            curl -s $download_page_url | tr "<>" "\n\n" | #send page to pipe
            grep "class=\"btn btn-success"| #find tags with url
            sed "s/^.*href=\"//g" | sed "s/\" class=\"btn.*$//g" | #clear urls
            sed "s/^/http:\/\/www.ts.kg/" #add site
            ))
    done

    info "generating batch file to "$BATCH_FILE
    for file_url in ${FILE_URLS[*]}
    do
        echo $file_url
        echo $file_url >> $BATCH_FILE
    done
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

check_parameters	$SITE_URL

banner				"DOWNLOADING PAGE"
download_page       $SITE_URL

banner				"CREATING FOLDER"
create_folder

banner				"GENERATING BATCH FILE"
generate_batch

banner              "DOWNLOADING VIDEOS"
download

banner              "FINISHED"