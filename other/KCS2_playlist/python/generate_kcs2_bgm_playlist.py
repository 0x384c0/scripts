#!/usr/bin/env python3
"""Generate kcs2 BGM m3u playlist (replacement for generate_kcs2_bgm_playlist.sh).

Usage: python generate_kcs2_bgm_playlist.py output/kcs2_bgm_playlist.m3u
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, List

from kcs2_magic_code import magic_code

USER_AGENT = "Mozilla/5.0"
PROTOCOL = "https://"


KCS2_SERVERS = [
    "w02k.kancolle-server.com",
    "w01y.kancolle-server.com",
    "w02k.kancolle-server.com",
    "w03s.kancolle-server.com",
    "w04m.kancolle-server.com",
    "w05o.kancolle-server.com",
    "w06t.kancolle-server.com",
    "w07l.kancolle-server.com",
    "w08r.kancolle-server.com",
    "w09s.kancolle-server.com",
    "w10b.kancolle-server.com",
    "w11t.kancolle-server.com",
    "w12p.kancolle-server.com",
    "w13b.kancolle-server.com",
    "w14h.kancolle-server.com",
    "w15p.kancolle-server.com",
    "w16s.kancolle-server.com",
    "w17k.kancolle-server.com",
    "w18i.kancolle-server.com",
    "w19s.kancolle-server.com",
    "w20h.kancolle-server.com",
]


def get_bgm_battle_url_from_id(host: str, type_: str, resource_id: int) -> str:
    resource_code = magic_code(resource_id, f"bgm_{type_}")
    resource_id_str = f"{resource_id:03d}"
    return f"{PROTOCOL}{host}/kcs2/resources/bgm/{type_}/{resource_id_str}_{resource_code}.mp3"


def check_server(host: str) -> bool:
    """Check if server responds with HTTP 1xx-3xx for a sample URL (id=1).

    Uses urllib to issue a HEAD request. Returns True if okay.
    """
    import urllib.request

    url = get_bgm_battle_url_from_id(host, "battle", 1)
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            code = resp.getcode()
            return 100 <= code < 400
    except Exception:
        return False


def generate_m3u8_playlist(
    output_file: Path, type_: str, start_id: int, server_list: Iterable[str]
) -> int:
    """Append songs of given type to output_file starting from start_id.

    Returns the last id that was processed + 1 (for resuming semantics).
    """
    server_list = list(server_list)
    error_count = 0
    current_id = start_id
    server_index = 0
    with output_file.open("a", encoding="utf-8") as fh:
        for resource_id in range(start_id, 1000):
            if not server_list:
                break
            host = server_list[server_index % len(server_list)]
            server_index += 1
            url = get_bgm_battle_url_from_id(host, type_, resource_id)
            # perform HEAD request
            import urllib.request

            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    code = resp.getcode()
            except Exception:
                code = 599

            if 100 <= code < 400:
                print(f"Url {url} is working. Code: {code}")
                fh.write(f"#EXTINF:0,bgm_{type_}_{resource_id}\n")
                fh.write(url + "\n")
                error_count = 0
            else:
                error_count += 1
                print(f"Url {url} returned an error. Error count: {error_count}. Error code: {code}")

            if error_count > 20:
                print(f"Got {error_count} errors. Aborting {type_} generation.")
                break

            current_id = resource_id + 1

    return current_id


def get_last_id(output_file: Path, type_: str, default_id: int) -> int:
    if not output_file.exists():
        return default_id
    text = output_file.read_text(encoding="utf-8")
    # Find lines with /kcs2/resources/bgm/{type}/NNN_code.mp3
    import re

    matches = re.findall(rf"/kcs2/resources/bgm/{type_}/(\d+)_", text)
    if not matches:
        return default_id
    last = int(matches[-1]) + 1
    if last <= 1:
        return default_id
    return last


def main(argv: List[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("output", help="Output m3u playlist path")
    args = p.parse_args(argv)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    # Check servers one by one and print progress: how many working out of total
    total = len(KCS2_SERVERS)
    servers: List[str] = []
    for idx, s in enumerate(KCS2_SERVERS, start=1):
        ok = check_server(s)
        if ok:
            servers.append(s)
        # Print running progress after each check
        print(f"Checking servers: {len(servers)}/{total} working")

    # Summary
    if servers:
        print(f"Found {len(servers)} working servers out of {total}.")
    else:
        print("No working servers detected; using default list (may fail).")
        servers = KCS2_SERVERS

    if not out.exists():
        out.write_text("#EXTM3U\n", encoding="utf-8")
    else:
        # append newline to separate
        with out.open("a", encoding="utf-8") as fh:
            fh.write("\n")

    default_battle_id = 1
    default_port_id = 85

    last_battle_id = get_last_id(out, "battle", default_battle_id)
    generate_m3u8_playlist(out, "battle", last_battle_id, servers)

    last_port_id = get_last_id(out, "port", default_port_id)
    generate_m3u8_playlist(out, "port", last_port_id, servers)

    print(f"Playlist generation finished: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
