# Better OpenFicM Project Handover Notes

[简体中文](OPENFICM_PROJECT_CONTEXT.md)

Last updated: 2026-08-21

This document lets a new development window quickly restore project context. Before continuing work, read this file, README.md and mobile-rn/DESIGN.md.

> Translation note (English edition). This is a faithful English translation of `OPENFICM_PROJECT_CONTEXT.md`. A few statements in it are inherited from the upstream project and do not describe this fork; they are marked `[upstream legacy]` below rather than silently rewritten:
>
> 1. The "official signing certificate SHA-256" in section 2 and section 6 is the certificate of the upstream official build. This fork is signed with a different certificate, `ff68431a9d797589a0f6034848dc1c34ae4e3acba878d5183b5afe941f08a837` (see README.md). `[upstream legacy]`
> 2. The `gh release create ... --repo tioners/OpenFicM` command in the release section targets the upstream repository. This fork publishes to `beiqiongyinhe/better-openficm`. `[upstream legacy]`
> 3. The root `AGENTS.md` mentioned in the Chinese original does not exist in this repository, so it is omitted here. `[upstream legacy]`

## 1. Project positioning

Better OpenFicM is a standalone React Native Android rewrite of OpenFic, not the desktop web app wrapped in a WebView. The goal is to let users manage novels, chapters, characters, world books and Agent conversations locally on an Android phone; the app needs no PC alongside it, and no FastAPI, Socket.IO or Metro.

The app is not a fully offline product: work data and the local Agent runtime live on the phone, but users can still configure a model API from any provider, fetch the provider's model list, and download Agent, Skill, embedding and reranking resources from GitHub/Hugging Face on first launch. The API Base URL, keys, models and providers are all configured by the user.

Current release version: 0.8.0

GitHub repositories:

- Source: https://github.com/tioners/OpenFicM
- Official Release: https://github.com/tioners/OpenFicM/releases/tag/v0.8.0
- Upstream OpenFic: https://github.com/syrizelink/OpenFic
- Skill/Agent content source: https://github.com/worldwonderer/oh-story-claudecode

The repository was cloned from upstream OpenFic and locally inherits all of upstream's Git tags (v0.2.0 to v0.10.0). Those tags point at syrizelink commits and are not OpenFicM release points. Before tagging a new version, first check whether a tag with the same name is already taken upstream, otherwise the Release will be attached to upstream code as happened with v0.7.3. The v0.7.3 Release page therefore points at upstream commit 7ea4437, although the APK asset itself is correct; that version has been superseded by 0.7.4 and will not be fixed.

## 2. Current delivery status

- Git branch: main
- Latest source commit: the 0.8.0 release commit for this round; take the v0.8.0 tag as authoritative
- Review baseline for this round: e1cc15f fix(ui): stop sheet backdrop from stealing scroll from inner ScrollView
- Release tag: v0.8.0
- Android applicationId: com.openfic.mobile
- versionCode: 15
- versionName: 0.8.0
- Minimum Android: 9.0, minSdk 28
- ABI: arm64-v8a only
- Release APK: OpenFicM-Android-0.8.0.apk in the repository root; both the APK and the keystore are Git-ignored
- Official signing certificate SHA-256: c5dd7c047dc88fdeee64bd4311cddbe7ebc3ba60ea1485670b7543870dddf863 `[upstream legacy — for this fork see README.md]`

0.8.0 keeps using the 0.7.0 official certificate, so it installs straight over the previous version. This version adds notes that belong to a whole work, a volume or a chapter, for storing outlines, plot planning and foreshadowing — content that has not happened in the prose yet. See docs/releases/v0.8.0.md. Recent fixes: 0.7.7 sheet scrolling stolen by a responder (v0.7.7.md), 0.7.6 truncated output misreported as empty content plus retries still hitting the old model after switching models (v0.7.6.md), 0.7.5 multi-round continued distillation (v0.7.5.md), 0.7.4 429 rate limiting and forced delegation (v0.7.4.md).

## 3. Feature list

### Bookshelf and writing

