import { extFromFilename, sanitizeFilename, sanitizeUserSeg } from '@/lib/narrateMe/config'

export function narrateMePrefix(username: string, jobId: string): string {
  return `narrate-me/${sanitizeUserSeg(username)}/${jobId}`
}

export function sourceVideoKey(username: string, jobId: string, fileName: string, mimeType: string): string {
  const ext = extFromFilename(fileName, mimeType)
  return `${narrateMePrefix(username, jobId)}/source/original-video.${ext}`
}

export function analysisJsonKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/analysis/analysis.json`
}

export function timelineJsonKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/analysis/timeline.json`
}

export function scriptJsonKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/script/script.json`
}

export function voiceSegmentKey(username: string, jobId: string, segmentId: string): string {
  return `${narrateMePrefix(username, jobId)}/audio/segments/${segmentId}.pcm`
}

export function voiceMetaKey(username: string, jobId: string, segmentId: string): string {
  return `${narrateMePrefix(username, jobId)}/audio/segments/${segmentId}.json`
}

export function narrationWavKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/audio/NARRATION_FULL.wav`
}

export function narrationMp3Key(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/audio/NARRATION_FULL.mp3`
}

export function captionsSrtKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/captions/CAPTIONS.srt`
}

export function captionsVttKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/captions/CAPTIONS.vtt`
}

export function exportReadmeKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/export/README.txt`
}

export function exportZipKey(username: string, jobId: string): string {
  return `${narrateMePrefix(username, jobId)}/export/NARRATE_ME_CAPCUT_PACKAGE.zip`
}

export function isNarrateMeObjectKey(key: string, username: string): boolean {
  return key.startsWith(`narrate-me/${sanitizeUserSeg(username)}/`)
}

export function safeOriginalName(fileName: string): string {
  return sanitizeFilename(fileName)
}
