## Usage
* export worklogs using Jira Assistant to `0_in_exported_worklogs_from_jira.csv`
* `python3 -m venv venv`
* `source venv/bin/activate`
* `pip install matplotlib`
* `python 1_csv_to_json_summary.py`
* `python 2_analyze_json_summary.py`
* `python 3_collect_roles_tech_stats.py`