- Local bookshelf: create, delete and open works.
- Volume management: create, rename, delete; at least one volume is always kept.
- Chapter management: grouped by volume; create, rename, delete and switch chapters.
- The writing screen starts in preview mode; the body input appears only after you tap edit.
- Auto-save, background save, manual save and return to preview.
- The keyboard uses resize plus focus scrolling so the bottom editing area is not covered.
- Export the current chapter, the current volume or the whole novel as Markdown; before exporting the draft is saved, the latest data is re-read from SQLite, and the result is handed to the Android share sheet for the user to save or share.

### Assistant and Agent

- Assistant data is isolated per work; after switching works on the bookshelf only that work's sessions and chat history are shown.
- Create, switch and delete sessions; session title, model and per-message Agent trace are recorded.
- The top of the assistant shows the current work, the current main agent and the current model, and lets you switch models.
- If an API or Agent run fails the original user message is kept and can be retried; retrying deletes the failure notice and reuses the original user message instead of inserting a duplicate.
- Historical user messages can be edited; the edit point and everything after it are deleted inside an exclusive SQLite transaction and the Agent re-runs with the new content, keeping the context linear.
- The Agent has tool permissions, structured questions, a live trace, character/world-book/chapter tools and sub-agent delegation; it is not a chat window that only returns text.
- Base Agents/Skills are no longer statically bundled into the APK; first launch pulls them from the OpenFicM GitHub catalog and verifies them, and oh-story and Lorn content is installed on demand behind the runtime resource gate without executing remote scripts or hooks.
- After chapters change, a character and world-book consistency check is triggered and the Agent can update the settings material according to what changed in the writing; the check is a prompt-level suggestion rather than a hard runtime block, and no extra model request is added when nothing changed.
- Whether to delegate to sub-agents is decided by the model per task instead of being forced at runtime. The main agent and all of its sub-agents share a budget of at most 24 model requests per conversation; exceeding it raises an explicit error instead of amplifying rate limits further.

### Settings and models

The main desktop settings categories have been ported to mobile:

- General
- Index
- Context
- Tool permissions
- Rules
- Skills
- Agents
- Advanced

Providers support OpenAI-compatible, Google Gemini and Anthropic style requests. A provider configuration contains Base URL, API key and model name, and can fetch the model list from the provider API. API keys use expo-secure-store; SQLite never stores plain-text keys.

### Style system

- A separate style library supports TXT, Markdown and EPUB, and is compatible with UTF-8, UTF-16 and GB18030/GBK; the original file and the normalised text are stored in the app's private directory.
- Reference style distillation runs in rounds over consecutive windows: each round reads 24 consecutive chapters (books without chapter titles are cut into segments of about 1,400 characters), analysed in 4 batches plus 1 merge, 5 model requests in total; the complete reference book is never uploaded.
- "Keep distilling" jumps forward to a random unread region each time and takes another window; it is monotonically increasing and non-overlapping, and the jump size is bounded both by "half of what remains" and by "4 windows", so it necessarily converges to the end of the book. Coverage progress is stored under `style.distillation.coverage.<sourceId>`.
- Multi-round evidence is combined by incremental evolution: the previous version of the guide is used as the baseline and the new evidence of this round is merged in. Historical memos are not resent in full, so the number of rounds is not limited by context length.
- The breakpoint records which window it belongs to; resuming after an interruption replays the same stretch of prose instead of reusing an old memo to analyse a new window.
- Reference styles are independent of works and can be chosen across works; author styles are isolated per work and keep incrementing versions.
- Both the assistant screen and the writing screen let you choose a writing style; the style is injected into the main agent and the prose-writing sub-agents.
- `write_chapter`/`edit_chapter` save the AI draft and the style in use; after the author actually edits and saves, the current work's author style can be evolved from the preview screen.
- Full user instructions and the privacy description are in `docs/USER_GUIDE.md`; the 0.8.0 release highlights are in `docs/releases/v0.8.0.md`.

### Local retrieval

- The APK contains no Chinese embedding GGUF or reranking GGUF. On first launch they are fetched from Hugging Face into the app's private directory, and the temporary file must pass size and SHA-256 verification before it is installed.
- Once the runtime resources are complete both models are prewarmed automatically; the advanced settings no longer offer manual prewarm/release buttons and only show status plus a one-tap repair entry.
- llama.rn loads the models on the phone's CPU; there is no Hexagon SDK on the device, so current build logs show CPU-only. That is an expected downgrade, not a build failure.
- The APK still contains React Native, llama.rn and the arm64 native libraries the app needs; at the runtime resource level there should be no `.gguf` files, no OpenFicM/Lorn catalog and no static Agent/Skill directories.

