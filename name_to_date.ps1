Get-ChildItem "." | 
Foreach-Object {
    $(Get-Item $_.FullName) -match '\d{8} \d{6}'
    $dateStr = $matches[0]
    $creationDate = [datetime]::ParseExact($dateStr, "yyyyMMdd HHmmss", $null)
    $(Get-Item $_.FullName).creationtime = $creationDate
    $(Get-Item $_.FullName).lastaccesstime = $creationDate
    $(Get-Item $_.FullName).lastwritetime = $creationDate

    Write-Output $_.FullName
    Write-Output $(Get-Item $_.FullName).creationtime.ToString('yyyy-MM-dd HH:mm:ss')
}