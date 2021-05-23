brew install nginx-full --with-rtmp-module


nginx
ffmpeg -re -i /Volumes/“ramdisk”/tmp/IOSExperiments/IOSExperiments/small.mp4  -c copy -f flv rtmp://localhost/live/mystream
nginx -s quit