## 4. Code structure

Working directory: C:\Users\hujiawei\OpenFic

### mobile-rn

- src/screens/projects-screen.tsx: the bookshelf and work entry point.
- src/screens/writing-screen.tsx: volume/chapter list, preview/edit, save and the Markdown export entry point.
- src/screens/assistant-screen.tsx: per-work assistant sessions, model selection, message editing and retry.
- src/screens/style-library-screen.tsx: reference book import, style distillation, reference/author style versions and the per-work choice.
- src/screens/settings-screen.tsx, settings-category-screen.tsx: settings categories and settings items.
- src/agent/runtime.ts: the Agent main loop, tool calls, structured questions, sub-agent collaboration and trace.
- src/agent/tools.ts: mobile-local tool definitions and execution boundaries.
- src/llm/client.ts: provider requests, response normalisation, output-truncation detection and Gemini schema compatibility. `callModel` supports a `minOutputTokens` option so that steps which structurally must produce long output can raise the budget floor.
- src/settings/app-update.ts: queries the latest GitHub Release of this project and compares it with the version in app.json. `compareVersions` compares numeric segments and does not depend on expo-constants.
- src/data/database.ts: Expo SQLite initialisation, migrations and transactions.
- src/data/repositories.ts: repositories for works, volumes, chapters, characters, world books, sessions, messages, models and settings.
- src/data/style-repositories.ts, chapter-draft-repositories.ts: repositories for reference books/style versions and AI draft snapshots.
- src/data/note-repositories.ts: the notes repository. When both `volume_id`/`chapter_id` are empty it is a whole-work note, a volume alone makes it a volume-level note, and a chapter makes it a chapter-level note; `resolveTarget` looks the owning volume back up from the chapter so ownership cannot drift.
- src/screens/notes-screen.tsx: the notes screen grouped by whole work / each volume / each chapter, supporting creation at any level and moving between levels.
- src/lib/export.ts: Markdown export; filename sanitising, range filtering, cache files and the system share sheet.
- src/search: local full-text, embedding and reranking indexes.
- src/settings: default settings, runtime Agent/Skill resource installation, the Lorn style plugin and oh-story content updates.
- src/style/source-library.ts: safe import of TXT/Markdown/EPUB, encoding detection, body normalisation, and chapter/paragraph unit splitting plus window sampling.
- src/style/sampling.ts: pure sampling logic (`nextSampleWindow`, `spreadIndices`). It depends on neither expo nor the database, so it can be transpiled on its own with `npx tsc --ignoreConfig` and replayed in Node to trace the window progression.
- src/components/ui.tsx: shared UI controls. Bottom sheets must always be wrapped in `SheetBackdrop`; do not go back to "a Pressable wrapping the whole sheet plus onStartShouldSetResponder on the content", because that steals the JS responder and blocks the inner ScrollView.
- src/components: shared mobile UI, error notices, Agent trace and input controls.
- assets/models: runtime model sources, licences and hash documentation; large GGUF files must not be tracked by Git.
- android/app/build.gradle: Android versions, signing environment variables and Release configuration.
- scripts/build-release.ps1: cleans old app build output, rejects bundled GGUF, performs official signing, version naming, optional lineage signing and SHA-256 output.

### Retained upstream directories

backend, frontend and desktop are retained upstream OpenFic sources and compatibility fixes; the mobile app does not depend on them at runtime. Unless the user explicitly asks for a desktop fix, do not spread mobile feature changes into the upstream directories.

## 5. Key design decisions

