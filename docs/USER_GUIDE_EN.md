# Better OpenFicM Android User Guide

[简体中文](USER_GUIDE.md)

Applies to version: 0.8.0

Better OpenFicM is a local-first Android app for novel writing. Once installed it needs no PC, no FastAPI, no Socket.IO and no other self-hosted backend; works, chapters, chat history, style versions and local indexes are kept on the phone by default. Generating prose still requires a model provider that you configure yourself.

## 1. Before you install

- Android 9.0 or later.
- A 64-bit ARM phone (arm64-v8a).
- At least 500 MB of free space is recommended.
- The first launch needs to reach GitHub and Hugging Face to download the runtime resources.
- AI generation needs your own model API key. Better OpenFicM does not provide public model quota.

When upgrading from an older version, just install the new APK over the old one. Do not uninstall the app first: uninstalling clears works, conversations, reference books and local models from the app's private directory. Export important works first to keep a copy.

## 2. First launch

On first entry the "Prepare OpenFicM" screen appears. Tap "Fetch and prewarm in one go". The app downloads and verifies:

1. The OpenFicM base Agent and Skills.
2. The oh-story writing Skill and mobile-compatible sub-agents.
3. The Lorn style-distillation materials.
4. The ~15 MB Chinese embedding model.
5. The ~209 MB Chinese rerank model.

All resources are stored in the app's private directory. Once a model has been downloaded its file size and SHA-256 are verified; the Agent, Skill and Lorn materials are also verified against pinned sources. Remote scripts, hooks and Git configuration are never executed.

If it fails part-way you can retry on the same screen, or continue later from "Settings → Advanced → Fetch missing resources in one go".

## 3. Configure a model provider

Go to "Settings → Models & Providers":

1. Choose the provider protocol: OpenAI, Gemini or Anthropic.
2. Fill in the display name, Base URL and API key.
3. Tap "Save provider".
4. Tap "Fetch models" on the right of the saved provider. Gateways often return several hundred models; there is a "Find model" box at the top of the list that filters by name or model ID.
5. Pick a model in the list and confirm its name, model ID, temperature and max output tokens.
6. Tap "Add model".
7. Tap the radio button on the left of the model row to make it the global default model.

Common official Base URLs:

| Protocol | Base URL |
| --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` |
| Anthropic | `https://api.anthropic.com/v1` |

For third-party gateways or self-hosted compatible services, enter the API root the provider gives you, not a concrete `/chat/completions` or `/messages` endpoint. OpenAI-compatible services usually need the trailing `/v1` kept.

If a provider does not support the model-list endpoint, you can also type the model name and the exact model ID by hand in the "Add model" area.

## 4. Create and manage works

### Bookshelf

- Tap "+" in the top right of the bookshelf to create a work.
- Tap a work to open its writing screen; this also makes it the current work.
- Tap the menu on the right of a work, or long-press it, to delete it.
- From the top of the bookshelf you can open the current work's character library and world book, or the global style library.

Deleting a work also deletes its volumes, chapters, characters, world book, assistant sessions, style links and local index, with a second confirmation before it happens.

### Volumes and chapters

The top of the writing screen shows the current volume and chapter:

- Tap the table-of-contents button to see chapters grouped by volume.
- You can create, rename or delete volumes.
- You can create, rename or delete chapters inside a given volume.
- Every work always keeps at least one volume.

Opening a chapter starts in preview mode, to avoid accidental edits on a touch screen. The title and body fields appear only after you tap "Edit"; saving returns you to the preview. Auto-save, background save and keyboard avoidance are active while editing.

### Export

The export entry on the writing screen supports:

- Exporting the current chapter as Markdown.
- Exporting the current volume as Markdown.
- Exporting the whole novel as Markdown.

The character library and world book support exporting single entries or batches as JSON or Markdown. Exported files are handed to the Android share sheet, where you choose a file manager or another app to save them.

## 5. Using the assistant and the Agent

The assistant is always tied to the work currently open on the bookshelf. After switching works only that work's own conversations are loaded; other works' chat history never shows up.

### Basic flow

1. Open the work you want to write from the bookshelf first.
2. Go to "Assistant".
3. Check the current work, main agent and model at the top.
4. Switch the model and the writing style used by this session as needed.
5. Type your writing task and send it.

The assistant is more than a plain chat window. The Agent can activate Skills per task, call local tools, read the current work's materials, delegate to sub-agents, and update chapters, characters or the world book. The run shows its steps, tool calls and results.

It is best to state the goal and the range you allow it to modify, for example:

- "Plan the next chapter from the current world book and character settings, then write it as a new chapter. Confirm with me before writing."
- "Check the character motives and timeline of the last three chapters, list any conflicts, then update the world book."
- "Turn this writing idea into a character arc and a three-chapter plan; do not write prose yet."
- "Rewrite this chapter's dialogue in the current style; change only the prose, not the character settings."

### Tool permissions

In "Settings → Tool permissions", tapping each permission cycles through:

- Allow: the Agent may run it directly.
- Ask each time: a dialog confirms before running.
- Deny: the Agent must not run it.

