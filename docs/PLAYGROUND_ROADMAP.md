# XIOM Playground — Honest Audit & Roadmap to 10/10

**Date:** 2026-07-23  
**Current Rating:** **1.5/10** (unusable for learning)  
**Target:** 10/10 (production-grade learning environment)

---

## 1. HONEST AUDIT — What's Wrong

### A. Lessons (1/10) — THE BIGGEST PROBLEM

| Issue | Detail |
|-------|--------|
| **Only 20 lessons** | Spec says 400+. 20 done = 5% complete. |
| **No progressive difficulty** | Lessons jump from "Hello World" to "Memory Model" with no bridge |
| **"Hello World" doesn't print** | `return 42;` is NOT Hello World. Beginners expect to SEE output. |
| **"Variables" doesn't teach** | Shows code but no explanation of WHY `let` vs `var`, no interactive exercise |
| **No theory sections** | Every lesson needs: Concept → Why → Show → Do → Test |
| **No syntax reference** | Zero documentation of keywords, operators, types anywhere in the UI |
| **No completion flow** | User finishes a lesson → nothing happens. No next lesson prompt, no achievement. |

### B. Output Tabs (2/10) — DISPLAYING NOTHING

| Tab | What it shows | What it SHOULD show |
|-----|--------------|---------------------|
| **Output** | "Compilation successful!" or "Compilation failed." | Actually nothing useful — just a status message |
| **LLVM IR** | Raw IR dump (sometimes) | Syntax-highlighted IR with comments explaining what each section does |
| **Diagnostics** | Raw error list | Annotated errors with fix suggestions, links to relevant lessons |
| **Tokens** | EMPTY — never populated | Full token stream with span info, color-coded by token type |
| **Contracts** | EMPTY — never populated | Z3 verification results, counterexamples, contract status |

**Root cause:** The server.py/server.js only runs `xiom --emit-ir` which returns IR + stderr. The tokens, AST, contracts stages are never populated because they require running the compiler in stages (lex-only, parse-only, verify).

### C. UI/UX (3/10) — LOOKS LIKE A TOOL, NOT A LEARNING ENVIRONMENT

| Issue | Detail |
|-------|--------|
| **No landing page** | User lands directly in editor with no context |
| **No "What is XIOM"** | Zero explanation of what makes XIOM special |
| **No syntax guide** | No cheatsheet, no reference panel |
| **Lessons hidden** | Sidebar hidden by default, user has to click "Lessons" to discover them |
| **No mobile** | Completely broken on phones/tablets |
| **No dark/light toggle** | Theme is hardcoded |
| **No keyboard shortcuts help** | Ctrl+Enter works but user isn't told |

### D. Editor (4/10) — MONACO IS GOOD, INTEGRATION IS WEAK

| Issue | Detail |
|-------|--------|
| **Monaco CDN** | Loads from jsdelivr — fails offline |
| **No autocomplete** | No stdlib function suggestions, no type completions |
| **No hover info** | No type-on-hover, no documentation popups |
| **No formatting** | No "Format Code" button (xiom-fmt exists in WASM) |
| **Error underlines** | Works but doesn't link to lessons/docs |

---

## 2. WHAT A 10/10 LOOKS LIKE

### The User Journey

```
Landing Page
  → "What is XIOM?" (60-sec feature tour)
  → "Start Learning" button
  → Lesson Browser (categorized, searchable)
  → Select lesson → Read theory → See example → Edit code → Compile → See output → Mark complete → Next lesson
  → OR: "Skip to Playground" (free experimentation)
```

### Required Panels/Tabs

| Panel | Content |
|-------|---------|
| **Lessons Browser** | Categorized, searchable, progress-tracked (370+ lessons) |
| **Syntax Reference** | Every keyword, operator, type documented with examples |
| **Concepts Guide** | "What makes XIOM special" — SAFE, VERIFIED, PRECISE |
| **Editor** | Monaco with full XIOM support |
| **Output** | Human-readable: "Your program returned 42" |
| **LLVM IR** | Syntax-highlighted, annotated for learning |
| **Diagnostics** | Error → Explanation → Fix suggestion → Link to lesson |
| **Tokens** | Lexer output visualization (color-coded by token type) |
| **Contracts** | Z3 verification results displayed clearly |

### Lesson Structure (EVERY lesson)