1. Local first: works, chapters, characters, world books, indexes and conversations live on the phone by default; only when the user starts a model request is the necessary context sent to the external provider.
2. Per-work sessions: chat_sessions.project_id is the chat isolation boundary; the assistant must not see another book's history just because the work was switched.
3. Linear message editing: editing a historical message deletes that message and everything after it, so that Agent branch context that no longer holds is not kept.
4. Recoverable Agent: a failed message is stored on the assistant side as an unfinished-task record, and RetryRequest stores the original message and the history snapshot inside the screen; retrying does not produce a duplicate user row.
5. Preview first: phone touch screens are easy to hit by accident, so a chapter opens in preview and the input controls appear only after you tap edit.
6. Share-sheet export: exported files are written into the Expo cache, no external storage permission is requested, and Android's share sheet or file manager decides the final location.
7. Gemini schema: every parameter of a function declaration must have a type; on the React Native side missing types are filled in recursively and unsupported additionalProperties are stripped, fixing the 400 caused by chapter_ref; a tool turn must also carry the Gemini thoughtSignature back unchanged.
10. Output truncation is never silently downgraded: a thinking model's reasoning tokens also count against max_tokens, so the prose may come back completely empty. All three provider branches check the truncation state and throw an actionable error instead of letting the caller see only 'the content is empty'.
11. Retries use the currently selected model: the modelId recorded on the failed message is only a fallback, otherwise switching to a working model would still hit the old broken one.
12. The app version is read from app.json and no expo-constants runtime dependency is added; that file is the same configuration used when building the APK.
8. Supply-chain limits: the OpenFicM base catalog and the Lorn mobile catalogue are pinned to immutable commit 1a848fbe77f9952c38aac8c18240026154446114 and verified by SHA-256; oh-story reads Markdown only from an allowlist and is pinned to Release commit/tree/blob SHAs, and remote hooks, scripts and Git configuration are never executed.
9. Style boundaries: reference books are global local material, reference styles can cross works, and author styles belong to a single work only; distillation sends only bounded samples to the user's provider and never uploads the complete original file.

## 6. Build and verification

### Normal development checks

In the mobile-rn directory:

~~~powershell
npm ci
npm run type-check
~~~

type-check currently passes. This round of mobile work added no automated UI tests; when continuing development, prioritise tests for repository transactions and pure export functions, and do not push tests into a page-snapshot system that has no existing test foundation.

### Official build

The official signing files are not in the repository:

- C:\Users\hujiawei\.android\OpenFicM-release.p12
- C:\Users\hujiawei\.android\OpenFicM-release-credential.xml

credential.xml is a local credential serialisation file that only the current Windows user can decrypt. Do not read its password and print it, and do not commit the p12, credential.xml, debug.keystore or APKs.

Safe build procedure:

~~~powershell
cd C:\Users\hujiawei\OpenFic\mobile-rn
$credential = Import-Clixml "$HOME\.android\OpenFicM-release-credential.xml"
$password = $credential.GetNetworkCredential().Password
$env:NODE_ENV = "production"
$env:OPENFICM_RELEASE_STORE_FILE = "$HOME\.android\OpenFicM-release.p12"
$env:OPENFICM_RELEASE_STORE_PASSWORD = $password
$env:OPENFICM_RELEASE_KEY_ALIAS = $credential.UserName
$env:OPENFICM_RELEASE_KEY_PASSWORD = $password
powershell -ExecutionPolicy Bypass -File .\scripts\build-release.ps1
~~~

The script first deletes the generated android/app/build directory inside the repository, which is protected by a path check, so that an incremental build cannot reuse old resources; after producing the APK it also rejects any .gguf entry. On success it writes OpenFicM-Android-0.8.0.apk into the repository root and prints the SHA-256. Without the four OPENFICM_RELEASE_* variables, app/build.gradle refuses to run assembleRelease; that is a deliberate safeguard against publishing with a debug certificate. If you have no official key, only run npm run android:apk:debug and label the result clearly as a local test build.

### Verification already completed