If the Agent only replies with suggestions and never changes the work, first check that your instruction explicitly asks it to "write, update or create", then check whether the relevant tool is denied.

### Conversation management and failure recovery

- The session entry at the top lets you create, switch and delete conversations.
- Each session can pick its own model.
- Your past messages can be edited; editing one deletes the old branch after it and re-runs from that point.
- If an API or Agent run fails the task is kept; tap "Retry" to run it again.
- Expand "Raw error details" to inspect the HTTP status, timeouts or the provider's response.

## 6. How to use the style features

Better OpenFicM has three different concepts:

| Name | Purpose | Scope |
| --- | --- | --- |
| Reference book | Novel text you import, used only as distillation samples | Global style book shelf |
| Reference style | Executable writing constraints distilled from a reference book | Usable across works |
| Author style | Learned from the difference between a work's AI drafts and your final edits | Current work only |

The "Author style" menu is the entry point to the style book shelf; there is no separate style service URL to fill in. Both distillation and evolution use the current default model from "Settings → Models & Providers", and the bottom of a reference book's detail page shows which model that is.

### 1. Import a reference book

Get there from "Bookshelf → Style library" or "Settings → Author style":

1. Tap import reference book.
2. Pick a TXT, Markdown or EPUB file.
3. Tap an imported book to rename it, delete it or start distillation.

A single file must be smaller than 50 MB, and the extracted text must not exceed 8 million characters. TXT and Markdown support common encodings such as UTF-8, UTF-16 and GB18030/GBK. Only import content you have the legal right to use.

### 2. Distill a reference style

Select a reference book and tap "Distill style". The app extracts 24 consecutive chapters from the start of the book (books without chapter titles are cut into segments of about 1,400 characters), sends them in 4 batches to your configured default model for analysis, and merges the results into one reference style version. The complete novel is never uploaded to the model provider.

Following the Lorn.NovelWriteSkills method the Agent analyses sentence length, paragraph rhythm, sensory preferences, rhetorical fingerprints, forbidden words and de-AI-flavour rules, and produces a reference style version you can inspect, delete and iterate on.

**Keep distilling**: one round of 24 chapters is often not enough to represent the style of a long novel. After the first round the button becomes "Keep distilling"; each tap jumps to a random unread region, takes another 24 consecutive chapters, and merges the new evidence into the existing guide, saving it as the next version. For a 1,200-chapter book the rounds roughly go 1-24, 100-123, 180-203, 293-316 and so on, gradually covering the whole book.

- The window only moves forward; it never repeats a region already read and never skips past the end of the book.
- The panel shows "N distillation rounds done, covering chapters X/Y".
- Each round is exactly 5 model requests (4 analysis batches + 1 merge). If it is interrupted, tapping again resumes from the breakpoint instead of repeating finished batches.
- Once the end of the book is covered, "Keep distilling" is disabled; tap "Start over" to clear the progress and rescan the whole book.
- Switching books or re-importing a file with the same name invalidates the old progress and restarts from the beginning.

### 3. Using a style while writing

- The top of the writing screen lets you pick a style.
- The top of the assistant screen lets you pick a style for the current work.
- If you ask for prose while no style is selected, the Agent asks whether you want to choose one.
- Reference styles can be used across works; an author style only appears in the work it belongs to.

Once selected, the style constraints are injected into the main agent and the prose-writing sub-agents, not merely displayed as a name in the interface.

### 4. Evolving your own author style

1. Have the Agent create or rewrite a chapter; the app saves the AI draft and the style in use at the time.
2. On the writing screen tap "Edit", revise the prose to match your own habits and save.
3. Back in the preview, tap "Evolve author style".
4. The model compares the AI draft with your final version and produces a new author style version for the current work.

You can keep editing and evolving afterwards. The app keeps several versions so that one accidental change does not overwrite your long-term writing habits. If the current chapter has no matching AI draft, or the prose has no effective changes yet, the evolution entry point is not offered.

## 7. Notes: for outlines and plot planning

The "Notes" entry at the top of the bookshelf stores things that have not happened in the prose yet: outlines, plot directions, foreshadowing lists and character-arc plans.

**Do not put these into the world book.** The Agent treats the world book as established canon; if you store "I plan to write it this way" there, later writing will use it as a fact.

Notes are divided into three levels matching the structure of the work:

| Level | What to put there |
| --- | --- |
| Whole work | Book-wide outline, main-plot settings, overall character-arc plan, list of things to avoid |
| Volume | This volume's plot direction, foreshadowing to plant or pay off in this volume |
| Chapter | What this chapter must achieve, what hook to leave, temporary reminders |

The page groups notes by whole work, then by volume, then by chapter; the plus sign to the right of each group heading creates a note at that level directly. The arrow button to the right of each note changes its level: a reminder that only concerns chapter 5 can be promoted to volume level once you realise the whole volume needs it.

When you delete a chapter or a volume, if there are notes inside that range a dialog asks whether to "keep the notes" or "delete them too". If you keep them they float up automatically: notes from a deleted chapter go to its volume, notes from a deleted volume go to work level, and nothing is lost silently.

