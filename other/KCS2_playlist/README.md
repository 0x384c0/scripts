## Requirements
* [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) or [MinGW](https://www.mingw-w64.org/)
* [curl](https://curl.se/) if not installed
* [Google Chrome](https://www.google.com/chrome/)

## Usage
* run `sh generate_kcs2_bgm_battle_playlist.sh`
* in Chrome open [https://en.kancollewiki.net/Music](https://en.kancollewiki.net/Music)
* open Dev console, paste and run code from `extract_title_from_wiki.js`
* save `output.csv` to current directory
* run `sh set_titles_to_playlist.sh`
* output will be `kcs2_bgm_playlist.m3u8`

## Todo
* create GitHub Action to automate these actions
* use [selenium](https://www.selenium.dev/) to get titles from wiki
* publish generated playlist as release attachment