```json
{
  "id": "L1-03",
  "title": "Functions",
  "concept": "Functions package code into reusable blocks",
  "why": "Without functions, you'd rewrite the same code over and over. Functions let you name a block of code and call it whenever you need it.",
  "theory": "## Functions in XIOM\n\nA function is declared with `fn`, has parameters in `()`, and returns a value after `->`...",
  "syntax_ref": "fn name(param: Type) -> ReturnType { body }",
  "example": "fn add(a: Int, b: Int) -> Int { return a + b; }",
  "code_template": "fn multiply(a: Int, b: Int) -> Int {\n  // TODO: return a * b\n}",
  "solution": "fn multiply(a: Int, b: Int) -> Int {\n  return a * b;\n}",
  "test_input": "",
  "test_expected": "",
  "tips": ["Use `return` to send a value back", "Every parameter needs a type annotation"],
  "common_mistakes": ["Forgetting `return`", "Forgetting the return type annotation"],
  "related": ["L1-02", "L1-04"],
  "next_lesson": "L1-04"
}
```

---

## 3. ROADMAP TO 10/10

### Phase A — Fix Critical Issues (2 days)

| # | Task | Effort |
|---|------|--------|
| A1 | **Fix output tabs**: Make Tokens, IR, Diagnostics, Contracts show real data | 1d |
| A2 | **Fix compiler server**: Run compiler in stages (lex-only, parse-only, codegen, verify) | 0.5d |
| A3 | **Add syntax reference panel**: Keyboard-accessible cheatsheet of all keywords, operators, types | 0.5d |

### Phase B — Lesson Content (5-7 days — 8 agents in parallel)

| # | Level | Lessons | Agent |
|---|-------|---------|-------|
| B0 | **L0: First Steps** | 30 lessons (Hello World through basic functions) | Agent 1 |
| B1 | **L1: Foundations** | 50 lessons (Types, operators, control flow, functions deep) | Agent 2 |
| B2 | **L2: Data Structures** | 60 lessons (Structs, enums, Option, Result, Vec, Map, Set) | Agent 3 |
| B3 | **L3: Systems** | 50 lessons (Memory, ownership, borrowing, lifetimes) | Agent 4 |
| B4 | **L4: Safety** | 50 lessons (Contracts, invariants, error handling, unsafe) | Agent 5 |
| B5 | **L5: Patterns** | 50 lessons (Generics, interfaces, traits, derive, iterators) | Agent 6 |
| B6 | **L6: Engineering** | 40 lessons (Modules, packages, testing, FFI, build system) | Agent 7 |
| B7 | **L7+L8: Mastery + Ecosystem** | 40 lessons (Compiler internals, Z3, Vulkan, Redis, etc.) | Agent 8 |
| | **TOTAL** | **370 lessons** | |

### Phase C — UI/UX Polish (2 days)

| # | Task | Effort |
|---|------|--------|
| C1 | Landing page with feature tour animation | 0.5d |
| C2 | "What is XIOM" concept panel | 0.5d |
| C3 | Lesson completion flow (next lesson prompt, achievement) | 0.5d |
| C4 | Mobile responsive layout | 0.5d |

### Phase D — Editor Enhancements (1 day)

| # | Task | Effort |
|---|------|--------|
| D1 | Autocomplete (stdlib functions, types, keywords) | 0.5d |
| D2 | Format button (xiom-fmt via WASM) | 0.3d |
| D3 | Help panel (Ctrl+Shift+H for keyboard shortcuts) | 0.2d |

---

## 4. TARGET STATE: 10/10

| Category | Current | Target |
|----------|---------|--------|
| **Lessons** | 20 (5%, random quality) | 370+ (100%, every concept covered) |
| **Output Tabs** | 2/5 work (broken) | 5/5 work (real data) |
| **UI/UX** | Looks like a dev tool | Looks like Duolingo for systems programming |
| **Editor** | Basic Monaco | Smart editor with autocomplete + formatting |
| **Learning Flow** | No guidance | Progressive: Theory → Example → Practice → Test |
| **Beginner Experience** | Impossible to use | "I've never coded before" → "I can write XIOM" |

---

## 5. IMMEDIATE NEXT STEPS

**Start Phase A now** — fix the compiler server to emit tokens, IR, diagnostics, and contracts as real data. This makes the playground functional immediately while lessons are being written in parallel.
