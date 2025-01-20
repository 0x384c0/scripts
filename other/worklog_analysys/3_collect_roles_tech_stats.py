import json
from collections import Counter

# Load the content of the file
with open('out_2_ticket_worklog_common_words.json', 'r') as file:
    data = json.load(file)

# Flatten all ticket comments into a single list of words
words = []
for comments in data.values():
    words.extend(" ".join(comments).split())

# Define a list of roles and technologies to search for
roles = ['ios', 'android', 'mobile', 'backend', 'frontend', 'devops', 'fullstack', 'qa', 'data scientist', 'data engineer']
technologies = ['python', 'java', 'javascript', 'react', 'angular', 'vue', 'nodejs', 'django', 'flask', 'spring', 
                'kubernetes', 'docker', 'aws', 'azure', 'gcp', 'sql', 'nosql', 'mongodb', 'postgresql', 'flutter']

# Count the occurrences of each role and technology
role_counts = Counter(word for word in words if word.lower() in roles)
technology_counts = Counter(word for word in words if word.lower() in technologies)

# Write the results to a file
with open('out_3_summary.txt', 'w') as file:
    file.write("Most popular roles:\n")
    for role, count in role_counts.most_common():
        file.write(f"{role}: {count}\n")
    
    file.write("\nMost popular technologies:\n")
    for tech, count in technology_counts.most_common():
        file.write(f"{tech}: {count}\n")