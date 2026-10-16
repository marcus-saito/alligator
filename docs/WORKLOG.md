# Alligator worklog

## 2026-10-16 — Session safety and WebSocket authentication

- Baseline: `fc4e16401931db164d41359d50d4374b03c92d60`, branch
  `codex/session-safety-and-soniox-auth`. The initial review changed no files.
- Authorized scope: fix cancellation after Stop, partial audio-startup cleanup,
  and rendering during speaker rename; add focused dependency-free regression
  checks; then migrate Soniox browser WebSocket authentication. No push or deploy.
- Files touched: `public/app.js`, `tests/app.test.js`, `package.json`, `README.md`,
  and `docs/WORKLOG.md`.
- Implementation commit: `33c6d4642334c25f700bd50096d564b69b121226`.
  This worklog is saved in the following documentation commit; use
  `git log -- docs/WORKLOG.md` to identify it. Both commits are local only.
- Decisions: retain vanilla JavaScript and static hosting. Use Node's built-in
  test runner with synthetic media, sockets, and transcript text; never load `.env`
  or contact Soniox in regression checks. Keep capture cleanup local to the capture
  function, and guard asynchronous continuations and controller ownership.
- Provider guidance checked on 2026-10-16:
  <https://soniox.com/docs/guides/websocket-authentication> and
  <https://soniox.com/docs/guides/migrate-websocket-authentication>.
  Browser connections must pass `["soniox-api-key", key]` as subprotocols and omit
  `api_key` from the start message. Legacy message authentication ends January 15,
  2027. Authentication errors still arrive as JSON frames after the socket opens.
  New temporary keys use `snx_temp_`; legacy `temp:` keys cannot be subprotocols.
- Existing user-key exchange, direct-key fallback on HTTP 403, server-key fallback,
  endpoints, stream configuration, pause billing, and privacy boundaries stay intact.
- Session fixes implemented: abort capture on Stop, close partially acquired
  resources on rejection and late permission resolution, guard connection/reconnect
  continuations, settle cancelled socket handshakes, make teardown idempotent, and
  bind controller callbacks/errors to the session that owns them. Speaker rendering
  locates named elements rather than assuming child positions while an editor exists.
- Regression checks: all 29 checks pass using `npm test` on Node
  24.15.0. They cover both transcript views and Enter/Escape/blur, four capture failure
  stages, late permission results, cancellation at startup/key/socket/reconnect stages,
  normal pause/resume/final flush, stale controller errors, retired-socket messages,
  cancellation during worklet loading/context resume, and missing shared audio.
  Authentication checks exercise the real key-selection functions for temporary,
  HTTP 403 direct, and server keys, including fresh keys on reconnect, no key in the
  configuration message, and fatal authentication frames after socket open.
- Baseline evidence: ran the same 29 checks against `git show fc4e164:public/app.js`
  via `ALLIGATOR_TEST_APP` pointing at a temporary file. Results: 3 passed, 24 failed,
  and 2 timed out (unsettled pre-open/key-cancellation paths). Each check has a 1.5 s
  timeout so the original hanging startup paths cannot stall the suite. The normal
  pause/resume/flush, fatal authentication-frame, and no-shared-audio controls pass
  on the baseline. No baseline or mutation files were added to the repository.
- Static checks: `node --check public/app.js`, `node --check tests/app.test.js`,
  and `git diff --check` passed.
- Browser verification: actual Chrome via the CUA Chrome extension against a
  loopback-only Python static server at `http://127.0.0.1:5174/#demo`; no `.env`
  loading, microphone permissions, or Soniox requests. Checked light/dark themes,
  split/stacked views at desktop and 390 x 844, and completed the five-turn demo.
  In both split and stacked views, held a speaker editor open while subsequent
  tokens arrived, then saved the name and confirmed rendering continued. Opened
  Document Picture-in-Picture, confirmed the stacked pane left the main document,
  and restored it with Bring it back. Chrome reported no captured application
  warnings/errors. View/theme changes are asynchronous; wait for their applied
  state and transition before issuing another UI action. Temporary viewport and
  initial Auto/split preferences were restored; preview resources were cleaned up.
