import requests
import datetime
import sys

# Parse date in format "Jun 24, 2024"
def parse_date(date_str):
    try:
        return datetime.datetime.strptime(date_str, "%b %d, %Y")
    except Exception as e:
        print(f"Invalid date format: {date_str}. Use 'Jun 24, 2024'.")
        sys.exit(1)

# Default target date
if len(sys.argv) > 1:
    TARGET_DATE = parse_date(sys.argv[1])
else:
    sys.exit("Usage: python downgrade.py <date>\nExample: python downgrade.py 'Jun 24, 2024'")

def get_installed_packages():
    import subprocess
    installed = subprocess.check_output(['pip', 'list', '--format=freeze']).decode().splitlines()
    return [line.split('==')[0] for line in installed if '==' in line]

def get_version_before_date(package, cutoff_date):
    url = f"https://pypi.org/pypi/{package}/json"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            print(f"Failed to fetch data for {package}")
            return None
        data = resp.json()
        releases = data.get("releases", {})
        versions_with_dates = []
        for version, files in releases.items():
            if not files:
                continue
            upload_time_str = files[0].get("upload_time_iso_8601")
            if not upload_time_str:
                continue
            upload_time = datetime.datetime.fromisoformat(upload_time_str.rstrip("Z"))
            if upload_time < cutoff_date:
                versions_with_dates.append((version, upload_time))
        if not versions_with_dates:
            return None
        latest_version = sorted(versions_with_dates, key=lambda x: x[1], reverse=True)[0][0]
        return latest_version
    except Exception as e:
        print(f"Error fetching version for {package}: {e}")
        return None

def main():
    packages = get_installed_packages()
    with open("requirements.txt", "w") as f:
        for package in packages:
            print(f"Processing {package}...")
            version = get_version_before_date(package, TARGET_DATE)
            if version:
                line = f"{package}~={version}\n"
            else:
                line = f"{package}\n"  # fallback to no version pinned
            f.write(line)

if __name__ == "__main__":
    main()
    print("pip install --upgrade --force-reinstall -r .\requirements.txt # to apply changes")
