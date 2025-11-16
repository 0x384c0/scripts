#!/usr/bin/env python3
"""Replace playlist EXTINF titles using CSV mapping.

CSV format expected: key,title
Playlist entries: #EXTINF:0,<key>

This script replaces those lines with #EXTINF:0,<title> where mapping exists.
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Dict


def load_mapping(csv_path: Path) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    with csv_path.open("r", encoding="utf-8") as fh:
        rdr = csv.reader(fh)
        for row in rdr:
            if not row:
                continue
            key = row[0].strip()
            val = row[1].strip() if len(row) > 1 else ""
            mapping[key.lower()] = val
    return mapping


def process_playlist(m3u8_path: Path, mapping: Dict[str, str]) -> None:
    out_tmp = m3u8_path.with_suffix(m3u8_path.suffix + ".tmp")
    with m3u8_path.open("r", encoding="utf-8") as inf, out_tmp.open("w", encoding="utf-8") as outf:
        for line in inf:
            if line.startswith("#EXTINF"):
                # format: #EXTINF:0,key
                parts = line.rstrip("\n").split(",", 1)
                if len(parts) == 2:
                    key = parts[1].strip()
                    val = mapping.get(key.lower())
                    if val:
                        line = f"#EXTINF:0,{val}\n"
            outf.write(line)
    # Replace original
    m3u8_path.unlink()
    out_tmp.rename(m3u8_path)
    print(f"New playlist created: {m3u8_path}")


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--csv", "-c", required=True, help="Path to CSV file")
    p.add_argument("--m3u8", "-m", required=True, help="Path to playlist file")
    args = p.parse_args(argv)

    csv_path = Path(args.csv)
    m3u8_path = Path(args.m3u8)

    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}")
        return 2
    if not m3u8_path.exists():
        print(f"Playlist file not found: {m3u8_path}")
        return 2

    mapping = load_mapping(csv_path)
    process_playlist(m3u8_path, mapping)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