The Agent can read and write notes (`list_notes`, `read_note`, `write_note`, `edit_note`, `move_note`, `delete_note`); their permissions are adjusted separately in "Settings → Tool permissions". Only note titles go into the prompt, and the Agent reads the body only when it needs it, so having many notes does not slow down every conversation.

## 8. Characters, world book and consistency

- The character library stores appearance, personality, backstory, relationships and writing notes for people.
- The world book stores places, organisations, era background, power systems, timelines and other rules.
- The Agent can read and update these materials through tools.
- After a chapter is written or edited, the Agent can run a consistency check and propose or write character and world-book updates based on what actually changed in the plot.

It is recommended to set write permissions to "Ask each time": it keeps collaboration efficient while letting you confirm before important settings change.

## 9. Index, rules, Skills and agents

### Local index

In "Settings → Index" you can enable semantic indexing and reranking, adjust chunking and the number of results recalled, and rebuild the current work's index. Embedding and reranking run locally on the phone and never send the whole work to an external retrieval service.

### Rules

"Settings → Rules" lets you add long-term constraints, such as banning a certain kind of expression, fixing the narrative point of view or requiring a chapter length. Enabled rules go into the Agent's context.

### Skills

"Settings → Skills" lets you enable or disable the OpenFicM, Lorn and oh-story Skills as well as custom ones. The Agent activates Skills as the task requires; you do not have to pick one manually each time.

### Agents

"Settings → Agents" lets you:

- Choose the current main agent.
- Enable or disable the main agent and sub-agents.
- Assign a model to an agent, or let it follow the global model.
- Create custom main agents.

"Settings → Advanced" can check for updates to the app itself, and can also check the oh-story GitHub Release and update or roll back the content pack. The app only imports whitelisted Markdown and never runs upstream hooks.

### Checking for app updates

"Settings → Advanced → App version" shows the current version; tapping "Check for app updates" queries the latest Release on this project's GitHub. When a new version exists you can tap the button to open the download page, then install the APK over the current one — no uninstall needed. This step only reads public Release information and uploads no local data.

## 10. Data and privacy boundaries

- Works, chapters, characters, world books, conversations, reference books and style versions are stored in the app's private directory on the phone.
- API keys are stored in Android SecureStore and are never written to SQLite in plain text.
- When a model is called, the prompts, conversation and work context needed to finish the task are sent to the chosen provider.
- Style distillation sends only the chapter samples inside the current round's window, not the complete reference book.
- The local semantic index and reranker need no external retrieval server.
- Uninstalling the app deletes local data; Better OpenFicM currently has no cloud sync.

## 11. FAQ

### It stays on the runtime-resources screen

Check that GitHub, raw.githubusercontent.com and Hugging Face are reachable, and keep enough free storage. After a failure you can simply retry; resources already verified are not installed again.

### The model list cannot be fetched

Check the provider protocol, Base URL and API key. Some compatible services have no model-list endpoint; add the exact model ID by hand instead.

### Assistant requests time out or cannot connect

Adjust the timeout in "Settings → Connection" and check the network, certificates and Base URL. In the failure message you can expand the raw error and then retry.

### "The model used up N output tokens before returning any prose"

Thinking models (for example the reasoning / thinking variants from various vendors) count their reasoning process towards the maximum output tokens. If that limit is too small, the model may spend the whole budget on thinking and return no prose at all. Go to "Settings → Models & Providers" and raise the max output tokens for that model, or switch to a non-thinking model. Style distillation demands long outputs, so this message is more likely to appear there.

### Retrying after switching models still gives the same error

Before 0.7.6, tapping "Retry" on a failed message reused the model recorded when the error happened, so switching models had no effect and the only workaround was to start a new conversation. From 0.7.6 onwards a retry always uses the model you currently have selected.

### The Agent does not write chapters or settings

Explicitly ask the Agent to write, and check whether the relevant tool is set to "Deny" in "Settings → Tool permissions". When it is set to "Ask each time" you have to allow it in the dialog.

### "Evolve author style" does not appear

The chapter must first have been generated or rewritten by an Agent tool, and then actually edited and saved by you. A chapter you created by hand has no AI draft to compare against.

### Installing an update reports a signature conflict

Only download the official APK from this project's GitHub Releases. A signature conflict usually means the installed copy on the phone was signed with a different certificate. Uninstalling clears local data, so export important works before you deal with it.

### First launch or index rebuild is slow

The embedding and reranking models run on the phone's CPU, so the first load is slower than an ordinary page. Flagship phones handle it fine, but it is best to keep the app in the foreground during the first prewarm.

## 12. Recommended first-run order

1. Finish the first-run resource download.
2. Configure a provider and set the default model.
3. Create a work and fill in characters and the world book.
4. Ask the Agent for a writing plan in the assistant first.
5. Import reference books and distill reference styles as needed.
6. Pick a style and let the Agent create chapters.
7. Edit by hand and evolve the work's own author style.
8. Export the whole novel and important settings regularly.
