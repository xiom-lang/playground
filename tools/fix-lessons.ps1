# fix-lessons.ps1 — Fix lesson duplicates, ID mismatches, and regenerate index.json
# Usage: .\fix-lessons.ps1 [-DryRun]

param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$lessonsDir = Resolve-Path "$PSScriptRoot\..\lessons"

# ─── Step 1: Delete superseded/duplicate files ──────────────────────────
$toDelete = @(
    "L2-data/02-enums.json",
    "L2-data/03-option.json",
    "L2-data/04-vec.json",
    "L4-safety/02-invariants.json",
    "L5-patterns/01-generics-intro.json",
    "L6-engineering/01-module-system.json"
)

Write-Host "=== STEP 1: Deleting superseded/duplicate files ===" -ForegroundColor Cyan
foreach ($f in $toDelete) {
    $path = Join-Path $lessonsDir $f
    if (Test-Path $path) {
        Write-Host "  DELETE: $f" -ForegroundColor Red
        if (-not $DryRun) { Remove-Item $path -Force }
    }
}

# ─── Step 2: Renumber duplicate-prefix files ────────────────────────────
Write-Host ""
Write-Host "=== STEP 2: Renumbering duplicate-prefix files ===" -ForegroundColor Cyan

function Get-SlotMap {
    $map = @{}
    Get-ChildItem -Path $lessonsDir -Directory | ForEach-Object {
        $ln = $_.Name
        $map[$ln] = @{}
        Get-ChildItem -Path $_.FullName -Filter "*.json" | ForEach-Object {
            if ($_.Name -match '^(\d+)-(.+)\.json$') {
                $map[$ln][[int]$Matches[1]] = $_.Name
            }
        }
    }
    return $map
}

function New-Slot {
    param($levelName, $startSlot, $slotMap)
    $s = $startSlot
    while ($slotMap[$levelName].ContainsKey($s)) { $s++ }
    return $s
}

$slotMap = Get-SlotMap
$moveQueue = [System.Collections.ArrayList]::new()

function Queue-Move {
    param($dir, $oldName, $newName, $note)
    $src = Join-Path $lessonsDir "$dir\$oldName"
    $dst = Join-Path $lessonsDir "$dir\$newName"
    if ($note) { Write-Host "  $note" -ForegroundColor Yellow }
    [void]$moveQueue.Add(@{ src=$src; dst=$dst; dir=$dir; old=$oldName; new=$newName })
}

# L2 pairs
Queue-Move "L2-data" "56-format-strings.json" "56-format-strings.json" "KEEP: L2-data/56-format-strings.json"
Queue-Move "L2-data" "56-string-split-join.json" "61-string-split-join.json" "RENAME: L2-data/56-string-split-join.json -> 61-string-split-join.json"
Queue-Move "L2-data" "58-stack.json" "58-stack.json" "KEEP: L2-data/58-stack.json"
Queue-Move "L2-data" "58-string-case.json" "62-string-case.json" "RENAME: L2-data/58-string-case.json -> 62-string-case.json"
Queue-Move "L2-data" "59-queue.json" "59-queue.json" "KEEP: L2-data/59-queue.json"
Queue-Move "L2-data" "59-linked-list.json" "60-linked-list.json" "RENAME: L2-data/59-linked-list.json -> 60-linked-list.json"
# Shift L2/60 to 63 (since linked-list took 60)
if (Test-Path (Join-Path $lessonsDir "L2-data/60-collections-project.json")) {
    Queue-Move "L2-data" "60-collections-project.json" "63-collections-project.json" "SHIFT: L2-data/60-collections-project.json -> 63-collections-project.json"
}

