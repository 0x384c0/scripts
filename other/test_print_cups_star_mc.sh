#!/bin/bash

# Image to print
img_path="out.png"

# DEBUG: Create and resize Image
ffmpeg -loglevel error -y -i image_to_print.png -vf "scale=585:-1" $img_path

# Printer name
printer="mC-Print3_1"

# Printer DPI
dpi=203
points_per_inch=72
paper_width=2.83 # paper width - 80mmm, printable area  — 72 mm, printer - mC-Print3_1
# paper_width=1.89  # paper width - 58mmm,  printable area — 48 mm, printer - mPOP_1

# Printer host IP
printer_host="192.168.0.1"

# Get image dimensions using sips (macOS built-in)
wpx=$(sips -g pixelWidth "$img_path" | awk '/pixelWidth/ {print $2}')
hpx=$(sips -g pixelHeight "$img_path" | awk '/pixelHeight/ {print $2}')

# Calculate scale
paper_pixel_width=$(echo "$paper_width * $dpi" | bc -l)
scale=$(echo "$paper_pixel_width / $wpx" | bc -l)

scale=$(echo "$scale * 1.44"  | bc -l) # Magic scale factor for star printers

# Convert pixels to points: (pixels / dpi) * points_per_inch * $scale
wpt=$(echo "scale=0; ($wpx / $dpi) * $points_per_inch * $scale" | bc | awk '{print int($1)}')
hpt=$(echo "scale=0; ($hpx / $dpi) * $points_per_inch * $scale" | bc | awk '{print int($1)}')

# Construct media option
media="Custom.${wpt}x${hpt}"

# Copy image to printer host
scp "$img_path" root@$printer_host:/var/tmp/

# DEBUG: Print image resolution
echo "Image resolution: $wpx x $hpx scale: $scale"

# DEBUG: Print command
echo "lp -o media=$media -o fit-to-page=true -d $printer /var/tmp/out.png"

# DEBUG: list printers
ssh root@$printer_host "lpstat -p"

# Execute print command
ssh root@$printer_host "lp -o media=$media -o fit-to-page=true -d mC-Print3_1 /var/tmp/out.png"
# ssh root@$printer_host "lp -o media=$media -o fit-to-page=true -d mPOP_1 /var/tmp/out.png"