## Plan: Real AI Image Generation, Sidebar Navigation, Timeline, Settings Page, and Whisk Integration

### Current State

- Frontend: Project form + status page with scene cards, no sidebar, no settings, no timeline
- Backend: Edge functions generate mock SVG placeholders and silent MP3s
- Images are SVGs stored as `.png` — not viewable as real images
- No Whisk integration, no voice selection, no projects list page

### What We'll Build

#### 1. Real AI Image Generation (Lovable AI)

Replace mock SVG generation with actual AI-generated images using the **Lovable AI gateway** (`google/gemini-2.5-flash-image`). This is already available via `LOVABLE_API_KEY` — no new secrets needed.

- In `create-project` edge function: call `https://ai.gateway.lovable.dev/v1/chat/completions` with `modalities: ["image", "text"]` and the scene's `image_prompt`
- Decode base64 PNG response and upload to storage as real PNG
- Keep fallback ladder: try primary prompt → fallback_prompts[0] → [1] → [2]
- Same change in `regenerate-asset`

#### 2. Whisk Image Provider (Cookie-Based)

Add Whisk as an alternative image provider. Requires a Google cookie secret.

- Add `WHISK_COOKIE` secret
- In edge function, implement Whisk API calls using the reverse-engineered REST endpoints (the npm package is Node.js — we'll replicate the HTTP calls in Deno)
- Flow: create temp project → generate image with prompt → download result → upload to storage
- Project settings `imageProvider` field selects: `"ai"` (Lovable AI default), `"whisk"`, or `"mock"`

#### 3. Sidebar Navigation

Add a collapsible sidebar using shadcn `Sidebar` component:

- **New Project** — `/`
- **Projects** — `/projects` (new page listing all projects)
- **Settings** — `/settings` (new page)
- Active route highlighting
- Wrap all routes in `SidebarProvider` layout

#### 4. Projects List Page (`/projects`)

- Query all projects from DB, show cards with title, status badge, scene count, created date
- Click to navigate to project status page

#### 5. Settings Page (`/settings`)

- **Image Provider**: selector (Lovable AI / Whisk / Mock)
- **Voice Selection**: voice ID input (for future TTS integration)
- **Model ID**: TTS model selector
- **Concurrency**: image/audio concurrency sliders
- Settings saved to localStorage and passed as form data on project creation

#### 6. Scene Timeline View

Add a horizontal timeline visualization on the project status page:

- Scrollable strip of scene thumbnails in order
- Click a scene thumbnail to scroll to its detail card
- Color-coded borders: green (completed), yellow (pending), red (failed)
- Shows scene number overlay on each thumbnail

#### 7. Scene Splitting Explanation

The current Groq prompt already handles scene splitting. The mechanism:

- Script is sent to Groq/Gemini with instructions to split every 2-4 sentences
- New scene created when location, action, or emotional beat changes
- AI returns structured JSON array of scenes with prompts, types, and periods

### Files to Create/Modify

**New files:**

- `src/components/AppSidebar.tsx` — sidebar navigation
- `src/components/AppLayout.tsx` — layout wrapper with sidebar
- `src/components/Timeline.tsx` — horizontal scene timeline
- `src/pages/Projects.tsx` — projects list page
- `src/pages/Settings.tsx` — settings page

**Modified files:**

- `src/App.tsx` — wrap in sidebar layout, add new routes
- `src/pages/ProjectStatus.tsx` — add timeline component
- `src/lib/api.ts` — add `getProjects()` function
- `supabase/functions/create-project/index.ts` — replace mock with Lovable AI image generation + Whisk option
- `supabase/functions/regenerate-asset/index.ts` — same image generation upgrade

### Secret Needed

- `WHISK_COOKIE` — Google account cookie for Whisk API access

### Implementation Order

1. Add sidebar layout + routes
2. Create projects list page
3. Create settings page
4. Add timeline component to project status
5. Upgrade edge functions with real AI image generation
6. Add Whisk provider option (after cookie secret is set)

asset page where the access is tool , user can preview it the image and the voice 