import re
from collections import defaultdict, Counter
import matplotlib.pyplot as plt
import json

# Function to load file content
def load_file(file_path):
    with open(file_path, 'r') as file:
        return file.readlines()

# Function to combine all strings for each Jira task from a JSON file
def parse_tickets_and_comments(json_data):
    ticket_comments = {}
    
    # Loop through each ticket and combine the list of comments into a single string
    for ticket, comments in json_data.items():
        combined_comments = " ".join(comments)  # Join all comments into a single string
        ticket_comments[ticket] = combined_comments
    
    return ticket_comments

# Function to extract keywords from comments
def extract_keywords(comments, common_words, top_n):
    # Basic keyword extraction: split by non-alphanumeric, remove short/common words
    words = re.findall(r'\b[a-zA-Z]{3,}\b', comments.lower())
    filtered_words = [word for word in words if word not in common_words]
    
    # Count and return the most common words as keywords
    return [word for word, _ in Counter(filtered_words).most_common(top_n)]

# Function to get top words across all tickets for frequency analysis
def get_top_words(ticket_comments_map, common_words, top_n):
    all_comments = " ".join(ticket_comments_map.values())
    all_words = re.findall(r'\b[a-zA-Z]{3,}\b', all_comments.lower())
    filtered_words = [word for word in all_words if word not in common_words]
    
    # Count the occurrences of each word
    word_counts = Counter(filtered_words)
    
    return word_counts.most_common(top_n)

# Function to plot word frequency analysis
def plot_word_frequencies(top_words, top_n):
    words, frequencies = zip(*top_words)
    
    # Adjust the figure size for vertical plot
    plot_width = 10  # Fixed width
    plot_height = top_n * 0.2  # Height now scales with the number of words, no limit
    
    plt.figure(figsize=(plot_width, plot_height))
    plt.barh(words, frequencies)  # Use barh for horizontal bars (to make it vertical)
    plt.ylabel('Words')
    plt.xlabel('Frequency')
    plt.title(f'Top {top_n} Most Common Words Across All Worklogs')
    
    # Adjust the layout
    plt.tight_layout()
    
    plt.savefig('out_2_word_frequency_analysis.png')

# Main function to process the file and plot the results
def main(file_path):
    # Load the JSON data from a file (replace with your actual file path)
    with open(file_path, 'r') as file:
        json_data = json.load(file)
    
    # Combine comments for each ticket
    ticket_comments_map = parse_tickets_and_comments(json_data)

    # Define common words to filter
    common_words = {
        'the', 'and', 'for', 'with', 'from', 'that', 'this', 'was', 
        'are', 'not', 'but', 'can', 'you', 'all', 'have', 'has',

        'work', 'logic', 'app', 'test', 'meeting', 'new', 'add', 'daily', 'https', 'tested', 
        'task', 'update', 'page', 'net', 'atlassian', 'bug', 'browse', 'data', 'test', 'meeting', 
        'fix', 'comments', 'report', 'fixing', 'issue', 'team', 'meetings', 'project', 'api', 'added', 
        'logic', 'create', 'review', 'call', 'fixes', 'tickets', 'tests', 'code', 'fixed', 
         'changes', 'issues', 'user', 'created', 'worked', 'tested', 'standup', 'dev', 
        'check', 'bugs', 'tasks', 'updates', 'list', 'support', 'started', 'maintenance', 'view', 
        'when', 'investigate', 'service', 'design', 'updated', 'order', 'integration', 'eng', 'done', 
        'build', 'after', 'dashboard', 'sync', 'adding', 'error', 'flow', 'setup', 'table', 
        'change', 'development', 'related', 'updating', 'screen', 'some', 'request', 'prod', 
        'details', 'search', 'progress', 'implementation', 'finished', 'version', 'checked', 'status', 
        'feature', 'reports', 'type', 'regression', 'product', 'communication', 'endpoint', 'fields', 
        'deploy', 'admin', 'start', 'calls', 'time', 'chat', 'integrations', 'pages', 
        'automation', 'merge', 'loan', 'functionality', 'section', 'field', 'documentation', 'form', 
        'based', 'date', 'email', 'sdindit', 'filter', 'deployment', 'edit', 'ticket', 
        'checking', 'continue', 'com', 'model', 'events', 'files', 'migration', 'investigating', 
        'production', 'demo', 'questions', 'use', 'reporting', 'get', 'sprint', 'image', 'access', 'working', 'testing'
        }
    
    top_n = 1000

    # Generate summaries for each ticket
    ticket_summaries = {ticket: extract_keywords(comments, common_words, top_n) 
                        for ticket, comments in ticket_comments_map.items()}

    # Output ticket summaries to JSON file
    with open('out_2_ticket_worklog_common_words.json', 'w') as json_file:
        json.dump(ticket_summaries, json_file, indent=4)

    # Get top words across all tickets for frequency analysis
    top_words = get_top_words(ticket_comments_map, common_words, top_n)

    # Plot word frequency analysis
    plot_word_frequencies(top_words, top_n)

    with open('out_2_word_frequency_analysis.json', 'w') as json_file:
        json.dump(top_words, json_file, indent=4)

# Run the main function
if __name__ == "__main__":
    file_path = 'out_1_worklogs.json'  # Define the file path here
    main(file_path)