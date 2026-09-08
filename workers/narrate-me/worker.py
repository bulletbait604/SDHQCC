"""Narrate Me cloud worker: FFmpeg clip extract + audio assembly + captions + CapCut zip.

Deploy (from this directory):

  modal deploy worker.py

Required Modal secret name: narrate-me

Never commit credentials. Configure the secret with the same R2/Mongo values
SDHQCC already uses on Vercel, plus INTERNAL_API_SECRET or MODAL_SECRET so
Vercel can call this endpoint.

POST body `action`:
  extract-clip — cut one analysis window from the source video
  assemble (default) — narration WAV/MP3 + captions zip
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import zipfile
from typing import Any

import boto3
import modal

APP_NAME = "narrate-me"
SECRET_NAME = "narrate-me"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("boto3>=1.34.0", "httpx>=0.27.0", "fastapi>=0.110.0")
)

app = modal.App(APP_NAME, image=image)

README = """Narrate Me — CapCut import

1. Import the original video into CapCut (the video is not included in this package).
2. Import NARRATION_FULL.wav.
3. Place the narration audio at 00:00:00.000 — silence is already baked in so lines line up with the footage.
4. Import CAPTIONS.srt (or CAPTIONS.vtt).
5. Make final edits.
6. Export from CapCut.

Do not shift individual narration clips unless you changed the video edit. The WAV is aligned to the original timeline.
"""


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _worker_secret() -> str:
    return _env("INTERNAL_API_SECRET") or _env("MODAL_SECRET")


def _authorized(authorization: str | None) -> bool:
    expected = _worker_secret()
    if not expected or not authorization:
        return False
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else authorization.strip()
    return token == expected


def _r2():
    account = _env("R2_ACCOUNT_ID")
    key = _env("R2_ACCESS_KEY_ID")
    secret = _env("R2_SECRET_ACCESS_KEY")
    bucket = _env("R2_BUCKET_NAME") or "sdhq-uploads"
    if not account or not key or not secret:
        raise RuntimeError("R2 credentials are not configured on the Modal secret")
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        region_name="auto",
    )
    return client, bucket


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        err = (proc.stderr or b"").decode("utf-8", "replace")[-800:]
        raise RuntimeError(f"{cmd[0]} failed ({proc.returncode}): {err or 'no stderr'}")


def _srt_time(seconds: float) -> str:
    ms = max(0, int(round(seconds * 1000)))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, milli = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{milli:03d}"


def _vtt_time(seconds: float) -> str:
    return _srt_time(seconds).replace(",", ".")


def _cues(segments: list[dict[str, Any]]) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    ordered = sorted(segments, key=lambda s: float(s.get("sourceStart") or 0))
    for seg in ordered:
        source_start = float(seg.get("sourceStart") or 0)
        alignment = seg.get("alignment") or {}
        words = alignment.get("words") or []
        if not words:
            text = str(seg.get("text") or "").strip()
            if text:
                dur = float(seg.get("duration") or 0.4)
                cues.append((source_start, source_start + max(0.4, dur), text))
            continue
        buf: list[dict[str, Any]] = []

        def flush() -> None:
            if not buf:
                return
            start = source_start + float(buf[0].get("start") or 0)
            end = source_start + float(buf[-1].get("end") or 0)
            text = " ".join(str(w.get("word") or "") for w in buf).strip()
            if text:
                cues.append((start, max(start + 0.35, end), text))
            buf.clear()

        for word in words:
            nxt = buf + [word]
            span = float(nxt[-1].get("end") or 0) - float(nxt[0].get("start") or 0)
            punct = str(word.get("word") or "").endswith((".", "!", "?"))
            if buf and (len(nxt) > 10 or span > 4.2):
                flush()
                buf.append(word)
            else:
                buf.append(word)
            if punct:
                flush()
        flush()
    return cues


def _write_captions(cues: list[tuple[float, float, str]], srt_path: str, vtt_path: str) -> None:
    srt_lines = []
    vtt_lines = ["WEBVTT", ""]
    for i, (start, end, text) in enumerate(cues, start=1):
        srt_lines.extend([str(i), f"{_srt_time(start)} --> {_srt_time(end)}", text, ""])
        vtt_lines.extend([f"{_vtt_time(start)} --> {_vtt_time(end)}", text, ""])
    with open(srt_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(srt_lines))
    with open(vtt_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(vtt_lines))


def _assemble(payload: dict[str, Any]) -> dict[str, str]:
    client, bucket = _r2()
    keys = payload["keys"]
    segments = payload.get("segments") or []
    duration = max(1.0, float(payload.get("durationSeconds") or 1))
    sample_rate = int(payload.get("sampleRate") or 44100)

    with tempfile.TemporaryDirectory() as tmp:
        concat_list = os.path.join(tmp, "concat.txt")
        wav_parts: list[str] = []
        cursor = 0.0
        ordered = sorted(segments, key=lambda s: float(s.get("sourceStart") or 0))
        for i, seg in enumerate(ordered):
            start = max(0.0, float(seg.get("sourceStart") or 0))
            gap = start - cursor
            if gap > 0.02:
                silence = os.path.join(tmp, f"silence_{i}.wav")
                _run(
                    [
                        "ffmpeg",
                        "-y",
                        "-f",
                        "lavfi",
                        "-i",
                        f"anullsrc=r={sample_rate}:cl=mono",
                        "-t",
                        f"{gap:.3f}",
                        "-c:a",
                        "pcm_s16le",
                        silence,
                    ]
                )
                wav_parts.append(silence)
            pcm_key = str(seg.get("audioKey") or "")
            if not pcm_key:
                continue
            pcm_path = os.path.join(tmp, f"seg_{i}.pcm")
            wav_path = os.path.join(tmp, f"seg_{i}.wav")
            obj = client.get_object(Bucket=bucket, Key=pcm_key)
            with open(pcm_path, "wb") as fh:
                fh.write(obj["Body"].read())
            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "s16le",
                    "-ar",
                    str(sample_rate),
                    "-ac",
                    "1",
                    "-i",
                    pcm_path,
                    "-c:a",
                    "pcm_s16le",
                    wav_path,
                ]
            )
            wav_parts.append(wav_path)
            probe = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    wav_path,
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            seg_dur = float(probe.stdout.strip() or 0)
            cursor = start + max(seg_dur, float(seg.get("duration") or 0))

        tail = duration - cursor
        if tail > 0.02:
            silence = os.path.join(tmp, "silence_tail.wav")
            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    f"anullsrc=r={sample_rate}:cl=mono",
                    "-t",
                    f"{tail:.3f}",
                    "-c:a",
                    "pcm_s16le",
                    silence,
                ]
            )
            wav_parts.append(silence)

        if not wav_parts:
            raise RuntimeError("No narration audio segments were provided")

        with open(concat_list, "w", encoding="utf-8") as fh:
            for part in wav_parts:
                fh.write(f"file '{part.replace(os.sep, '/')}'\n")

        wav_out = os.path.join(tmp, "NARRATION_FULL.wav")
        mp3_out = os.path.join(tmp, "NARRATION_FULL.mp3")
        _run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concat_list,
                "-af",
                "dynaudnorm=f=150:g=12",
                "-c:a",
                "pcm_s16le",
                wav_out,
            ]
        )
        _run(
            [
                "ffmpeg",
                "-y",
                "-i",
                wav_out,
                "-codec:a",
                "libmp3lame",
                "-qscale:a",
                "2",
                mp3_out,
            ]
        )

        srt_out = os.path.join(tmp, "CAPTIONS.srt")
        vtt_out = os.path.join(tmp, "CAPTIONS.vtt")
        _write_captions(_cues(ordered), srt_out, vtt_out)
        readme_out = os.path.join(tmp, "README.txt")
        with open(readme_out, "w", encoding="utf-8") as fh:
            fh.write(README)

        zip_out = os.path.join(tmp, "NARRATE_ME_CAPCUT_PACKAGE.zip")
        with zipfile.ZipFile(zip_out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(wav_out, "Narrate_Me/NARRATION_FULL.wav")
            zf.write(mp3_out, "Narrate_Me/NARRATION_FULL.mp3")
            zf.write(srt_out, "Narrate_Me/CAPTIONS.srt")
            zf.write(vtt_out, "Narrate_Me/CAPTIONS.vtt")
            zf.write(readme_out, "Narrate_Me/README.txt")

        uploads = [
            (wav_out, keys["wav"], "audio/wav"),
            (mp3_out, keys["mp3"], "audio/mpeg"),
            (srt_out, keys["srt"], "application/x-subrip"),
            (vtt_out, keys["vtt"], "text/vtt"),
            (readme_out, keys["readme"], "text/plain"),
            (zip_out, keys["zip"], "application/zip"),
        ]
        for path, key, content_type in uploads:
            with open(path, "rb") as fh:
                client.put_object(Bucket=bucket, Key=key, Body=fh.read(), ContentType=content_type)

    return {
        "wavKey": keys["wav"],
        "mp3Key": keys["mp3"],
        "srtKey": keys["srt"],
        "vttKey": keys["vtt"],
        "packageKey": keys["zip"],
    }


def _extract_clip(payload: dict[str, Any]) -> dict[str, Any]:
    """Cut one analysis window from the source video and store an MP4 clip on R2."""
    client, bucket = _r2()
    source_key = str(payload.get("sourceKey") or "")
    source_url = str(payload.get("sourceUrl") or "")
    output_key = str(payload.get("outputKey") or "")
    start = max(0.0, float(payload.get("startTime") or 0))
    end = max(start + 0.5, float(payload.get("endTime") or 0))
    duration = end - start

    if not output_key.startswith("narrate-me/") or ".." in output_key or "\\" in output_key:
        raise RuntimeError("Invalid clip output key")
    if not source_url and not source_key:
        raise RuntimeError("Missing source video for clip extract")

    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "clip.mp4")
        src = source_url
        if not src:
            local_src = os.path.join(tmp, "source.bin")
            client.download_file(bucket, source_key, local_src)
            src = local_src

        copy_cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            f"{start:.3f}",
            "-i",
            src,
            "-t",
            f"{duration:.3f}",
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            out,
        ]
        encode_cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            f"{start:.3f}",
            "-i",
            src,
            "-t",
            f"{duration:.3f}",
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "28",
            "-c:a",
            "aac",
            "-ac",
            "1",
            "-b:a",
            "96k",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out,
        ]
        try:
            _run(copy_cmd)
        except Exception:
            _run(encode_cmd)

        size = os.path.getsize(out)
        if size < 1000:
            raise RuntimeError("Extracted clip was empty")
        client.upload_file(out, bucket, output_key, ExtraArgs={"ContentType": "video/mp4"})

    return {"clipKey": output_key, "sizeBytes": size, "mimeType": "video/mp4"}


def _callback(payload: dict[str, Any], result: dict[str, str] | None, error: str | None) -> None:
    url = str(payload.get("callbackUrl") or "").strip()
    if not url:
        return
    import httpx

    secret = _worker_secret()
    body: dict[str, Any] = {"jobId": payload.get("jobId"), "ok": error is None}
    if error:
        body["error"] = error[:300]
    else:
        body.update(result or {})
    with httpx.Client(timeout=30.0) as client:
        client.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
        )


@app.function(
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    timeout=60 * 60,
    memory=4096,
    ephemeral_disk=16 * 1024,
)
@modal.asgi_app()
def assemble():
    from fastapi import FastAPI, Header, HTTPException, Request

    api = FastAPI()

    @api.post("/")
    async def handle(request: Request, authorization: str | None = Header(default=None)):
        if not _authorized(authorization):
            raise HTTPException(status_code=401, detail="Unauthorized")
        payload = await request.json()
        action = str(payload.get("action") or "assemble").strip()
        if action == "extract-clip":
            try:
                result = _extract_clip(payload)
                return {"ok": True, **result}
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "error": str(exc)[:400]}
        last_error = "Assembly failed"
        for attempt in range(3):
            try:
                result = _assemble(payload)
                _callback(payload, result, None)
                return {"ok": True, **result}
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                if attempt == 2:
                    _callback(payload, None, last_error)
                    return {"ok": False, "error": last_error[:300]}
        return {"ok": False, "error": last_error[:300]}

    return api
