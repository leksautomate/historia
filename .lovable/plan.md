

## Plan: Remove Part Headers from Output Text & Download

The user wants the output textarea and downloaded .txt to contain **only the raw text** separated by newlines — no `--- Part X (Y words) ---` headers. The part labels and word counts should remain visible only in the UI cards below.

### Changes

**`src/pages/TextSplitter.tsx`**:

1. **Line 97** — Change `outputText` to join chunks with just the separator, no headers:
   - From: `` `--- Part ${i + 1} (${countWords(c)} words) ---\n${c}` ``
   - To: just `c` (the raw chunk text)

2. **Download and Copy** already use `outputText`, so they'll automatically get clean text.

The UI cards at the bottom already show "Part X — Y words" separately, so no changes needed there.

