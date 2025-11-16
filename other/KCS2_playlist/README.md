## Requirements
* [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) or [MinGW](https://www.mingw-w64.org/)
* [curl](https://curl.se/) if not installed
* [Google Chrome](https://www.google.com/chrome/)

## Usage
* `python -m pip install -r requirements.txt`
* `./generate_kcs2_bgm_playlist.sh`
* `python .\fetch_titles.py`
* `./set_titles_to_playlist.sh`
* output will be `kcs2_bgm_playlist.m3u`

## Todo
* rewrite all to Python
* create GitHub Action to automate playlist generation
* use [selenium](https://www.selenium.dev/) to get titles from wiki
* publish generated playlist as release attachment