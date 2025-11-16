#!/usr/bin/env python3
"""Run all steps to generate the KCS2 playlist, matching the README Usage order.

Steps performed:
 - generate_kcs2_bgm_playlist.py -> output/kcs2_bgm_playlist.m3u
 - fetch_titles.py -> output/output.csv
 - set_titles_to_playlist.py -> apply titles to m3u
 - remove_vocals_from_playlist.py -> create no-vocals variant

This is a convenience runner for automation and CI.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import generate_kcs2_bgm_playlist as generate_mod
import set_titles_to_playlist as set_titles_mod
import remove_vocals_from_playlist as remove_mod


ROOT = Path(__file__).resolve().parent


def _unwrap_system_exit(exc: SystemExit) -> int:
    code = exc.code
    if code is None:
        return 0
    try:
        return int(code)
    except Exception:
        return 1


def run_generate(m3u: Path) -> int:
    try:
        return generate_mod.main([str(m3u)])
    except SystemExit as e:
        return _unwrap_system_exit(e)
    except Exception as e:
        print("generate_kcs2_bgm_playlist failed:", e)
        return 1


def run_fetch(csv: Path) -> int:
    try:
        import fetch_titles as fetch_mod_local
    except ModuleNotFoundError as e:
        print("fetch_titles cannot be imported (missing dependency):", e)
        return 2

    try:
        fetch_mod_local.fetch_titles(csv, headless=True)
        return 0
    except SystemExit as e:
        return _unwrap_system_exit(e)
    except Exception as e:
        print("fetch_titles failed:", e)
        return 2


def run_set_titles(csv: Path, m3u: Path) -> int:
    try:
        return set_titles_mod.main(["--csv", str(csv), "--m3u8", str(m3u)])
    except SystemExit as e:
        return _unwrap_system_exit(e)
    except Exception as e:
        print("set_titles_to_playlist failed:", e)
        return 1


def run_remove_vocals(m3u: Path) -> int:
    out = m3u.with_name(m3u.stem + "_no_vocals" + m3u.suffix)
    vocals = ROOT / "kcs_2_vocals.txt"
    try:
        remove_mod.remove_songs_from_playlist(str(m3u), str(vocals), str(out))
        return 0
    except Exception as e:
        print("remove_vocals_from_playlist failed:", e)
        return 1


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True, help="Output folder path (required)")
    p.add_argument("--m3u", default=None, help="Output playlist path (default: <output>/kcs2_bgm_playlist.m3u)")
    p.add_argument("--csv", default=None, help="Titles CSV path (default: <output>/music_titles.csv)")
    args = p.parse_args(argv)

    # output is required; use provided path
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    m3u = Path(args.m3u) if args.m3u else output_dir / "kcs2_bgm_playlist.m3u"
    csv = Path(args.csv) if args.csv else output_dir / "music_titles.csv"

    print("1) generate playlist")
    rc = run_generate(m3u)
    if rc:
        print("generate_kcs2_bgm_playlist failed", rc)
        return rc

    print("2) fetch titles (uses selenium; requires chromedriver + chrome)")
    rc = run_fetch(csv)
    if rc:
        print("fetch_titles failed", rc)
        return rc

    print("3) set titles")
    rc = run_set_titles(csv, m3u)
    if rc:
        print("set_titles_to_playlist failed", rc)
        return rc

    print("4) remove vocals (existing script)")
    rc = run_remove_vocals(m3u)
    if rc:
        print("remove_vocals_from_playlist failed", rc)
        return rc

    print("All steps completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
