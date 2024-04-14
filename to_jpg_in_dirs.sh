#!/bin/bash
for dir in */; do
    # Make sure it's a directory
    if [ -d "$dir" ]; then
        # Run your script in the directory
        (cd "$dir" && /e/Files/scripts/to_jpg.sh)
    fi
done