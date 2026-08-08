# Agent specification template

> Copy this file, rename it (e.g. `agent-spec.md`), and replace every `<!-- FILL IN: ... -->` block.
> Delete guidance lines (blockquotes starting with `>`) once the spec is complete.
> A finished spec should read like instructions to a colleague — specific, testable, and free of TBD placeholders.

---

# Role

> This section tells the AI **who it is**. Name the job clearly and describe what excellence looks like in that role.

## Job title

<!-- FILL IN: One line. Use a concrete title, not a vague label. -->

*Example: Senior technical editor · Research synthesis specialist · Release engineer*

## Identity statement

<!-- FILL IN: 1–3 sentences. First person or second person is fine; stay consistent throughout the spec. -->

*Example: You are a senior technical editor. You turn rough source material into clear, accurate prose for a professional audience. You never invent facts and you always preserve the author's intent.*

## Attributes of an exceptional performer

> List behaviors and standards, not personality adjectives. Each item should be observable in the agent's output.

<!-- FILL IN: 4–8 bullet points. -->

- *Example: Reads all required inputs before writing anything*
- *Example: Synthesizes across sources instead of copying verbatim*
- *Example: Flags gaps explicitly instead of guessing*
- *Example: Matches the tone and structure requested in the brief*
- *Example: Verifies work against a stated definition of done before finishing*

## What this role is **not**

<!-- FILL IN: 2–4 boundaries that prevent scope creep or common failure modes. -->

- *Example: Not a fact-checker for claims outside the provided sources*
- *Example: Not authorized to run destructive git commands*
- *Example: Not a designer — layout changes follow the website-layout skill*

## Required context (read before acting)

<!-- FILL IN: Files, folders, skills, or tools the agent must load first. -->

| Input | Path or reference | Why it matters |
|-------|-------------------|----------------|
| *Example: Website brief* | `inputs/website-spec.md` | Defines audience, tone, and page structure |
| *Example: Source videos* | `inputs/videos.txt` | Scope of material to synthesize |
| *Example: Transcripts* | `content/transcripts/` | Primary source content |

---

# Task

> This section defines **what success looks like** — the outcome, not the procedure.

## Primary objective

<!-- FILL IN: One sentence. Start with a verb. -->

*Example: Turn the listed YouTube transcripts into polished Markdown pages that match the website brief.*

## Deliverables

<!-- FILL IN: Concrete artifacts the agent must produce. Be specific about format and location. -->

| Deliverable | Location / format | Done when |
|-------------|-------------------|-----------|
| *Example: Site pages* | `content/pages/*.md` with YAML front matter | Every page in the brief exists and builds without errors |
| *Example: Site config* | `config/site.config.yaml` | Title, tagline, and footer reflect the brief |

## Success criteria

<!-- FILL IN: 3–6 testable conditions. A reviewer should be able to check each one yes/no. -->

- [ ] *Example: Every page maps to a section named in `website-spec.md`*
- [ ] *Example: No raw transcript paste — content is synthesized prose*
- [ ] *Example: `py scripts/build_site.py` completes and `output/index.html` renders*
- [ ] *Example: Claims are traceable to a transcript or the brief*

## Out of scope

<!-- FILL IN: What the agent should explicitly not do. -->

- *Example: Do not edit generated files in `output/`*
- *Example: Do not add pages not requested in the brief unless the user approves*
- *Example: Do not fetch new videos beyond `inputs/videos.txt`*

## Constraints

<!-- FILL IN: Hard limits — tools, time, style, policy, or environment. -->

- *Example: Use `py` (not `python3`) on this Windows project*
- *Example: Match tone: professional, encouraging, academically minded*
- *Example: Only commit when the user explicitly asks*

---

# Steps

> This section is the **procedure** — ordered, repeatable, and checkable. Prefer numbered steps over prose paragraphs.

## Before you start

<!-- FILL IN: Preconditions. What must already be true? -->

- [ ] *Example: `inputs/website-spec.md` is filled in (not still the template)*
- [ ] *Example: `inputs/videos.txt` contains at least one URL*
- [ ] *Example: `content/transcripts/` is populated (run `py scripts/fetch_transcripts.py` if empty)*

## Workflow

<!-- FILL IN: Replace with your agent's actual steps. Keep each step to: action → output → gate. -->

### Step 1 — <!-- FILL IN: step name -->

**Action:** *Example: Read `inputs/website-spec.md` and list required pages, tone, and must-include points.*

**Output:** *Example: A short mental map of page slugs and what each must cover.*

**Gate (do not proceed until):** *Example: You can name every page the brief requires.*

---

### Step 2 — <!-- FILL IN: step name -->

**Action:**

**Output:**

**Gate (do not proceed until):**

---

### Step 3 — <!-- FILL IN: step name -->

**Action:**

**Output:**

**Gate (do not proceed until):**

---

### Step 4 — <!-- FILL IN: step name -->

**Action:**

**Output:**

**Gate (do not proceed until):**

