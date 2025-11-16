## Requirements
* [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) or [MinGW](https://www.mingw-w64.org/)
* [curl](https://curl.se/) if not installed
* [Google Chrome](https://www.google.com/chrome/)

## Usage
```
python -m pip install -r requirements.txt
./generate_kcs2_bgm_playlist.sh "output/kcs2_bgm_playlist.m3u"
python .\fetch_titles.py --output output/output.csv
./set_titles_to_playlist.sh --csv output/output.csv --m3u8 output/kcs2_bgm_playlist.m3u
python remove_vocals_from_playlist.py kcs_2_vocals.txt output/kcs2_bgm_playlist.m3u output/kcs2_bgm_playlist_no_vocals.m3u
```

## Todo
* rewrite all to Python
* create GitHub Action to automate playlist generation
* publish generated playlist as release attachment