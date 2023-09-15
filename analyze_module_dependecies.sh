#!/bin/bash

# Logs
info() {
	echo "$(tput setaf 2; tput bold;)INFO: $1$(tput sgr0)"
}

# Function to create a backup of a file
backup_file() {
  local file="$1"
  local backup_file="$file.bak"
  cp "$file" "$backup_file"
}

# Function to replace "public " with nothing in a file
replace_public() {
  local file="$1"
  local find_str="$2"
  local replacement_str="$3"
  sed -i '' "s/${find_str}/${replacement_str}/g" "$file"
}

# Function to replace "public " with nothing in a file
replace_public_on_line() {
  local file="$1"
  local find_str="$2"
  local replacement_str="$3"
  local line="$4"
  sed -i '' "${line}s/${find_str}/${replacement_str}/g" "$file"
}

# Function to restore a backup file
restore_backup() {
  local file="$1"
  local backup_file="$file.bak"
  if [ -f "$backup_file" ]; then
    mv "$backup_file" "$file"
  fi
}

remember_lines() {
    local file="$1"
    local find_str="$2"
    grep -n "$find_str" "$file" | cut -d : -f 1
}

# Customizable function for testing file changes
test_changes() {
    xcodebuild analyze -quiet > /dev/null 2>&1
}

# Function to process files
process_files() {
  info "Analyzing per file"
  local directory="$MODULE_PATH"
  local find_str="$1"
  local replacement_str="$2"
  
  # Find all files in the directory and its subdirectories
  find "$directory" -type f -name "*$FILE_EXTENSION" | while read -r file; do
    if ! grep -q "$find_str" "$file"; then
        info "Skipping: $file"
        continue
    fi
    info "Analyzing: $file"
    # Create a backup of the original file
    backup_file "$file"
    
    # Replace "public " with nothing
    replace_public "$file" "$find_str" "$replacement_str"
    
    # Run the build command
    test_changes
    
    # Check if the build was successful (you might need to customize this part)
    if [ $? -eq 0 ]; then
      echo "Build successful"
      # Remove the backup file
      rm "$file.bak"
    else
      echo "Build failed, restoring original $FILE_EXTENSION file"
      # Restore the original  file from the backup
      restore_backup "$file"
    fi
  done
}

# Function to process files
process_files_per_line() {
  info "Analyzing per line in file"
  local directory="$MODULE_PATH"
  local find_str="$1"
  local replacement_str="$2"
  
  # Find all files in the directory and its subdirectories
  find "$directory" -type f -name "*$FILE_EXTENSION" | while read -r file; do
    if ! grep -q "$find_str" "$file"; then
        info "Skipping: $file"
        continue
    fi

    # Remember lines with "public " in the file
    lines=$(remember_lines "$file" "$find_str")

    for line in $lines; do
        info "Analyzing: $file:$line"
        # Create a backup of the original file
        backup_file "$file"
        
        # Replace "public " with nothing
        replace_public_on_line "$file" "$find_str" "$replacement_str" $line
        
        # Run the build command
        test_changes
        
        # Check if the build was successful (you might need to customize this part)
        if [ $? -eq 0 ]; then
            echo "Build successful"
            # Remove the backup file
            rm "$file.bak"
        else
            echo "Build failed, restoring original $FILE_EXTENSION file"
            # Restore the original file from the backup
            restore_backup "$file"
        fi
    done
  done
}


FILE_EXTENSION=".swift"
MODULE_PATH="data_module/Sources/data_module"
process_files "public " ""
process_files_per_line "public func" "func"
process_files_per_line "public extension" "extension"