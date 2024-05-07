#!/usr/bin/env bash

# Url example: http://203.104.209.71/kcs2/resources/bgm/battle/119_8110.mp3

# KCS2 resource id to magic code
declare -a resource_magic=(
    6657 5699 3371 8909 7719 6229 5449 8561 2987 5501
    3127 9319 4365 9811 9927 2423 3439 1865 5925 4409
    5509 1517 9695 9255 5325 3691 5519 6949 5607 9539
    4133 7795 5465 2659 6381 6875 4019 9195 5645 2887
    1213 1815 8671 3015 3147 2991 7977 7045 1619 7909
    4451 6573 4545 8251 5983 2849 7249 7449 9477 5963
    2711 9019 7375 2201 5631 4893 7653 3719 8819 5839
    1853 9843 9119 7023 5681 2345 9873 6349 9315 3795
    9737 4633 4173 7549 7171 6147 4723 5039 2723 7815
    6201 5999 5339 4431 2911 4435 3611 4423 9517 3243
)

function magic_code {
    local r="$1"
    local seed="$2"

    local s=0
    local a=1
    local char

    for ((i = 0; i < ${#seed}; i++)); do
        char="${seed:$i:1}"
        s=$((s + $(printf "%d" "'$char")))
    done

    if [ -n "$seed" ]; then
        a=${#seed}
    fi

    echo $(( (17 * (r + 7) * (resource_magic[(s + r * a) % 100])) % 8973 + 1000 ))
}

function get_bgm_battle_url_from_id {
    host="$1"
    type=$2
    resource_id=$3
    resource_code=$(magic_code $resource_id "bgm_$type")
    resource_id=$(printf "%03d" "$resource_id")
    echo "http://$host/kcs2/resources/bgm/$type/$resource_id""_""$resource_code.mp3"
}

# Servers
declare -a kcs2_servers=(
    "203.104.209.71"
    "203.104.209.87"
    "125.6.184.215"
    "203.104.209.183"
    "203.104.209.150"
    "203.104.209.134"
    "203.104.209.167"
    "203.104.209.199"
    "125.6.189.7"
    "125.6.189.39"
    "125.6.189.71"
    "125.6.189.103"
    "125.6.189.135"
    "125.6.189.167"
    "125.6.189.215"
    "125.6.189.247"
    "203.104.209.23"
    "203.104.209.39"
    "203.104.209.55"
    "203.104.209.102"
)

# get_bgm_battle_url_from_id "203.104.209.71" "battle" 1

function check_server {
    local server="$1"
    local url=$(get_bgm_battle_url_from_id "$server" "battle" 1)
    local response_code=$(curl -s -I "$url" | head -n 1 | awk '{print $2}')

    # Check if the response code is in the 2xx range
    if [[ "$response_code" =~ ^[1-3][0-9][0-9]$ ]]; then
        echo "Server $server is working. Code: $response_code"
    else
        echo "Server $server returned an error. Removing from the list.  Code: $response_code"
        # Remove the server from the array
        kcs2_servers=("${kcs2_servers[@]/$server}")
    fi
}

check_servers() {
    for server in "${kcs2_servers[@]}"; do
        check_server "$server"
    done
}


generate_m3u8_playlist_header() {
    local output_file="$1"
    echo "#EXTM3U" > "$output_file"
}

# Function to generate m3u8 playlist
generate_m3u8_playlist() {
    local output_file="$1"
    local type="$2"
    local start_id="$3"
    local server_list=("${@:4}")  # Exclude the first argument which is the output file

    local error_count=0
    for resource_id in $(seq $start_id 999); do
        # Randomly pick a server from the list
        local random_server=${server_list[$((RANDOM % ${#server_list[@]}))]}

        # Get the BGM battle URL using the function
        local bgm_url=$(get_bgm_battle_url_from_id "$random_server" "$type" "$resource_id")

        local response_code=$(curl -s -I "$bgm_url" | head -n 1 | awk '{print $2}')

        if [[ "$response_code" =~ ^[1-3][0-9][0-9]$ ]]; then
            echo "Url $bgm_url is working. Code: $response_code"
            # Append the entry to the m3u8 playlist
            echo "#EXTINF:0,bgm_$type""_""$resource_id" >> "$output_file"
            echo "$bgm_url" >> "$output_file"
            error_count=0
        else
            error_count=$((error_count+1))
            echo "Url $bgm_url returned an error. Erro count: $error_count. Error code: $response_code"
        fi

        # Abort if too many errors in a row
        if [ $error_count  -gt 20 ]; then
            echo "Got $error_count errors. Aborting."
            break
        fi
    done
}

# Get onfor from existing playlist, which allows to continue adding songs instead regenerating playlist from beginning
get_last_id() {
    local output_file="$1"
    local type="$2"
    local default_id="$3"

    # Use grep to find lines containing the specified type and extract the song_id
    local last_id=$(grep -E "/kcs2/resources/bgm/$type/.*\.mp3" "$output_file" | grep -oE "${type}/([0-9]+)_.*\.mp3" | awk -F'/' '{print $2}' | awk -F'_' '{print $1}' | tail -n 1)
    last_id=$((last_id + 1));

    # If no song_id is found, return the default id
    echo "${last_id:-$default_id}"
}

# Main
output_file="kcs2_bgm_playlist.m3u"
default_battle_id=1
default_port_id=85

# Test servers and keep only those, that are working
check_servers

# create playlist if needed
if [ ! -f "$output_file" ]; then
    generate_m3u8_playlist_header "$output_file"
else
    echo >> "$output_file"
fi

# create or continue battle songs
last_battle_id=$(get_last_id "$output_file" "battle" $default_battle_id)
generate_m3u8_playlist "$output_file" "battle" $last_battle_id "${kcs2_servers[@]}"

# create or continue port songs
last_port_id=$(get_last_id "$output_file" "port" $default_port_id)
generate_m3u8_playlist "$output_file" "port" $last_port_id "${kcs2_servers[@]}"