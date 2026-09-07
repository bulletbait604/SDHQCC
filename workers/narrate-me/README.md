# Narrate Me Modal worker

Cloud FFmpeg worker for SDHQCC **R&D → Narrate Me**. It does not render video. It assembles a timeline-aligned narration WAV/MP3, writes captions from stored ElevenLabs alignment, and uploads a CapCut zip to the existing Cloudflare R2 bucket.

Production is entirely cloud-based: Vercel + MongoDB + R2 + Gemini + ElevenLabs + this worker.

## 1. Install Modal CLI

```bash
pip install modal
modal token new
```

Use the existing profile name `Bulletbait604` (`MODAL_PROFILE`). Do not create `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` env vars in Vercel. Keep using:

- `MODAL_KEY`
- `MODAL_SECRET`
- `MODAL_PROFILE=Bulletbait604`

## 2. Create the Modal secret

Never put credentials in Git. In the Modal dashboard or CLI, create a secret named **`narrate-me`** using the **same** values already on Vercel:

```bash
modal secret create narrate-me \
  R2_ACCOUNT_ID= \
  R2_ACCESS_KEY_ID= \
  R2_SECRET_ACCESS_KEY= \
  R2_BUCKET_NAME= \
  INTERNAL_API_SECRET= \
  MODAL_SECRET=
```

Leave values blank in this file. Paste real values only into Modal.

`INTERNAL_API_SECRET` (preferred) or `MODAL_SECRET` must match what Vercel sends as `Authorization: Bearer …`.

## 3. Deploy

From this directory:

```bash
cd workers/narrate-me
modal deploy worker.py
```

Copy the printed HTTPS URL for `assemble`.

## 4. Point Vercel at the worker

In Vercel project env (optional but recommended after first deploy):

```
MODAL_NARRATE_ME_URL=https://<workspace>--narrate-me-assemble.modal.run
```

If unset, the app constructs `https://<MODAL_PROFILE lowercase>--narrate-me-assemble.modal.run`. Set the explicit URL if Modal prints a different host.

Also set on Vercel (if not already present):

```
GEMINI_API=
GEMINI_API_KEY=
ELEVEN_LABS_API=
ELEVEN_LAB_API=
ELEVENLABS_VOICE_ID=
MODAL_KEY=
MODAL_SECRET=
MODAL_PROFILE=Bulletbait604
INTERNAL_API_SECRET=
MONGODB_URI=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

`GEMINI_API` is the existing SDHQCC key name. `GEMINI_API_KEY` is accepted as a fallback.

## 5. Local notes

You do not need this worker running on your PC. For a short test video (≤ 20 minutes), Vercel can assemble WAV + captions + zip without FFmpeg if Modal is not deployed yet. Longer videos require this worker.

## 6. What the worker writes to R2

```
narrate-me/{userId}/{jobId}/audio/NARRATION_FULL.wav
narrate-me/{userId}/{jobId}/audio/NARRATION_FULL.mp3
narrate-me/{userId}/{jobId}/captions/CAPTIONS.srt
narrate-me/{userId}/{jobId}/captions/CAPTIONS.vtt
narrate-me/{userId}/{jobId}/export/README.txt
narrate-me/{userId}/{jobId}/export/NARRATE_ME_CAPCUT_PACKAGE.zip
```

The original video is never added to the zip.
