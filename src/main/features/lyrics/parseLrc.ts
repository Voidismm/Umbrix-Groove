import type { LyricsLine } from '../../../shared/types'

/** Line-level LRC: [mm:ss.xx] or [mm:ss.xxx] */
const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?]/g
/** Enhanced / word-level LRC: <mm:ss.xx> */
const WORD_TIME_TAG = /<(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?>/g
/** LRC / ID3 header lines — bracketed or bare (`[ti:…]` / `ti:` / `source:`). */
const META_TAG = /^(?:\[)?(ti|ar|al|by|offset|re|ve|length|source)\s*:/i

/** True for lyric file / tag header lines that should never show in the panel. */
export function isLyricsMetaLine(line: string): boolean {
  return META_TAG.test(line.trim())
}
/** v1 / chorus / bridge — karaoke structure labels, not singable text */
const SECTION_NAME =
  '(?:v\\d+|c\\d+|verse\\s*\\d*|chorus|pre-?chorus|bridge|intro|outro|hook|refrain)'
const SECTION_BRACKETED = new RegExp(
  `[\\[({【]\\s*${SECTION_NAME}\\s*[\\])}】]`,
  'gi'
)
/** v1 / v1: / c2: — require a digit so we never eat words like "crazy" */
const SECTION_CODE_PREFIX = new RegExp(`^(?:v\\d+|c\\d+)\\s*[:：]?\\s*`, 'i')
const SECTION_NAMED_PREFIX = new RegExp(
  `^(?:verse\\s*\\d*|chorus|pre-?chorus|bridge|intro|outro|hook|refrain)\\s*[:：]\\s*`,
  'i'
)
const SECTION_ONLY = new RegExp(`^${SECTION_NAME}$`, 'i')

/** Gap above this (ms) starts a new display line when coalescing word-sync. */
const WORD_LINE_GAP_MS = 700

function parseTimestamp(min: string, sec: string, frac?: string): number {
  const minutes = Number(min)
  const seconds = Number(sec)
  let ms = 0
  if (frac) {
    // .1 = 100ms, .12 = 120ms, .123 = 123ms
    const padded = frac.padEnd(3, '0').slice(0, 3)
    ms = Number(padded)
  }
  return (minutes * 60 + seconds) * 1000 + ms
}

function isSectionOnly(text: string): boolean {
  return SECTION_ONLY.test(text.trim())
}

/** Strip enhanced/word timestamps, leftover line tags, and section labels. */
export function cleanLyricText(text: string): string {
  let s = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(WORD_TIME_TAG, ' ')
    .replace(TIME_TAG, ' ')
    .replace(SECTION_BRACKETED, ' ')
    .replace(SECTION_CODE_PREFIX, '')
    .replace(SECTION_NAMED_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Drop lines that are only a structure marker (v1, chorus, …)
  if (!s || isSectionOnly(s)) return ''
  return s
}

function isWordAtom(text: string): boolean {
  if (!text) return false
  // Single token only — enhanced-LRC / SYLT syllables, not short phrase lines
  return !/\s/.test(text) && text.length <= 24
}

/**
 * Join word/syllable sync entries into phrase lines for display.
 * Keeps the first timestamp of each phrase.
 */
export function coalesceWordSyncLines(lines: LyricsLine[]): LyricsLine[] {
  if (lines.length < 4) return lines

  const timed = lines.filter((line) => line.timeMs != null && line.text)
  if (timed.length < lines.length * 0.8) return lines
  if (timed.filter((line) => isWordAtom(line.text)).length < timed.length * 0.6) {
    return lines
  }

  const out: LyricsLine[] = []
  let phraseTime: number | null = null
  let phraseParts: string[] = []
  let lastTime = -Infinity

  const flush = (): void => {
    if (!phraseParts.length) return
    out.push({
      timeMs: phraseTime,
      text: phraseParts.join(' ').replace(/\s+/g, ' ').trim()
    })
    phraseTime = null
    phraseParts = []
  }

  for (const line of lines) {
    const text = cleanLyricText(line.text)
    if (!text || isSectionOnly(text)) continue

    if (line.timeMs == null) {
      flush()
      out.push({ ...line, text })
      continue
    }

    const gap = line.timeMs - lastTime
    if (phraseParts.length && gap > WORD_LINE_GAP_MS) flush()

    if (phraseTime == null) phraseTime = line.timeMs
    phraseParts.push(text)
    lastTime = line.timeMs
  }
  flush()
  return out.length ? out : lines
}

/** Parse LRC / enhanced-LRC text into timed lines. */
export function parseLrc(text: string): LyricsLine[] {
  const lines: LyricsLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || isLyricsMetaLine(line)) continue

    const times: number[] = []
    let match: RegExpExecArray | null
    TIME_TAG.lastIndex = 0
    while ((match = TIME_TAG.exec(line)) !== null) {
      times.push(parseTimestamp(match[1], match[2], match[3]))
    }

    // Enhanced LRC with only word tags and no [line] tag: use first word time
    if (times.length === 0) {
      const wordMatch = /<(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?>/.exec(line)
      if (wordMatch) {
        times.push(parseTimestamp(wordMatch[1], wordMatch[2], wordMatch[3]))
      }
    }

    const content = cleanLyricText(line)
    if (!content) continue

    if (times.length === 0) {
      lines.push({ timeMs: null, text: content })
      continue
    }
    for (const timeMs of times) {
      lines.push({ timeMs, text: content })
    }
  }

  lines.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0))
  return coalesceWordSyncLines(lines)
}

export function plainTextToLines(text: string): LyricsLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isLyricsMetaLine(line))
    .map((line) => cleanLyricText(line))
    .filter((line) => line.length > 0)
    .map((line) => ({ timeMs: null, text: line }))
}

/** True when text looks like LRC or enhanced word-timed lyrics. */
export function looksLikeTimedLyrics(text: string): boolean {
  return /\[\d{1,2}:\d{2}/.test(text) || /<\d{1,2}:\d{2}/.test(text)
}
