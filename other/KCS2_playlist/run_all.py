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
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def run_command(cmd: list[str]) -> int:
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd)
    return res.returncode


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--m3u", default=str(OUTPUT_DIR / "kcs2_bgm_playlist.m3u"), help="Output playlist path")
    p.add_argument("--csv", default=str(OUTPUT_DIR / "output.csv"), help="Titles CSV path")
    args = p.parse_args(argv)

    m3u = Path(args.m3u)
    csv = Path(args.csv)

    # 1) generate playlist
    rc = run_command([sys.executable, str(ROOT / "generate_kcs2_bgm_playlist.py"), str(m3u)])
    if rc:
        print("generate_kcs2_bgm_playlist failed", rc)
        return rc

    # 2) fetch titles (uses selenium; requires chromedriver + chrome)
    rc = run_command([sys.executable, str(ROOT / "fetch_titles.py"), "--output", str(csv)])
    if rc:
        print("fetch_titles failed", rc)
        return rc

    # 3) set titles
    rc = run_command([sys.executable, str(ROOT / "set_titles_to_playlist.py"), "--csv", str(csv), "--m3u8", str(m3u)])
    if rc:
        print("set_titles_to_playlist failed", rc)
        return rc

    # 4) remove vocals (existing script)
    rc = run_command([sys.executable, str(ROOT / "remove_vocals_from_playlist.py"), "kcs_2_vocals.txt", str(m3u), str(m3u.with_name(m3u.stem + "_no_vocals" + m3u.suffix))])
    if rc:
        print("remove_vocals_from_playlist failed", rc)
        return rc

    print("All steps completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
