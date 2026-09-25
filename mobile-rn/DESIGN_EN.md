# Mobile design notes

[简体中文](DESIGN.md)

> Translation note: this is an English translation of this fork's mobile-rn/DESIGN.md.

## Architecture

- `screens` handles mobile interaction and lifecycle concerns.
- `data` uses Expo SQLite to store works, volumes, chapters, messages and model configuration.
- `expo-secure-store` holds provider API keys; SQLite only stores SecureStore references.
- `llm/client.ts` normalises the request/response formats of OpenAI-compatible, Gemini and Anthropic providers into an Agent turn.
- `agent` only calls local repository tools and does not depend on a desktop backend.
- `search` uses the GGUF embedding and reranking models downloaded into the app's private directory after first launch to build local vector indexes for chapters, characters and the world book.
- `settings` stores index, context, tool permission, rule, skill and agent configuration.

## Network boundaries

The app itself exposes no local HTTP service and opens no Socket.IO connection. Network requests only go from the model client to the Base URL configured by the user. The Base URL and API key are validated before every call; model responses are handled by HTTP status and JSON format, with a 120-second timeout.

Runtime resource downloads are the explicit network entry points: the OpenFicM base catalog and the Lorn mobile catalog are pinned to the immutable commit `1a848fbe77f9952c38aac8c18240026154446114` and verified against a fixed SHA-256, oh-story is fetched from official releases, the original Lorn distillation Skill is pinned to commit `5acd34586d5d241193bd36ceed9341f7f482ea3b`, and the two GGUF models come from a fixed Hugging Face repository. All downloads are size-limited; models are written to a `.download` temporary file and only moved into place after the size and SHA-256 checks pass. Scripts, hooks, Git configuration, browser automation and other files in remote repositories are never downloaded or executed.

## Local retrieval

- bge-small-zh-v1.5-q4_k_m.gguf generates vectors for Chinese queries and source material.
- bge-reranker-base-q4_k_m.gguf reranks the candidate set locally.
- Both models run on CPU through llama.rn and are warmed up automatically once the first-launch resources are complete; the advanced settings page only shows the status and a one-tap repair entry, with no manual warm-up/release buttons.
- SQLite only stores vector chunks and source metadata; the index can be cleared or rebuilt on its own.

## Android adaptations

- Only arm64-v8a is built; the APK contains no GGUF, Agent or Skill and downloads them into the app's private directory on demand at first launch.
- `standalone` uses the debug certificate but disables the dev-server mode and bundles JS, for manual phone testing without a PC; the plain `debug` variant keeps the Metro development experience.
- softwareKeyboardLayoutMode=resize, the Manifest adjustResize and react-native-keyboard-controller together handle vendor input methods.
- Long forms use a focus-aware scroll container; the writing and assistant pages shrink by the keyboard height so the bottom editing area is never covered.
- The native Android directory ships with the project and is built directly; after changing app.json, an Expo plugin or a native dependency you must re-run prebuild and re-check the local SDK path, Gradle mirror script, ABI and permissions.

## Writing and export

- Chapters open in preview mode by default; the input box only appears after you explicitly tap Edit. A successful save returns to preview, which reduces accidental touch edits.
- Before exporting, the current draft is persisted and the latest volume/chapter data is read from SQLite; the current chapter, the current volume and the whole novel are supported.
- Export output is generated as Markdown in the app cache directory, illegal Android/Windows characters are stripped from the file name, and the result is handed to the system share sheet; the app does not request external storage permission on its own.

## Assistant message branching

- When an API call fails, the original user message and the history snapshot for that turn are kept; retry only removes the failure notice and re-runs the Agent without inserting the user message twice.
- Editing a past user message deletes that message and everything after it inside an exclusive SQLite transaction, then saves the edit and re-runs the Agent, so the linear conversation context matches the UI.
- Switching conversations clears the edit/retry state that belongs to the current screen only, avoiding mis-operations across works or sessions.
- Completed assistant messages offer copy and regenerate; failed messages write the status, friendly error, raw error and the model/Agent of that run into the message metadata, so retry remains available after re-entering the conversation.

## Lorn style plugin

- The plugin source lives at `plugins/lorn-style-evolution` in the repository root, isolated from the built-in catalog and the oh-story update content.
- "Distil style", "Analyse novel style" and "Extract writing DNA" automatically activate the style-distillation Skill; "Update my style" and "Save and evolve style" automatically activate the style-evolution Skill.
- `style_sources` stores reference-book metadata, with the original file and the normalised text in the app's private directory; TXT, Markdown and EPUB are supported, along with UTF-8, UTF-16 and GB18030/GBK text.
- Distillation sends at most six distributed samples to the user's configured default model and never uploads the full reference book; EPUB entry count, total text and final character count are all capped.
- `style_profiles` stores version chains for reference styles and work-level author styles; a work selects one version, or "no style", through an explicit setting.
- `chapter_drafts` links the Agent's AI draft, the style used at the time and the author's final version. Evolution is only allowed when the latest AI draft has real author edits, and reverting to the draft clears the pending-evolution state.
- Style evolution compares the AI draft with the author's final version using the current model directly; there is no service address or FastAPI runtime dependency.
- Before generating or modifying body text, the assistant asks for a style structurally when none has been chosen yet; the selected guide is only injected into body-text requests and the writing Agent, and cannot override factual consistency, safety boundaries or an explicit request from the user in that turn.
- The full Lorn material is kept in a local resource bundle and loaded at runtime in chunks (main Skill, templates, 16 dimensions, lightweight mode and DNA audit) with prompt length limits, so it does not crowd out the model context.
- Plugin tools keep obeying the existing tool permissions when reading, saving, selecting or evolving styles; data is never written into the oh-story bundle and is never overwritten by remote content updates.
- The original Lorn Skill is pinned to commit `5acd34586d5d241193bd36ceed9341f7f482ea3b`; the original repository root declares no LICENSE, so redistribution and reuse must follow the terms published by the upstream author and you must confirm authorisation yourself.

