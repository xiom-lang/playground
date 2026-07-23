"""Fix internal lesson IDs to match filenames."""
import json, os, re, sys

lessons_dir = sys.argv[1]

level_map = {
    "L0-first-steps": "L0", "L1-foundations": "L1", "L2-data": "L2",
    "L3-systems": "L3", "L4-safety": "L4", "L5-patterns": "L5",
    "L6-engineering": "L6", "L7-mastery": "L7", "L8-ecosystem": "L8",
}

fixes = 0

for dname, level_prefix in level_map.items():
    dpath = os.path.join(lessons_dir, dname)
    if not os.path.isdir(dpath):
        continue

    for fname in sorted(os.listdir(dpath)):
        if not fname.endswith('.json'):
            continue

        m = re.match(r'^(\d+)-(.+)\.json$', fname)
        if not m:
            continue

        num = int(m.group(1))
        expected_id = f"{level_prefix}-{num:02d}"
        fpath = os.path.join(dpath, fname)

        with open(fpath, 'r', encoding='utf-8') as f:
            raw = f.read()

        data = json.loads(raw)
        modified = False

        # Fix id field
        current_id = data.get("id", "")
        if current_id != expected_id:
            raw = raw.replace(f'"id": "{current_id}"', f'"id": "{expected_id}"')
            print(f"  FIX ID: {dname}/{fname}: {current_id} -> {expected_id}")
            modified = True
            fixes += 1

        # Fix level field (some have integer level, e.g. "level": 6)
        current_level = data.get("level")
        if isinstance(current_level, int):
            raw = raw.replace(f'"level": {current_level}', f'"level": "{level_prefix}"')
            print(f"  FIX LEVEL (int): {dname}/{fname}: {current_level} -> {level_prefix}")
            modified = True
            fixes += 1
        elif current_level != level_prefix:
            raw = raw.replace(f'"level": "{current_level}"', f'"level": "{level_prefix}"')
            print(f"  FIX LEVEL: {dname}/{fname}: {current_level} -> {level_prefix}")
            modified = True
            fixes += 1

        if modified:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(raw)

print(f"\nTotal fixes: {fixes}")
