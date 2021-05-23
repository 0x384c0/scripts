device=$(amixer | grep -m1 ",0" | sed "s|.*'\(.*\)'.*|\1|g")

amixer -qM sset "$device" 10%-
