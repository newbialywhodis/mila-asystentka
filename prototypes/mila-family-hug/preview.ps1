param(
    [ValidateSet('Auto', 'Manual', 'Still')]
    [string]$Mode = 'Auto'
)

$riveCommand = Get-Command rive -ErrorAction SilentlyContinue
$riveExecutable = if ($riveCommand) { $riveCommand.Source } else { Join-Path $env:USERPROFILE '.rive/bin/rive.exe' }
if (-not (Test-Path -LiteralPath $riveExecutable)) {
    throw 'Rive CLI is missing. Install it from https://rive.app/agents.'
}
$previewArguments = @($PSScriptRoot, '--fit=contain')
if ($Mode -eq 'Manual') { $previewArguments += '--data=autoplay=false' }
if ($Mode -eq 'Still') { $previewArguments += '--data=still=true' }
& $riveExecutable @previewArguments
