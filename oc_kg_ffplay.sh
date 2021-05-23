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
urlencode() {
  local length="${#1}"
  for (( i = 0; i < length; i++ )); do
    local c="${1:i:1}"
    case $c in
      [a-zA-Z0-9.~_-]) printf "$c" ;;
    *) printf "$c" | xxd -p -c1 | while read x;do printf "%%%s" "$x";done
  esac
done
}

#################### initial
function check_parameters {
	if [ -z $1 ]; then
		error "Usage: \nsh $0 https://oc.kg/#/movie/id/<movie id>  \nsh $0 <movie title>"
		exit
	fi
}
#################### title to url, if neede
function get_url {
	if [[ $1 =~ "https://oc.kg/" ]]
	then
		echo $1
	else
		QUERY=$(urlencode $1)
		URL_FOR_QUERY=$(curl "https://oc.kg/suggestion.php?q=$QUERY" | grep -oE "\[{\"movie_id\":\"[0-9]+\"," | grep -oE "[0-9]+")
		URL_FOR_QUERY="https://oc.kg/#/movie/id/"$URL_FOR_QUERY
		echo $URL_FOR_QUERY
	fi
}


#################### downloading web page
function download_page {
	URL="https://oc.kg/pl.php?player=dnld&movieid="$(echo $1 | grep -Eo '[0-9]+$')
    HTML_PAGE=$(curl $URL | iconv -c -f cp1251) #donwload page to var
}

#################### prepeare for downloading files
function generate_file_url {
    FILE_URL=$(echo $HTML_PAGE | tr "<>" "\n\n" | grep -o "a href=\".*oc.kg.*\""  | grep -o "\".*\"" | tr -d "\"")
}

function play {
    info "ffplay -user-agent \"Mozilla/5.0\"  -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 $FILE_URL"
    ffplay -user-agent "Mozilla/5.0"  -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 $FILE_URL
}

####################
# main
####################

QUERY=$1

check_parameters	$QUERY
SITE_URL=$(get_url  $QUERY)	

banner				"DOWNLOADING PAGE"
download_page       $SITE_URL

banner				"GENERATING FILE URL"
generate_file_url

banner              "PLAYING VIDEO"
play