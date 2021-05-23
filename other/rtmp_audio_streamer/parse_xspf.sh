urldecode() { : "${*//+/ }"; echo "${_//%/\\x}"; }

cat Untitled.xspf | grep "<location>" | sed "s|<location>file://\(.*\)</location>|\1|g" > files_url_encoded.txt

while read line; do 
    file_path=$(urldecode "$line"); 
    echo $file_path >> files.txt  
done < files_url_encoded.txt

rm -f files_url_encoded.txt