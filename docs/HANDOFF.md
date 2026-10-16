# Alligator handoff to the original Claude session

Prepared October 16, 2026 (Asia/Tokyo). Owner: Marcus.

## Current state and release boundary (updated October 16, 2026)

- Repository: <https://github.com/marcus-saito/alligator>; local checkout:
  `/Users/marcus/Code/github/alligator`, branch `main`.
- Original implementation baseline: `fc4e16401931db164d41359d50d4374b03c92d60`.
  Follow-up baseline for this session: `0c5b301c70ea7e35442a4733a57de72e321ed89b`.
- Local `main` before this documentation commit is `0c5b301`, three commits ahead
  of tracking `origin/main` at `f37816acbe07fd765385208b100693cfb1994b11`:
  `0b7e362` (previous handoff), `e78cbc6` (keyboard lock), and `0c5b301` (phone fixes).
  This handoff/worklog commit becomes the fourth local-only commit. Resolve its
  exact hash with `git log -1 --format=%H -- docs/HANDOFF.md` or Marcus's wrap-up reply.
- Last verified live release at <https://alligator.chat>: `f37816a`.
  [GitHub Pages run 38858835902](https://github.com/marcus-saito/alligator/actions/runs/38858835902)
  succeeded for that release; public HTML/JS/CSS/worklet/service-worker assets
  matched it by SHA-256. The three later commits above and this wrap-up have **not**
  been pushed/deployed. Remote/live state was not refreshed during this wrap-up;
  fetch and check it before any subsequent release.
- Marcus explicitly requires this wrap-up to be committed **locally only**: no push,
  deploy, or settings changes. The earlier release approval applied to `f37816a`,
  not the new local commits. Claude should review the release instructions below
  and obtain Marcus's explicit OK before pushing.
- No application code changed after `0c5b301` in this follow-up. Only the worklog
  and this handoff changed. All requested real-audio A/B checks passed by owner
  report; no fallback replacement was needed. The automated suite is now 47/47.
- `codex/session-safety-and-soniox-auth` was retained at the previous release.
  Continue from current `main`, not that older implementation branch.
- `docs/WORKLOG.md` is chronological. Its earlier local-only/unverified statements
  are historical; the later entries below resolve the specifically tested items.

## Original implementation changes from fc4e164 through f37816a

Claude's later fixes and this session's follow-up are recorded separately below.

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

- Deployed `f37816a` release gate: **45/45 tests passed** on Node **24.15.0**;
  Node 20 was not requalified. JavaScript syntax checks and `git diff --check`
  passed. The current local suite is 47/47 after Claude's two additional tests.
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
At that stage, the new translation matcher had not had a new real-audio/provider
test. The follow-up A/B results below now qualify the specifically tested cases.
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

## Changes and live qualification since 0c5b301

No application changes were made. Codex read Claude's review and follow-up records,
confirmed the three-commit local/deployed boundary, reran **47/47 tests on Node
24.15.0**, checked ports, and started `npm start` on previously free port 5173.
Marcus tested the latest local code in Chrome at `http://localhost:5173/`, outside
`#demo`; the initial observed language pair was English/Japanese.

Owner-reported results:

| Check | Result |
| --- | --- |
| A1: two/three sentences in one turn | Whole translation stayed with the correct speaker's turn. Self-interjection also seemed fine. |
| A2: two distinct voices speaking the same language | Separate speaker labels; each translation stayed with its speaker, including the first speaker's final words. |
| A3: long speech | Marcus reported it seemed fine. No measured duration, chunk length, or throughput was supplied. |
| A4: requested brief Wi-Fi interruption | Automatic reconnect, earlier transcript preserved, new speech translated again. Audio lost during the outage was not measured. |
| B: restricted-key fallback | A test key with real-time STT on and Temporary API keys off connected and translated successfully. Marcus restored his normal key and deleted the test key. |

These are owner reports, not assistant-inspected HTTP/WebSocket evidence. No keys,
raw headers/network exports, or real transcript text were collected or committed.
The restricted-key result qualifies the tested key format/environment, not every
possible long-lived-key format. Leave the existing HTTP 403 fallback in place;
the conditional proposal to replace it with a permissions message was not needed.
Keep the accepted best-effort matching policy, no unconfirmed-speaker UI, and the
existing endpoint/diarization/finalization tradeoff.

The previous unresolved keyboard and phone-layout findings were fixed by Claude
**before** this follow-up baseline:

- `e78cbc6`: actual disabled language/swap/source controls, handler guards and picker
  restoration during non-idle states, plus `aria-disabled`. Two regression tests;
  Claude reported each protection's removal fails one test.
- `0c5b301`: bottom-centre Save pill in phone face-to-face mode, feed clearance via
  `:has`, Save visibility before bottom-scroll calculation, in-bounds seam hairline
  fixing horizontal overflow/phone zoom-out, and tighter header below 340 px.
  Claude's recorded Chrome checks cover 320/360/375/390 px, light/dark, and desktop.
- Codex reran the 47 tests but did not independently repeat Claude's entire layout
  or keyboard browser matrix. CSS is not covered by the Node harness.

## Remaining issues and suggested next steps

1. **Optional shared-server credit exposure remains unchanged.** `server.js`
   issues temporary keys without authentication/rate limiting when configured with
   a server key; it listens beyond loopback by default. This is separate from static
   GitHub Pages. Do not implement hardening until Marcus chooses the intended
   local/public hosting model.
2. **Matching remains best-effort.** The latest real-audio checks above passed, but
   missing/unmatched speaker metadata, translation merging/splitting sentences,
   abbreviations, and unusually delayed streams can still misattribute text.
   Full-epoch scans and retained transcript growth have not had measured long-session
   performance testing. These investigations wait for Marcus's direction.
3. **Restricted-key compatibility is partially qualified.** The direct-key fallback
   succeeded in the owner's test. Browser protocol entries still require valid token
   characters. No claim is made about every key format or inspected wire-level 403.
   Do not ask for or log actual key values to investigate this.
4. **Other qualification gaps remain:** real meeting-tab capture and permission-
   denial UI, Edge, explicit live pop-out pause/resume, offline install/update behavior,
   sub-path deployment, Node 20 execution, other network-failure scenarios, and exact
   connection-subprotocol/start-frame inspection. Current tests used Node 24.15.0;
   app-level live success does not establish each of these checks individually.
5. **Local caching can hide changes.** Earlier preview testing saw fresh JS mixed
   with stale HTML/CSS. Use a fresh test origin or verify/reload assets before
   concluding a UI fix failed. Preserve the owner's saved key and transcript.

No new bug fix is proposed from these successful A/B results. Next immediate action
is Claude's release review, then a push only after Marcus explicitly authorizes it.
All other remaining work waits for his decision.

## Preview server status at this wrap-up

Checked listener state on October 16, 2026; all three remain running and were left
untouched. PIDs are observations, not permanent identifiers: recheck ownership
before any later cleanup, and do not use broad process-kill commands.

| Port / address | Process observed | Purpose and handling |
| --- | --- | --- |
| `http://localhost:5173/` | Node PID `71303`, TCP `*:5173` | Started by Codex with `npm start` for the requested latest-code live tests. Left running; the app can load optional server configuration from `.env`, whose contents were not inspected. |
| `http://127.0.0.1:5174/` | Python PID `66981`, loopback only | Existing static preview; Marcus explicitly asked to leave it up. |
| `http://127.0.0.1:5184/#demo` | Python PID `67882`, loopback only | Existing font/demo preview; Marcus explicitly asked to leave it up. |

Do not reload/close an owner transcript tab or stop these servers without his
instruction. Browser connection changed during this follow-up; the available actual
Chrome connection was used to open the test page. Later in-app-browser ambient state
was not treated as proof that the live tests ran in a different browser. Live results
and tested Chrome environment are attributed to Marcus's reports, as above.

## Instructions for Claude to handle push/deployment

1. Read this handoff and the newest worklog entries. Verify current branch, clean
   working tree, and the local wrap-up commit hash. Only documentation changed since
   `0c5b301`; all four local commits should be included in the prospective push.
2. Fetch origin without pushing. Inspect `origin/main..main` and verify origin's
   current state instead of relying on the tracking snapshot above. Expected remote
   base is `f37816a`. If it moved, reconcile/review the difference and rerun affected
   checks; never force-push or discard owner changes.
3. Run `npm test` (expected 47/47), `git diff --check`, and inspect the release diff.
   Retain the recorded owner live results and their limits. Do not access keys or
   collect real transcript content for release bookkeeping.
4. Summarize the exact commits and ask Marcus for explicit approval to push/deploy.
   This handoff is release guidance, not approval to push yet. Do not change DNS,
   Pages/repository settings, workflow, or secrets.
5. After approval, push `main` normally to origin. No build or manual deployment is
   needed: `.github/workflows/pages.yml` publishes `public/` on each main push.
6. Find the Pages workflow run for that exact pushed SHA, wait for success, and
   report its URL. Then verify live `index.html`, `app.js`, `styles.css`,
   `pcm-worklet.js`, and `sw.js` match the local release (e.g. SHA-256 comparisons).
   Deployment success/assets are not another paid audio session. Report any failure
   without silently changing settings or rolling back unrelated work.
7. Record the release result in the worklog, report the deployed SHA and any remaining
   limits, and preserve the requested preview servers unless Marcus says otherwise.

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
| `f37816a` | Release authorization and final validation; last verified deployed main |
| `0b7e362` | Previous handoff and release verification; local only |
| `e78cbc6` | Claude: keyboard session lock and two tests; local only |
| `0c5b301` | Claude: phone Save, overflow/zoom-out and 320 px fixes; local only |

The next local documentation-only commit updates this handoff and the worklog with
the follow-up above. It is not part of the deployed release; Marcus receives its
exact hash in the wrap-up reply.