- npm run type-check: passes.
- Sampling algorithm verification: `src/style/sampling.ts` was transpiled with `npx tsc --ignoreConfig` and 1000 random full runs were executed in Node, confirming that windows never overlap, never go backwards and always converge to the end of the book; for a 1200-chapter book the sequence goes chapters 1-24, 100-123, 180-203, 293-316, ... about 17 rounds in total.
- Gradle assembleRelease: BUILD SUCCESSFUL.
- Official signing by the release script: succeeded. The Get-FileHash at the end of the script throws CommandNotFoundException when PowerShell is invoked nested from Git Bash, because PSModulePath is lost; the APK itself has already been produced and signed, so just use sha256sum or re-run inside a native PowerShell session.
- apksigner verify --verbose: Verifies, v2 signing scheme passes, official certificate c5dd7c047dc88fdeee64bd4311cddbe7ebc3ba60ea1485670b7543870dddf863. `[upstream legacy - for this fork see README.md; the whole 0.8.0 build in section 2 was produced by upstream]`
- aapt2: package com.openfic.mobile, versionCode 15, versionName 0.8.0, minSdk 28, targetSdk 36.
- APK ZIP: 1220 entries, an embedded index.android.bundle, arm64-v8a only; no GGUF, no OpenFicM/Lorn catalog and no Agent/Skill directories.
- APK size: 132,543,620 bytes (126.40 MiB).
- APK SHA-256: CD7BE582655CC6A9D732BA0B186228A7EFF3513771AABF135AF9F5CC666A7486. `[upstream legacy - the APK this fork publishes is signed with a different certificate; see README.md]`
- On-device verification (Redmi 25102RKBEC, upgraded in place from 0.7.7): install succeeded, data was kept, no FATAL on launch; the notes screen renders its three levels correctly, creating a whole-work note works, and moving across levels (whole work to chapter) works with the grouping updating immediately.
- On-device verification (0.7.6 features): the app-version check under advanced settings works and correctly reported 'already up to date' after seeing remote v0.7.5 and local 0.7.6 instead of a false update; the model-list 'find model' filter works (typing grok narrowed 5 entries to 2, counter shows 2/5); the reference book detail screen shows the current default model name correctly.
- On-device verification (distillation pipeline): Battle Through the Heavens (5.4 million characters) completed 4/4 batch analyses, a resumed run correctly continued with its window without restarting from the beginning, and the batch label showed real chapter numbers. The merge step still does not complete, but the failure mode changed from the false 'the style guide returned by the model must not be empty' to an accurate HTTP-level error, which shows the truncation misjudgement really was fixed.
- On-device verification not finished: one fully successful distillation run, including merging into the database and advancing the 'keep distilling' round. Both relay services failed at the merge step: the public relay hit a 429 rate limit, and openrouter's stealth/ox-alpha returned HTTP 200 with a non-JSON body. Both are server-side behaviours rather than app defects; the response-body excerpt added in 0.7.6 lets you see exactly what the relay returned the next time it reproduces.
- npm audit: reports a high-severity DoS in image-size in the Metro build chain and a moderate issue in uuid in the Xcode build chain; neither enters the APK, and image-size had no upstream fix as of 2026-08-20. Do not run npm audit fix --force, which would downgrade Expo 57 to 53; wait for an upstream Expo/Metro upgrade.

This round did not re-run expo-doctor, the 0.7.1 catalog download verification or the verify-change/quality/security checks; the changes only touched style sampling, the distillation flow, the style library UI and documentation, and did not touch supply-chain constants or native dependencies.

## 7. Release process

Pushing source:

~~~powershell
$env:http_proxy = "http://127.0.0.1:10808"
$env:https_proxy = "http://127.0.0.1:10808"
git push origin main
~~~

Official Releases use the GitHub CLI:

~~~powershell
gh release create v0.8.0 .\OpenFicM-Android-0.8.0.apk --repo tioners/OpenFicM --target main --title "OpenFicM 0.8.0" --notes-file docs/releases/v0.8.0.md --latest
~~~

`[upstream legacy - the `--repo` above points at the upstream repository. This fork publishes to `beiqiongyinhe/better-openficm`, so replace it with `--repo beiqiongyinhe/better-openficm` when cutting a release here.]`

Do not add APKs or signing files to Git. Before publishing, inspect the assets with apksigner, aapt2 and Get-FileHash; after publishing, verify the tag and assets with gh release view v0.8.0 and gh release list.

## 8. Known limitations and follow-up priorities

