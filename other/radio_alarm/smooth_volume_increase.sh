device=$(amixer | grep -m1 ",0" | sed "s|.*'\(.*\)'.*|\1|g")

for i in $(seq 0 10)
do
 volume=$(($i * 10))
 echo "Volume: "$volume
 amixer -qM sset $device $volume%
 sleep 1
done
