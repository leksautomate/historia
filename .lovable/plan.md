

## Plan: Bulk Regenerate, Editable Prompts, Scene Splitting, and Voice Selection

### 1. Bulk Regenerate Failed Scenes
**ProjectStatus.tsx**: Add a "Retry All Failed" button above the scenes list. It iterates all scenes where `image_status === "failed"` or `audio_status === "failed"` and calls `regenerateAssetFrontend` for each, with a progress indicator showing `(3/7 retried...)`. Button only appears when there are failed scenes.

### 2. Editable Prompts per Scene
**SceneCard.tsx**: Make `image_prompt`, `tts_text`, and `script_text` editable inline. Add an edit toggle button per text field. When editing, show a `Textarea` pre-filled with the current value. On save, update the scene in the database via `supabase.from("scenes").update(...)`. The regenerate buttons then use the updated prompt.

### 3. Scene Splitting
**SceneCard.tsx**: Add a "Split Scene" button. When clicked, show a dialog where the user can choose a split point in the script text (e.g., select which sentence starts the new scene). On confirm:
- Update the current scene's `script_text`, `tts_text`, and `image_prompt` to cover the first half
- Insert a new scene row with `scene_number = current + 0.5` (then renumber all scenes sequentially)
- The new scene gets `pending` status for image/audio so the user can regenerate

### 4. Voice Selection with Multiple Voices
**Settings.tsx & providers.ts**: Replace the single `voiceId` text input with a predefined list of Inworld voices. Users can pick from a dropdown of voices with name and ID.

**Inworld voices to include** (name → voiceId):
- Dennis → `Dennis`
- Eleanor → `Eleanor`
- James → `James`
- Linda → `Linda`
- Brian → `Brian`
- Amy → `Amy`

**SceneCard.tsx**: Add a per-scene voice selector dropdown so each scene can use a different voice. Store the selected voice on the scene (new column or in a JSON field). When regenerating audio, use the scene-level voice if set, otherwise fall back to global settings.

### 5. Show Image Generation Prompt Details
The image prompt is already displayed in SceneCard (lines 181-196) in a mono code block with a copy button. With the editable prompts feature (item 2), users will now be able to both view and modify the prompt before regenerating.

---

### Technical Details

**Database migration needed**: Add a `voice_id` column to the `scenes` table (nullable text, defaults to null — meaning "use global setting").

**Files to modify**:
- `src/pages/ProjectStatus.tsx` — bulk regenerate button + progress
- `src/components/SceneCard.tsx` — editable fields, split scene, per-scene voice selector
- `src/lib/api.ts` — `regenerateAssetFrontend` to accept optional voice override; new `splitScene` and `bulkRegenerateFailed` helpers
- `src/pages/Settings.tsx` — voice dropdown with predefined voices instead of free text
- `src/lib/providers.ts` — voice list constant

**New component**: `src/components/SplitSceneDialog.tsx` — dialog for choosing the split point in a scene's script text.

