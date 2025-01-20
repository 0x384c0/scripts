import csv, json
from collections import defaultdict

def generate_ticket_comments_map(csv_file_path):
    ticket_comments_map = defaultdict(list)

    with open(csv_file_path, mode='r') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            ticket_no = row['Ticket No']
            comment = row['Comment']
            
            # Remove duplicates by converting the list of comments to a set (if necessary)
            if comment not in ticket_comments_map[ticket_no]:
                ticket_comments_map[ticket_no].append(comment)

    return ticket_comments_map

# Usage
csv_file_path = '0_in_exported_worklogs_from_jira.csv'
ticket_map = generate_ticket_comments_map(csv_file_path)

with open('out_1_worklogs.json', 'w') as json_file:
    json.dump(ticket_map, json_file, indent=4)