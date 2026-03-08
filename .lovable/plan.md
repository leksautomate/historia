

## Plan: Upgrade Text Splitter with Smart Split Modes

Replace the current simple word-count splitter with the advanced logic from the provided code, adapted to use the project's existing UI components (Card, Button, Select, Input, Label, Textarea).

### Changes

**`src/pages/TextSplitter.tsx`** — Full rewrite:
- Add split mode selector: "Smart (by sentences)" vs "Exact (by word count)" using the Select component
- Add "target words per part" input (default 150) replacing "number of parts"
- Add tolerance input (default 35) for smart mode flexibility
- Add join mode selector: double newline vs single newline between parts
- Port the smart splitting logic: `splitIntoSentences`, `splitLongSentence`, sentence-aware chunking with tolerance
- Keep exact mode as fallback
- Show stats cards: total words, output parts count, split style
- Two-panel layout: input on left, output on right
- Keep existing download and copy functionality
- Use existing UI components (Card, Button, Select, Input, Label, Textarea, toast)

No other files need changes — routing and sidebar already set up.