- Alternatives: no framework, SDK, build step, exported production test API, or new
  privacy/storage behavior. Tests evaluate bounded sections of the actual app in
  isolated Node VM contexts; missing section boundaries fail explicitly. Browser
  checks complement the synthetic DOM/media/socket checks.
- Open items outside this pass: translation matching heuristic, keyboard access to
  session-locked preferences, optional server access controls, and real-session
  qualification. Real microphone/Soniox tests require the owner's testing; no
  credentials or real transcripts will be used by automated checks.
- Additional observation: at 390 px in idle split/room mode, Save transcript can
  overlap the source selector in the header. Those existing markup/CSS rules were
  not modified in this pass.
- Unverified: live authentication acceptance with credited real keys, actual media
  permission/capture behavior on Chrome/Edge and macOS meeting tabs, live pause/stop
  inside Picture-in-Picture, offline installation, and Node 20 execution (checks ran
  on Node 24.15.0). Browser demo proves rendering, not provider or capture success.
  A future real-session check should confirm the subprotocols in the connection
  request and absence of `api_key` from the start frame without sharing key values.
- No invariants changed. No new runtime dependencies, build step, tracking,
  transcript persistence, or external destinations; no push, deploy, DNS, hosting,
  repository-setting changes, or credential use. `docs/HANDOFF.md` remains deferred
  until the owner requests wrap-up.

## 2026-10-16 — Owner-run live Chrome verification

- Marcus tested the local branch with his own Soniox key and microphone in Chrome.
  These results are owner-reported in this chat; the assistant did not inspect the
  key, capture real transcript content, or independently inspect network frames.
- Passed: live authentication produced speech and translation; pause excluded a
  sentence spoken while paused; resume continued with earlier transcript intact.
- Passed: speaker rename in both split and stacked views while text continued
  arriving; Enter saved and Escape cancelled the change.
- Passed: owner reports the pop-out works well. Stop from both the main window
  and pop-out ended capture cleanly; starting again worked and preserved the earlier
  transcript. No additional claim is made about each pop-out control individually.
- This resolves the earlier unverified live authentication, microphone, pause/resume,
  rename, and Stop/restart items for the owner's tested Chrome environment. Meeting
  tab capture, Edge, network reconnect under live failure, inspecting authentication
  headers/frames, offline installation, and Node 20 remain unverified.
- Files touched: `docs/WORKLOG.md` only. Verification: reconciled the explicit owner
  reports above with the prior implementation record; no provider calls or new tests
  were needed for this documentation-only change. No invariants changed.
- Commit: `c49e944` records these results separately before font-sizing work.
  No push or deploy authorized or performed.

## 2026-10-16 — Transcript font sizes

- Owner approved Small, Medium, and Large in Options, with today's transcript sizes
  preserved exactly as Large and as the default. Smaller choices should apply to
  both views and the pop-out, persist as a setting, and leave controls readable.
- Files touched: `public/index.html`, `public/app.js`, `public/styles.css`, `README.md`,
  and this log. Added the existing segmented-radio pattern to Options. Large uses
  the original responsive sizes; Medium is 90% and Small is 80% of those sizes.
  The scale affects transcript sentences only; controls, speaker labels, and
  language tags keep their existing sizes. This avoids shrinking click targets.
- The setting persists under `alligator.textSize`, defaults to Large, validates
  stored choices, and is copied into the Document Picture-in-Picture window.
  Reused CSS variables rather than page zoom or separate per-view size tables, so
  desktop, phone, and pop-out retain their original relative sizing.
- Implementation commit: `437d9772e11579b52aa1f425ec35617f157e729e`.
  All 29 regression checks, JavaScript syntax, and diff whitespace checks pass.
- Actual Chrome checks used only synthetic demo text and covered both themes and
  views, desktop and 390 x 844, click and arrow-key selection, persistence across
  reload, and visual size changes in an already-open Document Picture-in-Picture
  window. The pane returned correctly after closing the pop-out; no captured
  application warnings/errors appeared. The temporary viewport was reset.
- Settled computed desktop sizes (history/latest): Large 20.91/32.759 px,
  Medium 18.819/29.4831 px, Small 16.728/26.2072 px. Large exactly matches the
  original formulas at this viewport. The Options button remained 36 px at every
  size. At phone width, latest text measured 19.2 px for Small and 21.6 px for Medium.
