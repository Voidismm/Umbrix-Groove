import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

type DemoTrack = {
  fileName: string
  freq: number
  seconds: number
}

const DEMO_TRACKS: DemoTrack[] = [
  { fileName: '01 - Midnight Corridor - Umbrix Demo.wav', freq: 220, seconds: 8 },
  { fileName: '02 - Candlelight Stairs - Umbrix Demo.wav', freq: 277.18, seconds: 7 },
  { fileName: '03 - Velvet Rain - Umbrix Demo.wav', freq: 329.63, seconds: 9 },
  { fileName: '04 - Hollow Moon - Umbrix Demo.wav', freq: 174.61, seconds: 10 },
  { fileName: '05 - Gilded Quiet - Umbrix Demo.wav', freq: 392, seconds: 6 }
]

function writeWav(
  filePath: string,
  freq: number,
  seconds: number,
  volume = 0.22
): void {
  const sampleRate = 44100
  const numSamples = Math.floor(sampleRate * seconds)
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const env = Math.min(1, t * 8) * Math.min(1, (seconds - t) * 4)
    const sample = Math.sin(2 * Math.PI * freq * t) * volume * env
    buffer.writeInt16LE(
      Math.max(-32767, Math.min(32767, Math.floor(sample * 32767))),
      44 + i * 2
    )
  }

  writeFileSync(filePath, buffer)
}

/**
 * Ensures a playable demo library exists under the app userData folder.
 * This avoids depending on the project working directory in Electron.
 */
export function ensureDemoLibrary(): string {
  const dir = join(app.getPath('userData'), 'demo-library')
  mkdirSync(dir, { recursive: true })

  for (const track of DEMO_TRACKS) {
    const filePath = join(dir, track.fileName)
    if (!existsSync(filePath)) {
      writeWav(filePath, track.freq, track.seconds)
    }
    const lrcPath = filePath.replace(/\.wav$/i, '.lrc')
    writeFileSync(lrcPath, buildDemoLrc(track.fileName, track.seconds), 'utf8')
  }

  return dir
}

function buildDemoLrc(fileName: string, seconds: number): string {
  const title = fileName.replace(/\.wav$/i, '')
  const lines = [
    `[ti:${title}]`,
    '[ar:Umbrix Demo]',
    '[al:Umbrix Demo Library]',
    '[00:00.00]Soft tone rising in the dark',
    '[00:01.50]Gold dust on a quiet stair',
    '[00:03.00]No stream — just your own air',
    '[00:04.50]Umbrix keeps the candle there'
  ]
  if (seconds >= 7) {
    lines.push('[00:06.00]Let the corridor unwind')
  }
  if (seconds >= 8) {
    lines.push('[00:07.20]Local music, local mind')
  }
  return `${lines.join('\n')}\n`
}
