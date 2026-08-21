# XIOM Playground v2.0 -- Product Specification

**Version:** v0.49.9 -> v2.0  
**Status:** Spec Phase  
**Repo:** `github.com/XIOM-lang/xiom-playground`  
**Domain:** `playground.xiom-lang.org`

---

## 1. VISION

The XIOM Playground is the primary learning and exploration surface for the XIOM language. It serves three audiences:

| Audience | Need |
|----------|------|
| **Complete beginners** | Learn XIOM from zero, interactive lessons, no prior coding experience |
| **Experienced developers** | Explore language features, test snippets, see compiler internals |
| **Compiler contributors** | Debug pipeline stages (tokens -> AST -> checked -> IR), verify contracts |

The playground is NOT a toy -- it's a production-grade learning environment that showcases the language AND the compiler's industrial capabilities.

---

## 2. DESIGN PHILOSOPHY

### 2.1 Visual Identity

**"Apple meets Tesla"** -- premium, minimalist, dark-first, with purposeful motion.

| Element | Direction |
|---------|-----------|
| **Background** | Deep space black (#0a0a0f) with subtle gradient |
| **Accent** | XIOM crimson (#e94560) for primary actions |
| **Cards** | Frosted glass (#12121a with backdrop-blur) |
| **Text** | Cool white (#e8e8f0), secondary (#8888a0) |
| **Motion** | 200ms ease-out transitions, subtle hover lifts |
| **Typography** | JetBrains Mono for code, Inter for UI |

### 2.2 Layout

```
+--------------------------------------------------------------+
|  HEADER BAR (fixed)                                          |
|  [XIOM Playground] [Lessons v] [Examples v]    [Run >] [[SETTINGS]] |
|--------------------------------------------------------------|
|                                                              |
|  +- SIDEBAR (lessons/explorer) -+ +- MAIN CONTENT --------+ |
|  |                              | |                        | |
|  |  Lessons                     | |  +- EDITOR ----------+ | |
|  |  |- Beginner                 | |  | fn main() -> Int { | | |
|  |  |  |- 01 Hello World        | |  |   return 42;       | | |
|  |  |  |- 02 Variables          | |  | }                  | | |
|  |  |  `- 03 Functions          | |  `--------------------+ | |
|  |  |- Intermediate             | |                        | |
|  |  |- Advanced                 | |  +- OUTPUT TABS -----+ | |
|  |  `- Expert                   | |  | [IR] [Diag] [Ver] | | |
|  |                              | |  | define i64 @main() | | |
|  |  Examples                    | |  |   ret i64 42       | | |
|  |  |- Structs                  | |  | }                  | | |
|  |  |- Contracts                | |  `--------------------+ | |
|  |  `- FFI                      | |                        | |
|  |                              | |  +- STATUS BAR ------+ | |
|  |                              | |  | Compiled in 12ms   | | |
|  `------------------------------+ |  `--------------------+ | |
|                                   `------------------------+ |
`--------------------------------------------------------------+
```

### 2.3 Modes

| Mode | Layout | Purpose |
|------|--------|---------|
| **Lesson Mode** | Sidebar lesson text + editor + output | Guided learning |
| **Playground Mode** | Editor + output (no sidebar) | Free experimentation |
| **Debug Mode** | Full pipeline: tokens, AST, checked, IR, contracts | Compiler internals |

---

## 3. FEATURES

### 3.1 Editor (Monaco)

- VS Code's Monaco Editor embedded in-browser
- XIOM syntax highlighting (via custom TextMate grammar)
- Auto-completion (stdlib functions, types, keywords)
- Real-time error underlines (diagnostics from compiler)
- Code formatting (`xiom-fmt` via WASM)
- Go-to-definition for local symbols

### 3.2 Compiler Pipeline (5-stage visibility)

| Tab | Shows | When |
|-----|-------|------|
| **Tokens** | Lexer output -- token stream with spans | Always available |
| **AST** | Parser output -- tree view of program structure | Always available |
| **Checked** | Type checker output -- resolved types, borrow state | Always available |
| **LLVM IR** | Codegen output -- syntax-highlighted LLVM IR | Always available |
| **Contracts** | Verification results -- Z3 output, counterexamples | When contracts exist |
| **Diagnostics** | All errors/warnings with source locations | Always available |

### 3.3 Lessons System

**400+ lessons across 8 levels:**

| Level | Title | Lessons | Topics |
|-------|-------|---------|--------|
| **L0** | First Steps | 20 | What is programming? Variables, print, comments |
| **L1** | Foundations | 40 | Types, operators, control flow, functions |
| **L2** | Data | 50 | Structs, enums, Option, Result, Vec, Map |
| **L3** | Systems | 60 | Memory model, ownership, borrowing, references |
| **L4** | Safety | 50 | Contracts, invariants, error handling, unsafe |
| **L5** | Patterns | 60 | Generics, interfaces, traits, derive, iterators |
| **L6** | Engineering | 50 | Modules, packages, testing, benchmarking, FFI |
| **L7** | Mastery | 40 | Compiler internals, Z3 verification, self-hosting |
| **L8** | Ecosystem | 30 | Vulkan, GLFW, Redis, JSON, networking |

**Each lesson:**
```json
{
  "id": "L1-03-functions",
  "level": 1,
  "title": "Functions",
  "duration": "10 min",
  "concepts": ["fn", "return", "parameters", "return type"],
  "narrative": "Functions let you package code into reusable blocks...",
  "code_template": "fn add(a: Int, b: Int) -> Int {\n  // your code here\n}",
  "solution": "fn add(a: Int, b: Int) -> Int {\n  return a + b;\n}",
  "tests": [
    {"input": "add(1, 2)", "expected": "3"},
    {"input": "add(-1, 1)", "expected": "0"}
  ],
  "tips": ["Use `return` to send a value back", "Every parameter needs a type"],
  "related": ["L1-02-variables", "L1-04-control-flow"]
}
```

### 3.4 Showcase

**Landing experience that demonstrates the language:**
- Animated code examples cycling through features
- "XIOM in 60 seconds" -- rapid feature tour
- Compiler stats live ticker (930 tests, 16 crates, 40 stdlib modules)
- "What makes XIOM different" comparison cards

---

## 4. TECHNICAL ARCHITECTURE

### 4.1 Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Editor** | Monaco Editor 0.52+ | Code editing with LSP-like features |
| **Compiler** | `xiom_wasm.wasm` | In-browser compilation (all 4 stages) |
| **UI** | Vanilla JS + CSS (no React) | Fast, zero-dependency UI |
| **Server** | Node.js (Express or bare http) | Lesson catalog API, file serving |
| **Data** | JSON files in `lessons/` | Lesson content, metadata |
| **Static** | Any HTTP server | Production deployment |

### 4.2 File Structure

```
xiom-playground/
|-- index.html               # Main entry -- landing + playground
|-- server.js                # Node.js dev server
|-- xiom.wasm                # WASM compiler
|-- css/
|   |-- theme.css            # Tesla-dark design tokens
|   |-- layout.css           # Grid layout
|   `-- editor.css           # Monaco overrides
|-- js/
|   |-- app.js               # App state + routing
|   |-- editor.js            # Monaco setup + LSP bridge
|   |-- compiler.js          # WASM compiler bridge
|   |-- lessons.js           # Lesson loader + progress
|   `-- ui.js                # Tab management, animations
|-- lessons/
|   |-- index.json           # Lesson catalog
|   |-- L0-first-steps/      # Level 0 lessons
|   |-- L1-foundations/      # Level 1 lessons
|   `-- ...                  # L2-L8
|-- grammar/
|   `-- xiom.tmLanguage.json # TextMate grammar for syntax highlighting
`-- examples/
    |-- hello.xi
    |-- fib.xi
    `-- ...
```

---

## 5. IMPLEMENTATION PHASES

### Phase 1 -- Core Editor (2-3 days)
- Monaco Editor integration with XIOM syntax highlighting
- Tesla-dark theme CSS
- Layout: header + editor + output tabs
- WASM compiler integration (compile on Ctrl+Enter)
- IR + Diagnostics tabs

### Phase 2 -- Pipeline Visibility (1-2 days)
- Tokens tab (lexer output)
- AST tab (tree view)
- Contracts tab (Z3 verification results)
- Error underlines in editor (diagnostics -> Monaco markers)

### Phase 3 -- Lessons System (3-5 days)
- Lesson catalog (index.json + lesson files)
- Sidebar lesson browser
- Lesson content with embedded code
- Code templates that load into editor
- Progress tracking (localStorage)

### Phase 4 -- Lessons Content (5-10 days)
- Write 400+ lessons across 8 levels
- Each with narrative, code template, solution, tests, tips
- Prose written for complete beginners (L0-L1), technical for L5+

### Phase 5 -- Polish (2-3 days)
- Landing page showcase animation
- "XIOM in 60 seconds" feature tour
- Mobile-responsive layout
- Performance optimization

---

## 6. OPEN QUESTIONS

| # | Question | Options |
|---|----------|---------|
| 1 | Lessons: write all 400 now, or build framework + sample lessons first? | Framework + 20 sample lessons first |
| 2 | Monaco: load from CDN or bundle? | CDN (faster initial load, cached) |
| 3 | Backend: keep Node.js or use WASM exclusively? | Node.js for lessons API, WASM for compilation |
| 4 | Auth: user accounts for progress tracking? | No -- localStorage for v1, optional later |
