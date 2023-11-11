#!/bin/bash

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
    resource_id=$2
    resource_code=$(magic_code $resource_id "bgm_battle")
    resource_id=$(printf "%03d" "$resource_id")
    echo "http://$host/kcs2/resources/bgm/battle/$resource_id""_""$resource_code.mp3"
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

# get_bgm_battle_url_from_id "203.104.209.71" 1

function check_server {
    local server="$1"
    local url=$(get_bgm_battle_url_from_id "$server" 1)
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

# Loop through the servers
for server in "${kcs2_servers[@]}"; do
    check_server "$server"
done

# Function to generate m3u8 playlist
generate_m3u8_playlist() {
    local output_file="$1"
    local server_list=("${@:2}")  # Exclude the first argument which is the output file

    echo "#EXTM3U" > "$output_file"


    for resource_id in {1..999}; do
        # Randomly pick a server from the list
        local random_server=${server_list[$((RANDOM % ${#server_list[@]}))]}

        # Get the BGM battle URL using the function
        local bgm_url=$(get_bgm_battle_url_from_id "$random_server" "$resource_id")

        local response_code=$(curl -s -I "$bgm_url" | head -n 1 | awk '{print $2}')

        if [[ "$response_code" =~ ^[1-3][0-9][0-9]$ ]]; then
            echo "Url $bgm_url is working. Code: $response_code"
            # Append the entry to the m3u8 playlist
            echo "#EXTINF:-1,BGM $resource_id" >> "$output_file"
            echo "$bgm_url" >> "$output_file"
        else
            echo "Url $bgm_url returned an error. Code: $response_code"
        fi
    done
}

# Example usage
output_file="kcs2_bgm_battle_playlist.m3u8"
generate_m3u8_playlist "$output_file" "${kcs2_servers[@]}"