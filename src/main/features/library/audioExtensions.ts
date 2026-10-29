import { AUDIO_EXTENSIONS } from '../../../shared/constants'

const EXTENSION_SET = new Set(AUDIO_EXTENSIONS.map((ext) => `.${ext}`))

export function isAudioFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot < 0) return false
  return EXTENSION_SET.has(lower.slice(dot))
}