## Character and world-book export

- Characters and world-book entries support single-entry and all-entries-of-the-current-work export, as JSON or Markdown.
- JSON includes the schema version, work ID, export time and all data fields; Markdown uses a level-2 heading per entry.
- File names are cleaned of illegal characters and written to the Expo cache, then handed to the Android system share sheet, with no new external storage permission.

## Gemini Schema

Gemini function declarations use the capitalised Schema types and drop the unsupported `additionalProperties`. The React Native client recursively fills in missing types and carries the thought signature returned by Gemini through subsequent tool turns verbatim; the desktop side expands local `$defs` references before binding Google tools and folds nullable `anyOf` into a single type with `nullable`, avoiding a 400 when `chapter_ref` is missing `type`.

## Data safety

- API keys never enter SQLite, chat messages or debug logs.
- SQL uses parameter binding; chapter content is limited to at most 2,000 lines or 100,000 characters at the save boundary.
- Users can configure HTTP APIs, so Android allows cleartext traffic; HTTPS is recommended for production providers.

## oh-story supply-chain boundaries

- Threat model: release tags can be moved, remote Markdown can contain out-of-scope instructions, downloads can grow abnormally large, and an interrupted install can leave the version state inconsistent.
- Safety decisions: check results are bound to a Git commit/tree SHA, files are fetched through immutable commit paths and checked against the tree allowlist; a commit change within the same version is refused for overwrite; per-file, whole-package, file-path and file-count limits are all enforced locally.
- Execution boundaries: remote content only serves as model instruction data; the runtime tool set is generated by local code, sub-agents cannot add tools on their own, and write tools keep following the allow/ask/deny permissions.
- State consistency: the current and rollback packages are switched together inside an exclusive SQLite transaction, and SHA-256 is used for local install records and issue tracking.
- Known risks: the app trusts data returned over GitHub HTTPS and the semantics of Markdown published by upstream maintainers; updates therefore always require manual confirmation by the user and are never installed silently in the background.
- Upstream build-tool risks: npm Audit currently flags `image-size@1.2.1` (used by Metro) and `uuid@7.0.3` (in the iOS project-generation chain); neither enters the Android runtime data path, and an automatic fix would wrongly downgrade Expo 57 to 53, so this version does not force an override and waits for an upstream Expo SDK upgrade.

## Change log

### 2026-08-17 - Core React Native Android port

Added the local SQLite writing data layer, model provider adapters, an offline-startable mobile UI and Gemini schema compatibility handling.

### 2026-08-17 - Full mobile settings and local retrieval

Added characters, the world book, provider model discovery, the desktop's settings categories, local embedding and reranking models, and improved Android keyboard avoidance and arm64 packaging configuration.

### 2026-08-17 - Work-level conversations, collaborating agents and oh-story updates

Added work-isolated chat conversations, PC built-in skills/agents, sub-agent delegation, a double consistency check for characters and the world book after chapter changes, and oh-story Markdown content updates bound to Git tree/blob SHAs that can be rolled back transactionally.

### 2026-08-17 - OpenFicM 0.4.0 volume/chapter management and open-source release

The writing-page table of contents is grouped by volume, with creating, renaming and deleting volumes and chapters; the delete transaction also cleans up FTS and vector indexes and triggers the setting consistency check. The release signing key moved out of the repository, GGUF became a verified download, and public CI only checks mobile dependencies and types.

### 2026-08-18 - OpenFicM 0.5.0 stability and release validation

Character and world-book delete transactions clean up vector indexes in step; the assistant cancels unfinished structured questions when leaving a work or the page; a failed settings persist keeps a visible error and avoids unhandled promises. The release build script requires a lineage to provide both the legacy and the new signer.

### 2026-08-19 - OpenFicM 0.6.0 export and recoverable editing

The writing page became preview-first and supports Markdown export of chapter, volume and whole book; the assistant gained failed-request retry and past user-message editing, with the linear context after the edit point rebuilt uniformly in a transaction.

### 2026-08-20 - Style plugin, message actions and data export

Added the isolated Lorn style distillation/evolution plugin, work-level style guides and dynamic body-text injection; the assistant gained copying, regeneration, persisted retry after failure and error details; the character library and world book gained single and batch JSON/Markdown export.

### 2026-08-20 - Reference library and author-style loop

The style feature became an independent reference library supporting TXT, Markdown and EPUB import, reference-style version management, and selection from the assistant and the writing page; Agent drafts and author final versions are linked locally so that an author-level style can be evolved after edits. The Android service address and FastAPI path were removed, and Lorn runtime instruction length is capped.

### 2026-08-20 - OpenFicM 0.7.0 release review

Runtime resource addresses are now pinned to immutable commits; deleting and replacing past user messages was merged into a single exclusive SQLite transaction; autosave reschedules unsaved drafts after a concurrent save finishes; Gemini tool turns preserve the thought signature, and failure records keep the original network error details. The release build cleans android/app/build first and rejects any GGUF entry before copying artifacts, so stale incremental resources cannot re-enter the APK.
