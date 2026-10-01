# Alligator

Two-way live speech translation for rooms and online meetings, built on the Soniox real-time API (`stt-rt-v5`, `translation.type = "two_way"`).

Two panes, one conversation: each pane shows the whole conversation in one language. What was said in that language appears as-is (● filled dot), and what the other side said appears translated (○ ring).

Speakers are told apart automatically (speaker diarization). Each speaker gets a colour, and a label such as **Speaker 1** opens each of their turns. Click a label to give that speaker a name.

There are two views, both available from **Options**:
- **Side by side** (the default): one pane per language, as described above.
- **Stacked:** a single centred column. Each turn shows what was said, with its translation right underneath in italics.

## Run

Requires Node 20.6+. There are no dependencies.

```bash
npm start                   # → http://localhost:5173
```

Open the page, press play, and paste your Soniox API key when asked. It's also under **Options → Soniox API key**, which explains how to get one. To preview the UI without a key, open `http://localhost:5173/#demo`. It replays a short three-person English/Spanish conversation.

### Where the API key lives

- **Each person's own key (default).** The key is saved in that browser only (`localStorage`). For each session, the browser trades it with Soniox for a 60-second, single-use key and streams with that. If the key lacks the **Temporary API keys** permission, the browser streams with the key itself. Either way, the key goes only to Soniox.
- **One key on the server (optional).** Set `SONIOX_API_KEY` in `.env` (see `.env.example`) when you host Alligator for people who shouldn't need their own key. The server then mints the short-lived keys, and its key never reaches the browser. A key someone adds in Options takes priority over the server's.

Because the browser can talk to Soniox directly, `public/` also works as a plain static website, with no Node server at all.

## Use

| Control                      | What it does                                                             |
| ---------------------------- | ------------------------------------------------------------------------ |
| Language pair                | Pick both languages; ⇄ swaps them. Locked while a session runs.          |
| In the room / Online meeting | Where the audio comes from (see below).                                  |
| ▶ / ❚❚                       | Start, pause and resume. **Space** does the same.                        |
| ■                            | End the session. **Esc** does the same.                                  |
| Speaker label                | Click to rename that speaker everywhere. **Enter** saves, **Esc** cancels. |
| Options (sliders icon)       | **View:** Side by side or Stacked. **Appearance:** Auto (follows your system), Light or Dark. **Tell speakers apart:** turns speaker diarization on or off; the ⓘ explains it in plain language. **Soniox API key:** add, change or remove your key, with step-by-step help. Your choices are remembered in this browser. |
| Save transcript              | Appears once a session ends and downloads a `.txt` file with timestamps and speaker names. |

**In the room:** only the microphone is used. On a phone or tablet in portrait, the top pane turns 180° so you can lay the device flat between two people, each reading their own half.

**Online meeting:** the microphone is mixed with the meeting's audio. After you press play, the browser asks you to share a screen. Pick the Meet/Teams/Zoom **browser tab** and turn on **Share tab audio**.

- Use Chrome or Edge on desktop. Safari and Firefox can't capture tab audio.
- For a desktop meeting app (Zoom or Teams): on Windows, share _Entire screen_ with _Share system audio_. On macOS, browsers can't capture system audio, so join the meeting in a browser tab instead.
- Headphones prevent the room microphone from picking up the meeting a second time.

## How it works

```
mic (+ tab audio) → AudioWorklet → 16 kHz PCM s16le → wss://stt-rt.soniox.com/transcribe-websocket
                                                                ↓ tokens
                         pane A  ←  Transcript (turns)  →  pane B
```

- **`server.js`** serves `public/` and `POST /api/temporary-key`.
- **`public/pcm-worklet.js`** downmixes and resamples audio to 16 kHz mono PCM, sent in 100 ms frames. It also reports the input level used for the halo around the play button.
- **`public/app.js`**
  - Session config: two-way translation, language hints for the pair, and `enable_speaker_diarization` from the Options switch. With diarization off, endpoint detection comes back on to split turns at natural pauses. The setting is part of a stream's setup, so changing it mid-session applies from the next Play.
  - Views: every turn has an element in each view (pane A, pane B and the stacked column). Switching views is instant and keeps the transcript. Where the browser supports View Transitions, view and theme changes crossfade.
  - Endpoint detection is off while diarization is on, because Soniox notes that early finalization makes speaker attribution less accurate. A new turn starts when the speaker or the language changes. A long monologue is split at a sentence end after about 240 characters, once its translation has caught up.
  - Token handling: final tokens are committed. Non-final tokens are drawn as a lighter layer that each message replaces. Speech in a language outside the pair is shown untranslated, with a language tag.
  - Translation tokens arrive after the speech they translate, sometimes after the next speaker has started. If a translation token carries a `speaker`, it goes to that speaker's turn. Otherwise it goes to the oldest recent turn in its source language whose translation hasn't reached the end of a sentence.
  - Speaker numbers restart with every new Soniox stream: each Play, and each automatic reconnect. Names you give apply to the stream they were given in.
  - **Pause** sends about 300 ms of silence and then `{"type":"finalize"}`, so the sentence in progress settles. It then sends `{"type":"keepalive"}` every 10 s, which makes resuming instant. Soniox bills for the whole time the stream is open, including pauses.
  - **Stop** sends an empty frame and waits for `finished`.
  - If the connection drops, the app reconnects up to 3 times with a new key and keeps the transcript.
  - A screen wake lock keeps the display on during a session.