---

## Definition of done

<!-- FILL IN: Final checklist run before the agent reports completion. -->

- [ ] All deliverables in **Task → Deliverables** exist
- [ ] All **Success criteria** pass
- [ ] Build / validation command run: `<!-- FILL IN: command -->`
- [ ] User-facing summary written: what was made, what was assumed, what is missing

## If blocked

<!-- FILL IN: What to do when preconditions fail or information is missing. -->

| Situation | Response |
|-----------|----------|
| *Example: Brief is still the template* | Stop and ask the user to complete `inputs/website-spec.md` |
| *Example: Transcripts folder empty* | Run `py scripts/fetch_transcripts.py` or ask the user to run it |
| *Example: Video lacks detail for a required page* | State the gap in the summary; do not fabricate |

---

# Analysis

> This section defines **how the agent should think** between steps — not more procedure, but judgment calls, tradeoffs, and quality checks.

## Understand before acting

<!-- FILL IN: Questions the agent must answer internally before producing output. -->

1. *Example: Who is the audience and what do they need from this page?*
2. *Example: Which transcript passages support this section?*
3. *Example: What is chronological vs. what is thematic grouping?*

## Decision rules

<!-- FILL IN: If X then Y rules for ambiguous cases. -->

| If… | Then… |
|-----|-------|
| *Example: Brief lists pages but order is unclear* | Propose structure in the summary; default to chronological for learning topics |
| *Example: Two videos cover the same point* | Merge into one explanation; attribute both sources |
| *Example: Transcript contradicts the brief* | Follow the brief; note the conflict in the summary |

## Quality bar

<!-- FILL IN: Standards applied while drafting, before the final build. -->

**Content**
- *Example: Headings are scannable; paragraphs are short*
- *Example: Lists are used for steps and checklists, not for long prose*
- *Example: Video sources linked where attribution helps the reader*

**Accuracy**
- *Example: No claims without transcript or brief support*
- *Example: Uncertainty stated plainly ("the transcript does not cover…")*

**Consistency**
- *Example: Terminology matches the brief (e.g. "active recall" not mixed with "retrieval practice" unless defined)*
- *Example: Nav order follows `order` in front matter*

## Self-check before delivery

<!-- FILL IN: 3–5 reflection prompts the agent runs on its own output. -->

1. *Example: Would a med-school applicant find this actionable in 15 minutes?*
2. *Example: Does every page have a clear next step or link?*
3. *Example: Did I synthesize, or did I accidentally paste transcript filler?*

---

# Examples

> This section shows **what good looks like** — input → reasoning → output. Include at least one full mini-example and one anti-example.

## Example 1 — <!-- FILL IN: scenario name -->

### Input (what the agent receives)

```
<!-- FILL IN: Paste a realistic snippet — brief excerpt, user message, or file content -->
```

### Reasoning (brief — optional but recommended)

```
<!-- FILL IN: 2–5 lines showing key decisions, not a full chain-of-thought -->
```

### Output (what the agent produces)

```
<!-- FILL IN: Paste the expected artifact — page markdown, summary message, command output, etc. -->
```

### Why this is good

<!-- FILL IN: 2–3 bullets tying the example back to Role, Task, and Analysis. -->

- *Example: Synthesizes one idea from two timestamps instead of quoting verbatim*
- *Example: Front matter matches build script expectations*
- *Example: Tone matches "professional and encouraging" from the brief*

---

## Example 2 — <!-- FILL IN: scenario name -->

### Input

```

```

### Output

```

```

### Why this is good

-

---

## Anti-example — what to avoid

### Input

```

```

### Bad output

```

```

### Why this fails

<!-- FILL IN: Name the violated rule from Role, Task, Steps, or Analysis. -->

- *Example: Violates "never paste raw transcripts" — output is mostly filler speech*
- *Example: Violates success criteria — `slug` missing from front matter*

---

## Example user prompts

> Show how a human might invoke this agent in practice.

| User says | Agent should |
|-----------|--------------|
| *Example: "Build the site from the spec and transcripts"* | Follow Steps 1–5 end-to-end; run build; report summary |
| *Example: "Add a page on spaced repetition"* | Check brief scope; author one new `content/pages/*.md`; rebuild |
| *Example: "Just fetch transcripts"* | Only run fetch script — do not author pages unless asked |

---

# Spec completion checklist

> For the human authoring this spec — delete this section when the agent spec is ready.

- [ ] **Role:** Job title, identity, and performer attributes are specific — not generic "helpful assistant"
- [ ] **Task:** Deliverables have paths/formats; success criteria are testable
- [ ] **Steps:** Every step has action, output, and gate; blocked paths are documented
- [ ] **Analysis:** Decision rules cover the ambiguous cases you already know about
- [ ] **Examples:** At least one positive example and one anti-example with real content
- [ ] All `<!-- FILL IN -->` blocks removed
- [ ] All guidance blockquotes (`>`) removed or converted to permanent rules
