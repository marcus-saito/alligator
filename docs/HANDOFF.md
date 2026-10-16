# Alligator handoff to the original Claude session

Prepared October 16, 2026 (Asia/Tokyo). Owner: Marcus.

## Current state and release boundary

- Repository: <https://github.com/marcus-saito/alligator>; local checkout:
  `/Users/marcus/Code/github/alligator`.
- Baseline for this handoff: `fc4e16401931db164d41359d50d4374b03c92d60`.
- All application changes described below are on `main` and deployed at
  <https://alligator.chat>, at `f37816acbe07fd765385208b100693cfb1994b11`.
- [GitHub Pages run 38858835902](https://github.com/marcus-saito/alligator/actions/runs/38858835902)
  completed successfully. Afterward, public `index.html`, `app.js`, `styles.css`,
  `pcm-worklet.js`, and `sw.js` each returned HTTP 200 and matched the local release
  byte-for-byte by SHA-256. This establishes deployed assets, not a new live audio test.
- The initial no-push/no-deploy restriction was explicitly lifted by Marcus for
  that release. It was a normal fast-forward and push, with no force push or changes
  to DNS, GitHub Pages settings, repository settings, or the deployment workflow.
- This handoff and the final worklog update are a subsequent **local-only,
  documentation-only commit**. They have not been pushed and do not change the live
  app. Resolve their hash with `git log -1 --format=%H -- docs/HANDOFF.md`; Marcus
  receives it in the wrap-up reply. Do not assume release permission is standing
  permission to deploy future work; obtain Marcus's explicit OK for another push.
- The implementation branch `codex/session-safety-and-soniox-auth` was retained.
  Read `docs/WORKLOG.md` for chronological evidence; earlier statements such as
  "local only" or "unverified" describe the stage at which those entries were made.
  Later live-test and release entries supersede them.

## Everything changed since fc4e164

### 1. Session cancellation and cleanup

`public/app.js`: `openAudio`, `Session`, and the main `start` controller.

- Capture now accepts an abort signal and owns cleanup for every partially acquired
  resource: display tracks, microphone tracks, worklet messages, and AudioContext.
  Failure during microphone permission, worklet loading/construction, or context
  resume releases what was already acquired.
- Stop aborts capture immediately. A stream returned after Stop while a permission
  prompt was pending is closed when the promise resolves. Browser permission prompts
  themselves cannot be cancelled through this code.
- Guards before/after key acquisition, during socket opening, and after reconnect
  delays prevent stopped sessions from reopening a connection or reporting Live.
- A socket closed before opening now settles startup rather than leaving its
  promise pending. Teardown is idempotent. Retired sockets cannot append tokens;
  stopped sessions cannot update microphone levels.
- Controller callbacks and error handling are bound to the session that owns them.
  An old startup failure cannot tear down a newer session.
- Existing pause semantics and final Stop flush remain: approximately 300 ms silence,
  finalize, 10 s keepalives while paused; empty text frame on Stop, with up to 4 s
  waiting for `finished`. Soniox still bills while paused.

### 2. Speaker rename rendering

`public/app.js`: split and stacked renderers now locate `.who`, `.line`, `.src`,
and `.dst` by selector rather than fixed child positions. The inline rename input
is inserted among those children; incoming tokens previously caused rendering to
interpret that input as a transcript line and throw. Enter/save and Escape/cancel
behavior is preserved, including updates to earlier turns with the same speaker
identity. Identities remain scoped to a stream epoch.

### 3. Soniox WebSocket authentication migration

`public/app.js`: the browser opens its WebSocket with
`["soniox-api-key", apiKey]` as connection subprotocols. The first JSON configuration
message no longer contains `api_key`.

- This follows Soniox's migration before its January 15, 2027 cutoff for keys sent
  only in the first message. No SDK or dependency was introduced.
- Endpoints, `stt-rt-v5`, PCM format, language hints, two-way translation, diarization,
  endpoint detection, and session timing were preserved.
- Key selection is unchanged: exchange a user-supplied key for a 60 s single-use
  temporary key; retain the existing direct-user-key fallback on HTTP 403; otherwise
  use the optional server's temporary-key endpoint. Server code was not modified.
- Authentication errors arrive as frames after socket open and remain handled by
  the existing fatal-error path. Open alone is not proof of successful authentication.
- Current temporary keys use `snx_temp_`. Soniox says older `temp:` credentials are
  not valid browser subprotocol entries; no legacy message-authentication fallback
  was added. The application mints a new key per connection/reconnect.

Provider references checked during this work:

- <https://soniox.com/docs/guides/websocket-authentication>
- <https://soniox.com/docs/guides/migrate-websocket-authentication>
- <https://soniox.com/docs/guides/temporary-api-keys>

### 4. Transcript font sizes

`public/index.html`, `public/app.js`, `public/styles.css`, and README.

- Options now has a Transcript size radio group: Small, Medium, Large.
- Marcus explicitly chose the original responsive font sizes as **Large**, which
  remains the default and maximum. Medium is 90%; Small is 80%.
- Applies to transcript sentences in both views and the pop-out. Controls, speaker
  labels, and language tags retain their sizes; click targets are not scaled down.
- Stored as `alligator.textSize`; invalid stored choices fall back to Large.
  `syncPip` copies the setting to the Picture-in-Picture document.
- Uses `--transcript-scale` over the original desktop, phone, and pop-out formulas.
  No page zoom, build step, dependency, or new external resource was introduced.

### 5. Best-effort delayed translation matching

`public/app.js`: `sentenceCount`, `translationCaughtUp`, `translationTarget`, and
long-monologue splitting; README explains the remaining limitation.

- Removed the four-source-turn search cap. All eligible `original` source turns in
  the current stream epoch can be considered; `none`/untranslated turns are excluded.
- Speaker metadata still takes priority when it matches a candidate. Otherwise the
  existing source-language fallback remains.
- Completion estimates account for the whole source turn, including multiple
  sentences and a trailing fragment. One translated full stop no longer declares
  a multi-sentence source complete. The estimate also prevents premature splitting
  of a long source turn whose translation has not caught up.
- Uses built-in locale-aware `Intl.Segmenter`, with a punctuation fallback when
  unavailable. Final matching uses committed text; provisional routing includes
  only the current replaceable draft layer. Retains forward progress once a later
  candidate's translation has begun, while respecting speaker-based selection.
- **This remains a heuristic.** Soniox translation tokens have no timestamps or
  source-turn IDs; speaker is optional, and translation can combine/split sentences.
  Abbreviations and absent/unmatched speaker metadata can still cause misattribution.
- Marcus explicitly selected continued best-effort matching, including possible
  mistakes, over adding separate "speaker unconfirmed" translation lines. Do not
  present this implementation as exact alignment or silently reverse that choice.

Provider references:
<https://soniox.com/docs/translation/stt-translation> and
<https://soniox.com/docs/api-reference/stt/websocket-api>.

### 6. Regression checks and documentation

- Added `tests/app.test.js` and `npm test` using Node's built-in test runner and VM.
  No dependencies. Tests use the actual bounded sections of the browser source with
  synthetic DOM, media, sockets, keys, and transcript text. They do not load `.env`,
  capture audio, contact Soniox, or store real conversations.
- VM section boundaries intentionally fail if app sections are reorganized; update
  the harness when moving them. These checks complement actual browser tests and
  are not a full browser/media/provider simulation.
- Each test has a 1.5 s timeout to catch startup promises that never settle.
- `ALLIGATOR_TEST_APP=/path/to/app.js npm test` runs the same suite against a baseline
  or mutation. Temporary baseline/mutation sources are not committed.
- Updated README with authentication migration, transcript sizes, matching caveats,
  and regression-check instructions. Added `docs/WORKLOG.md` and this handoff.
- No changes to `server.js`, worklet DSP, service worker, manifest, fonts/licenses,
  icons, or deployment workflow. Total changed paths are README, package.json,
  app.js, index.html, styles.css, the tests, WORKLOG, and HANDOFF.

## Verification and its limits

### Automated/local evidence

- Latest release gate: **45/45 tests passed** on Node **24.15.0**; Node 20 was not
  requalified. JavaScript syntax checks and `git diff --check` passed.
- Initial 29 tests: baseline `fc4e164` had 3 passes, 24 failures, 2 timeouts;
  the fixed implementation passed all 29.
- Translation-matching additions: 16 focused tests, for a total of 45. Against
  `621879e`, 34 passed and 11 failed. Mutations restoring first-sentence completion,
  the four-turn cap, or cross-epoch matching caused 8, 2, and 1 failures respectively.
- Coverage includes capture failure/cancellation stages, late startup/reconnect
  continuations, stale controller errors, key-selection/authentication paths,
  normal pause/resume/Stop flush, rename during incoming tokens in both views,
  multi-sentence and seven-turn translation backlogs, draft replacement, repeated
  speakers, bidirectional matching, Japanese sentence boundaries, decimals, stream
  isolation, monologue splitting, and rendered/exported text.

### Actual Chrome checks by the assistant

- Used the CUA Chrome extension against loopback-only Python static servers.
  Synthetic `/#demo` only; no owner key, real microphone, or Soniox traffic.
- Checked both themes/views, desktop and 390 x 844, live demo rendering during rename,
  font controls including arrow keys, persistence, pop-out transfer/restoration,
  and size changes in an already-open pop-out. No captured application warnings/errors.
- Verified all five final source/translation pairs in the demo after matching changes.
- Large matched the original desktop formulas: history/latest 20.91/32.759 px at the
  tested viewport. Medium: 18.819/29.4831; Small: 16.728/26.2072. Options button stayed
  36 px. At phone width, latest Small/Medium measured 19.2/21.6 px.
- Local origin initially served mixed fresh JS and stale HTML/CSS. Reload refreshed
  markup but did not resolve the old stylesheet in that run; a fresh port did.
  No user cache or key was deleted. View/theme transitions are asynchronous; allow
  them to settle before the next interaction or computed-size measurement.

### Owner-reported live Chrome results

Marcus entered his own Soniox key directly into the local app and reported:

- Authentication worked; actual speech and translation appeared.
- Pause excluded a sentence spoken while paused; resume preserved prior transcript.
- Rename worked in both views while text arrived; Enter saved, Escape cancelled.
- Pop-out worked well. Both main-window and pop-out Stop ended capture cleanly.
  Starting another session worked and kept earlier transcript.

These are explicit owner reports, not independently inspected wire evidence. They
preceded the font/matching changes. Marcus later approved the font sizes visually;
**the new translation matcher has not had a new real-audio/provider test**.
No real transcript or key was copied into Git or this documentation.

## Invariants and decisions to preserve

No existing privacy or architecture invariant was changed:

- No accounts, tracking, transcript database/persistence, external fonts, or added
  third-party destinations. Audio goes from browser directly to Soniox. User keys
  and settings stay in browser localStorage; saving a transcript is user-triggered.
  The new text-size preference is a setting, within the existing storage promise.
- Static `public/` remains dependency-free with no build. Keep app resource/API paths
  relative for domain/sub-path hosting. The optional Node server remains optional.
- Never commit `.env`, credentials, or real transcripts. Preserve ignored `.claude/`,
  `linkedin/`, and `handoff/`; the last two are excluded via local `.git/info/exclude`.
- Keep graceful browser fallbacks, the minimal interface, light/dark themes and
  phone layout. Do not confuse pop-out capability with desktop meeting-app audio
  capture support; macOS testing here did not qualify the latter.
- Final tokens append once, drafts replace, earlier completed transcript survives
  reconnect/restart, and speaker identities/names remain scoped to each stream.
- Any later privacy-impacting change needs Marcus's approval and consistent wording.
  Do not touch DNS, hosting/repository settings, or deploy without his explicit OK.

## Remaining issues and suggested next steps

1. **Medium: keyboard session locking.** `public/styles.css:282` disables pointer
   interaction with language/source controls during a session, but does not disable
   keyboard use. A keyboard change can update displayed preferences while the active
   session retains its old configuration. Next fix: enforce state in handlers and
   actual disabled controls, then test keyboard behavior and focus.
2. **Medium, conditional: optional shared-server credit exposure.** `server.js:65`
   issues temporary keys without authentication/rate limiting; `server.js:100` listens
   beyond localhost by default. Relevant when running the server with a key on a
   reachable network, not the static GitHub Pages deployment. Confirm intended local
   versus public hosting with Marcus before choosing an access-control model.
3. **Matching is still best-effort.** `public/app.js:453` onward. Next qualify real
   multi-speaker/multi-sentence conversations with delayed translations and network
   reconnects, without exporting real transcripts or exposing keys. Include cases
   where translation merges/splits sentences. Preserve the accepted fallback policy.
   Matching now scans the full active epoch; long-session performance is unmeasured.
4. **Low: phone header overlap.** At 390 px in idle split/room mode, Save transcript
   can overlap the source selector (`public/styles.css:823`). Existing CSS, not
   introduced or fixed here. Check shorter phone heights when addressing it.
5. **Qualification gaps:** real meeting-tab capture and permission-denial UI, Edge,
   live network-failure reconnect, explicit pop-out pause/resume, offline install/
   updates, sub-path deployment, and Node 20 execution. Confirm connection subprotocols
   and absence of `api_key` from the first frame privately; do not share raw headers,
   keys, or transcript-bearing network exports. Public deployment checks verified
   assets and Actions success only, not a post-deploy paid session.
6. **Preview cleanup:** the owner's local live-test preview on port 5174 and font
   preview on port 5184 were deliberately left available; last known font URL was
   `http://127.0.0.1:5184/#demo`. Their current process/tab state was not rechecked
   during wrap-up. The temporary matching preview on 5194 was stopped and its tab
   closed. Preserve any owner transcript/tab until he is ready to discard it.

Recommended order: keyboard lock, owner-directed real matching/reconnect checks,
phone overlap, then server hardening if shared hosting is wanted. Avoid expanding
scope to dependencies, endpoint timing, or forced early finalization to solve
alignment; that changes the diarization tradeoff and needs separate evaluation.

## Commit map since baseline

| Commit | Purpose |
| --- | --- |
| `33c6d46` | Session/capture safety, rename rendering, authentication migration, initial tests |
| `e88655c` | Initial implementation/verification worklog |
| `c49e944` | Owner-reported live Chrome results |
| `437d977` | Small/Medium/Large transcript sizes |
| `621879e` | Font verification and preview record |
| `54f0059` | Delayed translation matching and 16 additional tests |
| `c154302` | Matching baseline/mutation/Chrome evidence |
| `f37816a` | Release authorization and final validation; deployed main |

The next documentation-only commit contains this handoff and the final worklog
entry. It is intentionally not part of the deployed release.
