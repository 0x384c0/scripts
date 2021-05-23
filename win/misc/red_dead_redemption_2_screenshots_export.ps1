# powershell -ExecutionPolicy Bypass -File .\red_dead_redemption_2_screenshots_export.ps1

function FixJpeg($file) {
	$bytes  = [System.IO.File]::ReadAllBytes($file)
	$pattern = [byte]0x4A,0x50,0x45,0x47

	$foundIndex = -1

	for ( $index = 0; $index -lt $bytes.count; $index++) {
		$slice = $bytes[$index..($index + $pattern.count - 1)]
		if ("$slice" -eq "$pattern"){
			$foundIndex = $index
			break
		}
	}

	$newBytes = $bytes[$foundIndex..$bytes.count]
	$fileName = Split-Path $file -leaf
	$fileName = "$fileName.jpg"

	[System.IO.File]::WriteAllBytes($fileName, $newBytes)

	(Get-ChildItem $fileName).CreationTime = (Get-ChildItem $file).CreationTime
	(Get-ChildItem $fileName).LastWriteTime = (Get-ChildItem $file).CreationTime
}

$rdrProfiles = "$([Environment]::GetFolderPath("MyDocuments"))\Rockstar Games\Red Dead Redemption 2\Profiles\"
$firstPRofile = (Get-ChildItem $rdrProfiles).FullName
$files = Get-ChildItem -Path $firstPRofile -Recurse -Filter "PRDR*"



foreach ($f in $files){
	FixJpeg($f.FullName)
}
