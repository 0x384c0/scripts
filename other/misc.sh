# get tcp listeners
netstat -an | grep LISTEN

# скачать html | разделить теги на строчки | получить все src (картинки)
cat index.html | tr "<>" "\n\n" | grep /src/

# скачать html | найти  src (картинки) | найти картинки из gd | дополнить url				 | скачать 
cat index.html | grep /src/ | grep -Eo /gd/src/[0-9]+[^\"]+ | sed "s,^,https://2ch.hk,g" | wget -i -

# скачивание картинок 									найти их в json										в 5 потоков
wget -qO - https://2ch.hk/${BOARD}/res/${THREAD}.json | jq .threads[].posts[].files[].path | xargs -n1 -I{} -P5 wget https://2ch.hk/{}

# play hls from twitch
#get hls, save plist ,grep , download missing file from twitch, save m3p8 in to local sever , then play it from server
while true; do curl "ТУТ_ССЫЛКА_ОТ_YOUTUBE-DL" -o play.m3u8.tmp; cat play.m3u8.tmp| grep ^index| while read aa; do echo NEED $aa; [ ! -e $aa ] && echo LOAD $aa && curl -O "ТУТ_КУСОК_ССЫЛКИ_ДО_ПОСЛЕДНЕГО_СЛЕША/$aa";done;mv play.m3u8.tmp play.m3u8;sleep 1;echo DONE;done