- Style distillation has been run through a complete round by the user on a real device: mint relay plus grok-4.6, Battle Through the Heavens (5.4 million characters, 1646 chapters detected), generating reference style V1, with the UI correctly switching to 'keep distilling' and showing 'covered up to chapter 24/1646'.
- Distillation is demanding on providers and it is easy to run into trouble when switching relays or models. A single request is about 20,600 characters: the Lorn methodology takes 12,000 (`STYLE_MODEL_INSTRUCTION_CHARACTERS`) and the samples take 8,400 (`ANALYSIS_BATCH_SIZE` 6 x `ANALYSIS_PASSAGE_CHARACTERS` 1,400), roughly 15K-20K tokens in Chinese, 5-7 times a normal chat request, so relays billed by TPM rate-limit easily. Measured: the public relay succeeds on small requests but returns 429 immediately on a distillation request; openrouter's stealth/ox-alpha returns HTTP 200 with a non-JSON body at the merge step.
- The methodology text is resent four times across the four batches of one round, about 48,000 characters in total. To reduce the size of a single request you can lower `STYLE_MODEL_INSTRUCTION_CHARACTERS` or `ANALYSIS_BATCH_SIZE`, but those affect methodology fidelity and the number of requests per round respectively, so it is a trade-off the user has to sign off on; nothing has been changed yet.
- The context window is unrelated to the distillation problem, so do not conflate them: a 429 is a TPM rate limit (throughput per minute) and truncation is the output token cap; neither is relieved by a larger context window. There is no context-window setting in the app, only `context.historyLimit` (number of messages) and `MAX_TOOL_TEXT_CHARACTERS` (characters returned by a tool). The only real use for a 1M context would be a larger sample count per batch, but that makes each request bigger and backfires on relays with strict rate limits.
- The 0.7.4 APK was only verified on a real device on the assistant side; whether complex writing tasks still trigger 429 and whether the consistency check reports its state truthfully still needs testing on a Realme GT7 and a Redmi K90 PRO MAX, along with long-term writing, upgrades, share exports and local model memory behaviour.
- The 24 model request budget is an upper bound estimated as 12 rounds for the main agent plus 12 rounds for one layer of sub-agents. If normal tasks frequently hit that ceiling in testing, first check whether the model is stuck in a tool-calling loop, and only then consider adjusting MAX_TOTAL_MODEL_REQUESTS; do not simply enlarge the budget.
- CPU-only is a build result of the current environment; flagship phones are fast enough, but the first load of the GGUF may still take time and a fair amount of memory.
- Retries are now supported when the API is unreachable, but there is no offline substitute for cloud model answers; local editing of works and local retrieval still work.
- Releases are arm64-v8a only; do not add extra ABIs for older 32-bit devices unless the size cost of the two GGUF files is re-evaluated.
- Remote oh-story updates must always be triggered by the user; never execute remote hooks automatically and never treat remote Markdown as executable code.
- Android's system share capability depends on the device ROM; exported files are written to the cache, and the user should pick a file manager or target app in the share sheet.
- When changing the Agent further you must confirm that tool permissions, the ask flow, trace, failure recovery and character/world-book consistency all still work; do not add mere UI mock controls.

## 9. Steps for taking over in a new window

1. Read this file, README.md, mobile-rn/DESIGN.md and the recent git log. (The Chinese original also lists a root AGENTS.md, which does not exist in this repository; see the translation note above.)
2. Run git status --short --branch to check whether the remote has new commits; do not reset --hard or overwrite the user's uncommitted changes.
3. Find the UI entry point under mobile-rn/src/screens, then follow the call chain through repositories, agent/runtime, agent/tools and llm/client.
4. Before changing anything, search the existing repositories and components and reuse them; do not copy SQLite or model-request logic into a screen.
5. After changing anything, at minimum run npm run type-check and git diff --check; for anything release-related also run the official build and verify the APK.
6. Before releasing, confirm that git status is clean, that APKs and keys are ignored, and that the version number agrees across CHANGELOG/README/DESIGN.

## 10. Things not to do

- Do not bring back Socket.IO, FastAPI or a PC backend dependency; the mobile app is positioned as local-first.
- Do not hard-code any API key, signing password, GitHub token or proxy credential.
- Do not sign a release build with debug.keystore, and do not put a private key into the repository or a Release asset.
- Do not rewrite the database, the Agent runtime or the whole navigation architecture just to fix a single UI problem.
- Do not delete the user's existing uncommitted changes or local data; deleting volumes, chapters, chat history and exported files must always follow an explicit user action.
