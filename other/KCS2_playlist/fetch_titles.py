#!/usr/bin/env python3
"""Fetch titles from the wiki and write CSV.

Usage:
  fetch_titles.py --output output.csv [--no-headless]

This script uses Selenium to open the wiki Music page and extract the table
data into a CSV file. The output path can be specified.
"""
import argparse
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By


ROOT = Path(__file__).resolve().parent


def fetch_titles(output_csv: Path, headless: bool = True, timeout: int = 30):
    url = "https://en.kancollewiki.net/Music"
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    try:
        driver.get(url)
        # Wait for table to load
        end = time.time() + timeout
        while time.time() < end:
            tables = driver.find_elements(By.TAG_NAME, "table")
            if tables:
                break
            time.sleep(0.5)

        wrapper = r"""
function extractTableData() {
  const tables = document.querySelectorAll('table');
  const result = {};
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    let selectedColumn = undefined;
    rows.forEach(row => {
      const headers = Array.from(row.querySelectorAll('th')).map(e => e.textContent.trim());
      const rowData = Array.from(row.querySelectorAll('td')).map(e => e.textContent.trim());
      const rowIds = Array.from(row.querySelectorAll('td')).map(e => e.id);
      if (headers[0] === "-"){
        const header = headers.concat(rowData);
        selectedColumn = header.indexOf("English");
        if (selectedColumn == -1){
          selectedColumn = header.indexOf("Source");
        }
      } else if (selectedColumn !== undefined && rowIds[0]){
        result[rowIds[0].toLowerCase()] = rowData[selectedColumn];
      }
    });
  });
  return result;
}
return (function(){ var m = extractTableData(); var s = ''; for (var k in m) { s += k + ',' + m[k] + '\n'; } return s; })();
"""

        csv_text = driver.execute_script(wrapper)
        output_csv.write_text(csv_text, encoding="utf-8")
        print(f"Wrote {output_csv}")
    finally:
        driver.quit()


def main():
    p = argparse.ArgumentParser(description='Fetch titles CSV from kancolle wiki')
    p.add_argument('--output', '-o', required=True, help='Output CSV path')
    p.add_argument('--no-headless', dest='headless', action='store_false', help='Run browser visible')
    args = p.parse_args()

    out = Path(args.output)
    try:
        fetch_titles(out, headless=args.headless)
    except Exception as e:
        print('Failed to fetch titles:', e)
        sys.exit(2)


if __name__ == '__main__':
    main()
