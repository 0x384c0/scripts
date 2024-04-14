# Function to get the sound volume percentage
function Get-SoundVolume {
    $output = & svcl /Stdout /GetPercent Speakers
    return [double]::Parse($output)
}

# Function to set the sound volume to a specified percentage
function Set-SoundVolume {
    echo "Set the sound volume to 10%"
    & svcl /SetVolume "Speakers" 20
}

# Function to set the sound volume to a specified percentage
function Set-SoundVolumeIfNeeded {
    # Check if the sound volume is greater than 10%
    $currentVolume = Get-SoundVolume
    echo "v: " $currentVolume
    if ($currentVolume -gt 20) {
        Set-SoundVolume
    }
}

# Check if the current time is between 22:00 and 04:00
$currentHour = (Get-Date).Hour
if ($currentHour -ge 22 -or $currentHour -lt 04) {
    Set-SoundVolumeIfNeeded
}