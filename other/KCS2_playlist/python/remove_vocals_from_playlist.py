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

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="Remove songs listed in a text file from an m3u playlist.",
        epilog="Example: python remove_vocals_from_playlist.py kcs_2_vocals.txt kcs2_bgm_playlist.m3u kcs2_bgm_playlist_no_vocal.m3u"
    )
    parser.add_argument("vocals_txt", help="Path to vocals TXT file (one entry per line)")
    parser.add_argument("playlist_m3u", help="Path to m3u playlist file to filter")
    parser.add_argument("output_m3u", help="Path for the resulting filtered playlist")
    args = parser.parse_args()

    remove_songs_from_playlist(args.playlist_m3u, args.vocals_txt, args.output_m3u)
    print(f"Filtered playlist written to: {args.output_m3u}")