- No new automated tests were added for this reversible visual preference;
  browser interaction/computed-style checks verify the actual CSS and existing
  regression checks protect the session/transcript behavior.
- Preview observation: the existing local origin initially mixed fresh JavaScript
  with stale HTML/CSS. A reload refreshed the markup but not the old stylesheet in
  this run. Continued verification on a separate loopback origin (port 5184), where
  the new CSS scale was present. No cache deletion or user-key changes were made.
- Preview remains available at `http://127.0.0.1:5184/#demo`, with Large selected.
  This is a separate origin without the owner's saved key. The original live-test
  tab was not reloaded or closed. Live Soniox sessions with the new size preference
  were not retested; changes affect rendering and settings only.
- No changed invariants, additional dependencies, credential use, push, or deploy.
  Original remaining review findings and the pre-existing phone header overlap are
  unchanged. This log update is committed after the implementation commit.

## 2026-10-16 — Delayed translation matching

- Owner approved retaining best-effort speaker/turn matching, including possible
  mistakes, rather than introducing separate unconfirmed-translation lines.
- Provider guidance checked: <https://soniox.com/docs/translation/stt-translation>
  and <https://soniox.com/docs/api-reference/stt/websocket-api>. Translation tokens
  have no audio timestamps or source-turn identifiers; speaker is optional. Their
  sequence is useful, but source/translation chunks are not one-to-one aligned.
- Implemented: inspect all eligible source turns in the current stream instead of
  only four; retain speaker preference and monotonic progress; estimate completion
  from all source sentences, including a trailing fragment. The same estimate keeps
  long monologues from splitting before their multi-sentence translation catches up.
  Final matching uses committed text only; provisional routing uses its replaceable
  layer. Untranslated (`none`) turns cannot consume a translation.
- Sentence segmentation uses the browser's built-in locale-aware Intl.Segmenter,
  with a punctuation fallback if unavailable; no dependency or provider call added.
  This is a heuristic: translation can merge/split sentences, speaker metadata can
  be missing/unmatched, and attribution may still be wrong in those cases. Unknown
  speaker metadata retains the existing language-based fallback at the owner's
  request. No definitive alignment or new privacy promise is implied.
- Files touched: `public/app.js`, `tests/app.test.js`, `README.md`, this log.
- Implementation commit: `54f00592ed483ea19505d75adffe74c986748511`.
  Worklog committed in the following documentation commit. Both stay local.
- Verification: all 45 checks pass (29 existing, 16 focused additions). Added cases
  cover a seven-turn backlog with and without speaker metadata, delayed second
  sentences, trailing source fragments, repeated speakers, provisional replacement
  and finalization, bidirectional queues, reconnect isolation, Japanese sentence
  endings, decimal punctuation, monologue splits, monotonic progress, the fallback
  without Intl.Segmenter, exclusion of untranslated turns, and the owner-approved
  unmatched-speaker fallback. Assertions include both rendered views and export.
- Baseline: the same tests against `621879e:public/app.js` yield 34 passes and 11
  failures. Focused mutations restore single-sentence completion (8 failures),
  restore the four-turn cap (2 failures), or remove epoch isolation (1 failure).
  Baseline/mutation files and output stayed in temporary storage, outside Git.
- `node --check` for app and tests, plus `git diff --check`, passed. Tests used
  Node 24.15.0; Node 20 was not requalified.
- Chrome smoke: fresh loopback-only static preview on port 5194, CUA Chrome extension,
  `/#demo`, no keys or microphone. All five final source/translation pairs matched
  the scripted English/Spanish conversation; split and stacked views rendered,
  with no captured application warnings/errors. The temporary tab/server were closed;
  existing owner live-test and font-preview resources were left alone.
- Not verified with new real audio/provider traffic. Sentence-count mismatches,
  abbreviations, and absent/unmatched speaker metadata remain sources of best-effort
  attribution error. No change to endpoint detection, diarization, finalization,
  authentication, privacy/storage, dependencies, or deployment behavior. No new
  unconfirmed-translation UI was introduced. No push or deploy.
