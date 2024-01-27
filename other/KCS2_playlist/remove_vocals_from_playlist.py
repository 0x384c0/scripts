def remove_songs_from_playlist(playlist_path, vocals_path, output_path):
    # Read the vocals file to get a list of songs to remove
    with open(vocals_path, encoding="utf8", mode='r') as vocals_file:
        vocals = [line.strip() for line in vocals_file.readlines()]

    # Read the original playlist file
    with open(playlist_path, encoding="utf8", mode='r') as playlist_file:
        playlist_lines = playlist_file.readlines()

    # Filter out the lines containing the songs from the vocals file
    updated_playlist_lines = [line for line in playlist_lines if not any(vocal in line for vocal in vocals)]

    # Cleanup
    result = []
    for id, line in enumerate(updated_playlist_lines):
        if id == len(updated_playlist_lines) - 1:
            result.append(line)
        elif not (updated_playlist_lines[id].startswith("#EXTINF") and updated_playlist_lines[id + 1].startswith("#EXTINF")):
            result.append(line)

    # Write the updated playlist to the output file
    with open(output_path, encoding="utf8", mode='w') as output_file:
        output_file.writelines(result)

# Paths to the files
txt_file = "kcs_2_vocals.txt"
m3u8_file = "kcs2_bgm_playlist.m3u"
output_file = "kcs2_bgm_playlist_no_vocal.m3u"

# Remove songs from the playlist and create the updated playlist
remove_songs_from_playlist(m3u8_file, txt_file, output_file)
