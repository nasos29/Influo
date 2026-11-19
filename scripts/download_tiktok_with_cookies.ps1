# Run on the AuditPro Windows PC if server-side TikTok downloads fail.
# 1. Install yt-dlp if needed:  winget install yt-dlp
# 2. Export TikTok cookies from the logged-in browser to Netscape format
#    (e.g. the "Get cookies.txt LOCALLY" extension) as .\tiktok-cookies.txt
#    next to this script. Do not email the cookie file.
# 3. Put one TikTok URL per line in .\tiktok-urls.txt
# 4. Run:  powershell -ExecutionPolicy Bypass -File .\download_tiktok_with_cookies.ps1
# Files land in .\hosted-tiktok-downloads\<video-id>\source.*

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cookies = Join-Path $here "tiktok-cookies.txt"
$urlsFile = Join-Path $here "tiktok-urls.txt"
$outRoot = Join-Path $here "hosted-tiktok-downloads"

if (-not (Test-Path $cookies)) { throw "Missing $cookies (Netscape cookies.txt from a logged-in TikTok session)." }
if (-not (Test-Path $urlsFile)) { throw "Missing $urlsFile (one TikTok URL per line)." }

New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
$yt = Get-Command yt-dlp -ErrorAction SilentlyContinue
if (-not $yt) { throw "yt-dlp is not on PATH. Install it, then re-run." }

Get-Content $urlsFile | ForEach-Object {
  $url = $_.Trim()
  if (-not $url -or $url.StartsWith("#")) { return }
  $id = if ($url -match "/video/(\d+)") { $Matches[1] } else { [guid]::NewGuid().ToString("N") }
  $dest = Join-Path $outRoot $id
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Write-Host "Downloading $url -> $dest"
  & yt-dlp --no-playlist --cookies $cookies -f "bv*+ba/b" --merge-output-format mp4 -o "$dest/source.%(ext)s" $url
  if ($LASTEXITCODE -ne 0) { Write-Host "FAILED $url" -ForegroundColor Red }
}
Write-Host "Done. Keep the cookie file private; share only the downloaded video files if a server upload is needed."
