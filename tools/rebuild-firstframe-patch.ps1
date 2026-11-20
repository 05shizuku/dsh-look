# rebuild-firstframe-patch.ps1 (ASCII-only)
# Re-apply the dsh-look first-frame consent patch after a dsh-orb update.
# The hook checks <dsh-home>/dsh-orb/first-frame-off.json before passive capture.
# Exists = skip passive attach. Missing = passive attach. Lasso flow is unchanged.
# PS 5.1 reads BOM-less UTF-8 as GBK, so keep this script ASCII-only.

param(
    [Parameter(Mandatory = $true)][string]$OrbIndexPath,
    [string]$NodePath = ''
)

$ErrorActionPreference = 'Stop'
$target = (Resolve-Path -LiteralPath $OrbIndexPath).Path
if (-not $NodePath) {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command) { $NodePath = $command.Source }
}

$raw = Get-Content -LiteralPath $target -Raw -Encoding UTF8
if ($raw.Contains('amikarFirstFrameOff')) {
    Write-Output 'patch already present, nothing to do'
    exit 0
}

$anchorImport = 'import { AttachmentId } from "@deepseek-ai/dsh-attachment";'
if (-not $raw.Contains($anchorImport)) {
    throw 'anchor missing: AttachmentId import (upstream structure changed; inspect manually)'
}
$importPatch = "import { AttachmentId } from `"@deepseek-ai/dsh-attachment`";`nimport { dirname } from `"node:path`";`nimport { fileURLToPath } from `"node:url`";`nconst amikarFlagPath = join(dirname(fileURLToPath(import.meta.url)), `"..`", `"..`", `"..`", `"..`", `"..`", `"..`", `"dsh-orb`", `"first-frame-off.json`");"
$raw = $raw.Replace($anchorImport, $importPatch)

$tab = "`t`t"
$observeLine = $tab + 'const observation = await observeDesktop(ctx, backend, signal, { coordinateMode: mode });'
$rememberLine = $tab + 'rememberObservation(agent.session, observation.screens);'
$anchorObserve = [regex]::Escape($observeLine) + '\r?\n' + [regex]::Escape($rememberLine)
if (-not [regex]::IsMatch($raw, $anchorObserve)) {
    throw 'anchor missing: passive observeDesktop call (upstream structure changed; inspect manually)'
}
$observePatch = $tab + 'const amikarFirstFrameOff = await stat(amikarFlagPath).then(() => true, () => false);' + "`n" + $tab + 'if (amikarFirstFrameOff) return decision;' + "`n" + $observeLine + "`n" + $rememberLine
$raw = [regex]::Replace($raw, $anchorObserve, $observePatch)

$backup = $target + '.bak-firstframe-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item -LiteralPath $target -Destination $backup
Set-Content -LiteralPath $target -Value $raw -Encoding UTF8

if ($NodePath) {
    & $NodePath --check $target
    if ($LASTEXITCODE -ne 0) {
        Copy-Item -LiteralPath $backup -Destination $target -Force
        throw "syntax check failed; restored backup: $backup"
    }
    Write-Output 'patch applied, syntax OK'
} else {
    Write-Warning 'node was not found; syntax check skipped'
    Write-Output 'patch applied'
}
Write-Output "backup: $backup"
Write-Output 'restart DSH to load the patch; later flag toggles need no restart'
