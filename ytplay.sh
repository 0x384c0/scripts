#################### logging
function info {
	echo "$(tput setaf 2; tput bold;)INFO: $1$(tput sgr0)"
}
function error {
	echo "$(tput setaf 1; tput bold;)ERROR: $1$(tput sgr0)"
	exit 1
}

#################### func
function check_parameters {
	if [ -z $1 ]; then
		info "Usage: sh $0 <youtube link>"
		exit
	fi
}

function check_dependencies {
	if ! [ -x "$(command -v youtube-dl)" ]; then
		error 'Error: youtube-dl is not installed.'
		exit 1
	fi
	if ! [ -x "$(command -v ffmpeg)" ]; then
		error 'Error: ffmpeg is not installed.'
		exit 1
	fi
	if ! [ -x "$(command -v ffplay)" ]; then
		error 'Error: ffplay is not installed.'
		exit 1
	fi
}

function play {
	youtube-dl $1 -o - | ffplay -
}

####################
# main
####################

SITE_URL=$1

check_parameters	$SITE_URL
check_dependencies

info				"Playing with SITE_URL: $SITE_URL"
play $SITE_URL