# L4 pairs
Queue-Move "L4-safety" "01-why-contracts.json" "01-why-contracts.json" "KEEP: L4-safety/01-why-contracts.json"
Queue-Move "L4-safety" "01-contracts.json" "08-contracts.json" "RENAME: L4-safety/01-contracts.json -> 08-contracts.json"
# Shift L4/08 if occupied
if ($slotMap["L4-safety"].ContainsKey(8) -and $slotMap["L4-safety"][8] -ne "08-contracts.json") {
    $newSlot = New-Slot "L4-safety" 9 $slotMap
    $oldFile = $slotMap["L4-safety"][8]
    Queue-Move "L4-safety" $oldFile "$($newSlot.ToString('00'))-$($oldFile -replace '^\d+-', '')" "SHIFT: L4-safety/$oldFile -> slot $newSlot"
    $slotMap["L4-safety"].Remove(8)
}
Queue-Move "L4-safety" "03-requires-examples.json" "03-requires-examples.json" "KEEP: L4-safety/03-requires-examples.json"
Queue-Move "L4-safety" "03-result.json" "31-result.json" "RENAME: L4-safety/03-result.json -> 31-result.json"
if ($slotMap["L4-safety"].ContainsKey(31) -and $slotMap["L4-safety"][31] -ne "31-result.json") {
    $newSlot = New-Slot "L4-safety" 32 $slotMap
    $oldFile = $slotMap["L4-safety"][31]
    Queue-Move "L4-safety" $oldFile "$($newSlot.ToString('00'))-$($oldFile -replace '^\d+-', '')" "SHIFT: L4-safety/$oldFile -> slot $newSlot"
}

# L5 pairs
Queue-Move "L5-patterns" "02-generic-functions.json" "02-generic-functions.json" "KEEP: L5-patterns/02-generic-functions.json"
Queue-Move "L5-patterns" "02-interfaces.json" "13-interfaces.json" "RENAME: L5-patterns/02-interfaces.json -> 13-interfaces.json"
if ($slotMap["L5-patterns"].ContainsKey(13) -and $slotMap["L5-patterns"][13] -ne "13-interfaces.json") {
    $newSlot = New-Slot "L5-patterns" 14 $slotMap
    $oldFile = $slotMap["L5-patterns"][13]
    Queue-Move "L5-patterns" $oldFile "$($newSlot.ToString('00'))-$($oldFile -replace '^\d+-', '')" "SHIFT: L5-patterns/$oldFile -> slot $newSlot"
}

# Execute moves
if (-not $DryRun) {
    foreach ($m in $moveQueue) {
        if ($m.old -eq $m.new) { continue }  # skip no-op keeps
        if (Test-Path $m.src) {
            Rename-Item -Path $m.src -NewName $m.new -Force
        }
    }
    $slotMap = Get-SlotMap  # refresh
} else {
    Write-Host "  (DRY RUN: no files changed)"
}

# ─── Step 3: Fix internal IDs ──────────────────────────────────────────
Write-Host ""
Write-Host "=== STEP 3: Fixing internal lesson IDs ===" -ForegroundColor Cyan

$levelIdMap = @{
    "L0-first-steps"   = "L0"
    "L1-foundations"   = "L1"
    "L2-data"          = "L2"
    "L3-systems"       = "L3"
    "L4-safety"        = "L4"
    "L5-patterns"      = "L5"
    "L6-engineering"   = "L6"
    "L7-mastery"       = "L7"
    "L8-ecosystem"     = "L8"
}

