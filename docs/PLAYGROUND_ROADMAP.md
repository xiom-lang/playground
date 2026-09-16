<!-- Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
     SPDX-License-Identifier: MIT OR Apache-2.0 -->
# XIOM Playground -- BEGINNER-FIRST AUDIT v3

**Date:** 2026-07-23  
**Auditor Perspective:** Complete beginner, never coded, just opened the page.  
**Current Rating:** **3/10** (works technically, fails pedagogically)

---

## 1. WHAT A BEGINNER SEES (The First 10 Seconds)

### Landing Page -- Broken for Beginners

| Element | What I See | What I Should See |
|---------|-----------|-------------------|
| "The Systems Language That Verifies Itself" | What is a "systems language"? What does "verifies" mean? | "Learn to code by building real things." |
| "Zero crashes. Zero nulls. Zero surprises." | What is a "null"? What is a "crash" in programming? I've never coded. | "Write your first program in 2 minutes." |
| "compiler-enforced", "Z3 proves them" | Sounds like alien technology. Scary. | "The computer double-checks your work so you don't make mistakes." |
| "ownership with compile-time borrow checking" | I have no idea what any of these words mean. | "XIOM catches your mistakes before they happen." |
| "Start Learning -- Free" | Does this mean there's a paid version? Am I using a trial? | "Start Learning" (no "Free" -- it IS free, don't imply otherwise) |
| Feature cards: "no GC", "LLVM", "hot reload" | Jargon. Jargon. Jargon. | "Never lose your work", "Programs run fast", "Learn by doing" |

### The "Start Learning" Click

I click "Start Learning". What happens:
1. Landing fades out
2. I see a sidebar with folders like "L0 First Steps"
3. I click a lesson expecting to READ something
4. Instead, a code editor appears with `fn main() -> Int { return 42; }`
5. I have NO IDEA what this text means. What is `fn`? What is `Int`? What is `return`? WHAT IS HAPPENING?

**A beginner's first experience must be READING, not CODING.** They need to understand WHAT programming is before they write their first line.

### The Syntax Reference -- Not for Beginners

| Current (Cheatsheet) | Should Be (Stories) |
|----------------------|---------------------|
| `fn` -- Declares a function | "A function is like a recipe. You give it a name and a list of steps. When you call it, it follows the steps." |
| `let` -- Immutable variable binding | "A variable is a box with a label. You put something in it and give it a name. 'let' means the box is sealed -- you can't change what's inside." |
| `Int` -- 64-bit signed integer | "A number. Like 42, or -7, or 1000000. Computers store numbers as 'integers'." |
| `Bool` -- Boolean true/false | "A yes-or-no answer. Every question in programming has a yes or no answer -- we call this 'true' or 'false'." |

---

## 2. BUGS FOUND

| # | Bug | Severity |
|---|-----|----------|
| 1 | **Examples dropdown removed** -- the old `<select id="examples">` was deleted in rewrite. No way to load examples. | CRITICAL |
| 2 | **compiler.js uses `getActiveOutputIds()`** -- this function may not exist or may fail in playground mode vs lessons mode. The DOM IDs changed (e.g., `#ir` in lessons vs `#pgIR` in playground). | CRITICAL |
| 3 | **Landing says "Start Learning -- Free"** -- AI was asked to put that in CTA. Implies there's a paid version. Remove "Free". | HIGH |
| 4 | **Landing uses developer jargon** -- "no GC", "compile-time borrow checking", "LLVM", "Z3", "ownership". A beginner understands NONE of these. | HIGH |
| 5 | **Lessons show code immediately** -- L0-01 opens with a code editor, not with text explaining what programming is. | HIGH |
| 6 | **Syntax reference is a cheatsheet** -- 42 keywords with one-liners. Not educational. | HIGH |
| 7 | **No "What is XIOM" for beginners** -- the concepts are explained in engineer language. | MEDIUM |
| 8 | **Mode switching may leak editors** -- switching Landing->Lessons->Playground->Landing may create duplicate Monaco instances. | MEDIUM |
| 9 | **No loading state** -- when WASM or lesson catalog is loading, user sees nothing. | LOW |
| 10 | **Keyboard shortcuts not discoverable** -- Ctrl+Enter and Ctrl+K work but user isn't told. | LOW |

---

## 3. THE BEGINNER'S JOURNEY (What Should Happen)

### Step 1: "What is Programming?" (2 min read, NO code)

> *"A computer program is like a recipe. You write down steps, and the computer follows them. You can tell the computer to do math, show text, or make decisions."*

### Step 2: "Your First Program -- Hello!" (3 min, SIMPLE code)

```xiom
// This prints a message
io.println("Hello, I'm learning XIOM!");
```

The user types `"Hello, I'm learning XIOM!"` (changing the message), clicks Run, and SEES the output. **They must see output on their first try.** Not `return 42` -- they need to SEE something happen.

### Step 3: "What is a Variable?" (5 min)

```xiom
// A variable is a named box
let myName = "Alex";
io.println("Hi, my name is:");
io.println(myName);
```

### Step 4: "Doing Math" (5 min)

```xiom
let apples = 5;
let oranges = 3;
let total = apples + oranges;
io.println(total); // Shows 8
```

### Step 5+: Gradual introduction of ONE concept per lesson. Never more.

---

## 4. FIX PLAN (in order of priority)

### FIX 1 -- Landing Page (CRITICAL)
- Remove "Free" from CTA
- Rewrite hero text for beginners: "Learn to code by building real things. No experience needed."
- Rewrite feature cards in plain English:
  1. "Never crash -- XIOM catches mistakes before you run your code"
  2. "Fast programs -- your code runs as fast as C or Rust"
  3. "Learn by doing -- interactive lessons with instant feedback"
  4. "Free forever -- 370+ lessons, no signup, no payments"

### FIX 2 -- Onboarding Flow (CRITICAL)
- First screen after "Start Learning" is NOT a code editor
- It's a welcome page with a "Begin" button
- The first lesson (L0-01) starts with 2 minutes of READING about what programming is
- Then shows a SIMPLE code example that PRINTS something
- User types their name, clicks Run, sees it printed -- DOPAMINE HIT

### FIX 3 -- Syntax Reference (HIGH)
- Replace cheatsheet with "Concepts" -- one concept per card
- Each concept has: a metaphor, a simple example, and a "try it" button
- Ordered by when the user encounters it (variables first, functions later)

### FIX 4 -- Examples (CRITICAL)
- Restore the examples dropdown
- Add 3 beginner examples: "Hello World", "Variables", "Simple Math"
- Each example has a comment explaining what it does

### FIX 5 -- Bugs (CRITICAL)
- Fix compiler.js output routing (lessons vs playground DOM IDs)
- Fix mode switching (clean up Monaco instances)
- Add loading states

---

## 5. TARGET: 10/10

| Category | Current | After Fixes |
|----------|---------|-------------|
| **First impression** | Jargon, scary | Welcoming, simple |
| **First code run** | `return 42` (invisible) | `io.println("Hello!")` (visible!) |
| **Onboarding** | Code editor immediately | 2 min reading -> simple code -> win |
| **Syntax learning** | Keyword cheatsheet | Concept stories with metaphors |
| **Bugs** | Examples broken, output broken | Everything works |
| **Language** | Engineer-speak | Plain English |