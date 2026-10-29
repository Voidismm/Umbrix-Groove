/** Audio file extensions Umbrix Groove knows how to index. */
export const AUDIO_EXTENSIONS = [
  'mp3',
  'flac',
  'wav',
  'wave',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wma',
  'aiff',
  'aif',
  'alac'
] as const

export type AudioExtension = (typeof AUDIO_EXTENSIONS)[number]