$fixCount = 0
foreach ($dn in $levelIdMap.Keys) {
    $lp = $levelIdMap[$dn]
    $dp = Join-Path $lessonsDir $dn
    if (-not (Test-Path $dp)) { continue }

    Get-ChildItem -Path $dp -Filter "*.json" | Sort-Object Name | ForEach-Object {
        $raw = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
        $j = $raw | ConvertFrom-Json

        if ($_.Name -match '^(\d+)-') {
            $num = [int]$Matches[1]
            $expectedId = "$lp-$($num.ToString('00'))"
        } else { return }

        $modified = $false
        $newRaw = $raw

        if ($j.id -ne $expectedId) {
            Write-Host "  FIX ID: $dn/$($_.Name): $($j.id) -> $expectedId" -ForegroundColor Yellow
            $newRaw = $newRaw -replace "`"id`":\s*`"$([regex]::Escape($j.id))`"", "`"id`": `"$expectedId`""
            $modified = $true; $fixCount++
        }

        if ($j.level -is [int] -or "$($j.level)" -ne $lp) {
            Write-Host "  FIX LEVEL: $dn/$($_.Name): $($j.level) -> $lp" -ForegroundColor Yellow
            $newRaw = $newRaw -replace "`"level`":\s*($([regex]::Escape("$($j.level)"))|$($j.level))", "`"level`": `"$lp`""
            $modified = $true; $fixCount++
        }

        if ($modified -and -not $DryRun) {
            [System.IO.File]::WriteAllText($_.FullName, $newRaw, [System.Text.UTF8Encoding]::new($false))
        }
    }
}
Write-Host "  Total fixes: $fixCount" -ForegroundColor Green

# ─── Step 4: Regenerate index.json ──────────────────────────────────────
Write-Host ""
Write-Host "=== STEP 4: Regenerating index.json ===" -ForegroundColor Cyan

# Use Python for JSON generation (avoids all PowerShell quoting issues)
$pyScript = @'
import json, os, sys

lessons_dir = sys.argv[1]
dry_run = sys.argv[2] == "True"

level_meta = {
    "L0": {"name": "First Steps",   "icon": "\U0001F331", "description": "Welcome to programming. No experience needed."},
    "L1": {"name": "Foundations",   "icon": "\U0001F3D7", "description": "Functions, control flow, and program structure."},
    "L2": {"name": "Data",          "icon": "\U0001F4E6", "description": "Structs, enums, collections, and data modeling."},
    "L3": {"name": "Systems",       "icon": "\u2699",     "description": "Memory, ownership, borrowing, and FFI."},
    "L4": {"name": "Safety",        "icon": "\U0001F6E1", "description": "Contracts, verification, and error handling."},
    "L5": {"name": "Patterns",      "icon": "\U0001F9E9", "description": "Generics, interfaces, iterators, and design patterns."},
    "L6": {"name": "Engineering",   "icon": "\U0001F527", "description": "Modules, packages, testing, and deployment."},
    "L7": {"name": "Mastery",       "icon": "\U0001F393", "description": "Compiler internals: lexer, parser, checker, codegen."},
    "L8": {"name": "Ecosystem",     "icon": "\U0001F310", "description": "Real-world: HTTP, JSON, Vulkan, SQLite, WASM."},
}

level_dir_map = {
    "L0": "L0-first-steps", "L1": "L1-foundations", "L2": "L2-data",
    "L3": "L3-systems", "L4": "L4-safety", "L5": "L5-patterns",
    "L6": "L6-engineering", "L7": "L7-mastery", "L8": "L8-ecosystem",
}

levels = []
total = 0

for i in range(9):
    lid = f"L{i}"
    dname = level_dir_map[lid]
    dpath = os.path.join(lessons_dir, dname)
    if not os.path.isdir(dpath):
        continue

    meta = level_meta[lid]
    lessons = []

    for fname in sorted(os.listdir(dpath)):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(dpath, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                lesson = json.load(f)
            lessons.append({
                "id": lesson.get("id", ""),
                "title": lesson.get("title", fname),
                "file": f"{dname}/{fname}",
                "duration": lesson.get("duration", "10 min"),
                "concepts": lesson.get("concepts", []),
            })
        except Exception as e:
            print(f"  WARNING: Failed to parse {fname}: {e}", file=sys.stderr)

    total += len(lessons)
    print(f"  {lid}: {len(lessons)} lessons")

    levels.append({
        "id": lid,
        "name": meta["name"],
        "icon": meta["icon"],
        "description": meta["description"],
        "lessons": lessons,
    })

index = {
    "version": "0.49.9",
    "total_lessons": total,
    "levels": levels,
}

index_path = os.path.join(lessons_dir, "index.json")
if dry_run:
    print(f"\n  DRY RUN: Would write index.json with {total} lessons across {len(levels)} levels")
    text = json.dumps(index, ensure_ascii=False, indent=2)
    print("  Preview (first 500 chars):")
    print(text[:500])
else:
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"\n  Wrote index.json: {total} lessons across {len(levels)} levels")
'@

$pyTemp = Join-Path $env:TEMP "fix_lessons_gen.py"
[System.IO.File]::WriteAllText($pyTemp, $pyScript, [System.Text.UTF8Encoding]::new($false))

$dryRunFlag = if ($DryRun) { "True" } else { "False" }
& python $pyTemp $lessonsDir $dryRunFlag 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Python script failed" -ForegroundColor Red
    exit 1
}

Remove-Item $pyTemp -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
