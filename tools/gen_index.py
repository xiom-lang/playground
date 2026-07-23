"""Regenerate lessons/index.json from files on disk."""
import json, os, sys

lessons_dir = sys.argv[1]

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
            print(f"  WARNING: Failed to parse {dname}/{fname}: {e}", file=sys.stderr)

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
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print(f"\nWrote index.json: {total} lessons across {len(levels)} levels")
