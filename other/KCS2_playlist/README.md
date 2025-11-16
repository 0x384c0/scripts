## Requirements
* [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) or [MinGW](https://www.mingw-w64.org/)
* [curl](https://curl.se/) if not installed
* [Google Chrome](https://www.google.com/chrome/)

## Usage
```
python -m pip install -r requirements.txt
# Generate playlist (creates output/kcs2_bgm_playlist.m3u)
python generate_kcs2_bgm_playlist.py output/kcs2_bgm_playlist.m3u
# Fetch titles CSV (requires Chrome + chromedriver)
python fetch_titles.py --output output/output.csv
# Apply titles to playlist
python set_titles_to_playlist.py --csv output/output.csv --m3u8 output/kcs2_bgm_playlist.m3u
# Remove vocals variant
python remove_vocals_from_playlist.py kcs_2_vocals.txt output/kcs2_bgm_playlist.m3u output/kcs2_bgm_playlist_no_vocals.m3u

# Or run everything in sequence with the convenience runner:
python run_all.py
```

## Todo
* rewrite all to Python
* create GitHub Action to automate playlist generation
* publish generated playlist as release attachment