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
        echo "Usage: sh $0 \"<site_url>\""
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
        echo $HTML_PAGE | 
        grep -o "<title>.*</title>" | #find title
        sed "s|<title>\(.*\)</title>|\1|g"  #clear title
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
   
    echo $HTML_PAGE | tr "<>" "\n\n" | 
    grep -oE "src.*(\.jpg|\.jpeg|\.png|\.gif|\.webm)\"" | # find umage url
    sed "s|src=\"\(.*\)\"|\1|g" > $BATCH_FILE #clear url and save
}

#################### downlaoding
function download {
    DOWNLOAD_SCRIPT="cd \"\$(dirname \"\$0\")\"; wget  --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -t 0 -c -i batch.txt"
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

check_parameters    $SITE_URL

banner              "DOWNLOADING PAGE"
download_page       $SITE_URL

banner              "CREATING FOLDER"
create_folder

banner              "GENERATING BATCH FILE"
generate_batch

banner              "DOWNLOADING VIDEOS"
download

banner              "FINISHED"