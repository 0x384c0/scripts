## Requirements
* [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) or [MinGW](https://www.mingw-w64.org/)
* [curl](https://curl.se/) if not installed
* [Google Chrome](https://www.google.com/chrome/)

## Usage
* run `./generate_kcs2_bgm_battle_playlist.sh`
* in Chrome open [https://en.kancollewiki.net/Music](https://en.kancollewiki.net/Music)
* open Dev console, paste and run code from `extract_title_from_wiki.js`
* save `output.csv` to current directory
* run `./set_titles_to_playlist.sh`
* output will be `kcs2_bgm_playlist.m3u`

## Todo
* rewrite all to Python
* create GitHub Action to automate playlist generation
* use [selenium](https://www.selenium.dev/) to get titles from wiki
* publish generated playlist as release attachment