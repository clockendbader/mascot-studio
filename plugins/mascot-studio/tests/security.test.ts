import { test, expect, describe } from 'claude-code/testing'
import { firstLine, targetOf } from '../hooks/activity'
import { needsYouText, notifiedText } from '../hooks/alerts'
import { parsePlayerctlLine } from '../hooks/sound/linux'
import { parseAppleScript } from '../hooks/sound/macos'
import { appName, parseSmtcLine } from '../hooks/sound/windows'
import { plainText } from '../hooks/text'
import { themeFor } from '../hooks/themes'
import { LineBuffer } from '../hooks/sound/supervisor'
import { answerEngine } from './harness'

const ESC = '\u001b'
const BEL = '\u0007'

describe('plainText keeps outside text from steering the terminal', () => {
  test('drops colour codes and other CSI sequences', () => {
    expect(plainText(`${ESC}[31mnpm ERR!${ESC}[0m 3 failed`)).toBe('npm ERR! 3 failed')
    expect(plainText(`a${ESC}[2J${ESC}[1;1Hb`)).toBe('ab')
    expect(plainText('a\u009b31mb')).toBe('ab')
  })

  test('drops OSC sequences, ended by BEL or ST', () => {
    expect(plainText(`copy ${ESC}]52;c;SGVsbG8=${BEL}done`)).toBe('copy done')
    expect(plainText(`${ESC}]8;;https://x.example${ESC}\\link${ESC}]8;;${ESC}\\`)).toBe('link')
    expect(plainText(`${ESC}]0;title`)).toBe('')
  })

  test('drops other controls and bidi overrides, keeps a tab as a space', () => {
    expect(plainText(`a${BEL}b\u0000c\u007fd\u0085e`)).toBe('abcde')
    expect(plainText('a\tb\rc')).toBe('a bc')
    expect(plainText('safe\u202eexe.txt\u2066')).toBe('safeexe.txt')
    expect(plainText(`${ESC}c${ESC}7x`)).toBe('x')
  })

  test('leaves ordinary text alone', () => {
    expect(plainText('Beyoncé · 日本語 🎵 — ok')).toBe('Beyoncé · 日本語 🎵 — ok')
  })
})

describe('text from tools and players reaches the pane plain', () => {
  test('a failure line and a tool target', () => {
    expect(firstLine(`${ESC}[31mnpm ERR!${ESC}[0m boom\nmore`)).toBe('npm ERR! boom')
    expect(targetOf({ command: `echo ${ESC}]52;c;SGVsbG8=${BEL}hi` })).toBe('echo hi')
  })

  test('the instant messages', () => {
    expect(needsYouText(`Ba${ESC}[2Jsh`, `rm ${ESC}[31m-rf${BEL}`)).not.toMatch(/[\u0000-\u001f]/)
    expect(notifiedText(`needs ${ESC}]0;x${BEL}you`)).toContain('needs you')
  })

  test('song titles, artists and app names', () => {
    const windows = parseSmtcLine(`{"app":"Spotify.exe","title":"\\u001b[2JEvil\\u0007","artist":"A\\u001b]0;t\\u0007B","status":"Playing"}`)
    expect(windows).toMatchObject({ track: { title: 'Evil', artist: 'AB' } })
    const linux = parsePlayerctlLine(`Playing\tspot${ESC}[1mify\tA\t${ESC}[31mT`)
    expect(linux).toMatchObject({ track: { app: 'Spotify', title: 'T', artist: 'A' } })
    expect(parseAppleScript('Music', `playing\tA${ESC}[0m\tT${BEL}`)).toMatchObject({ artist: 'A', title: 'T' })
  })
})

describe('names from outside never reach the prototype', () => {
  test('app and player names', () => {
    expect(appName('constructor.exe')).toBe('Constructor')
    expect(appName('Publisher.App!toString')).toBe('ToString')
    expect(parsePlayerctlLine('Playing\tconstructor\tA\tT')).toMatchObject({ track: { app: 'Constructor' } })
  })

  test('a theme setting', () => {
    expect(themeFor('constructor', 'windows').name).toBe('windows7')
    expect(themeFor('__proto__', 'macos').name).toBe('macos')
  })

  test('/studio words', async ($, on) => {
    answerEngine(on)
    await $.session.start({ cwd: '/work/my-project' } as never)
    for (const word of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(await $.command.run({ command: 'studio', args: word } as never)).toMatchObject({ text: expect.stringContaining('Try /studio') })
    }
    expect(await $.command.run({ command: 'studio', args: 'theme constructor' } as never)).toMatchObject({ text: expect.stringContaining('Themes:') })
  })
})

test('the pane title keeps only the folder name, plain', async ($, on) => {
  const { rec } = answerEngine(on)
  await $.session.start({ cwd: `/work/${ESC}]0;pwned${BEL}proj` } as never)
  expect(rec.titles).toEqual(['Clawd Studio · proj'])
})

describe('outside text has a size limit', () => {
  test('an endless line from a helper is dropped, and the next line still reads', () => {
    const buffer = new LineBuffer()
    expect(buffer.push('x'.repeat(70_000))).toEqual([])
    expect(buffer.push('x'.repeat(70_000))).toEqual([])
    expect(buffer.push('y\nok\n')).toEqual(['ok'])
  })

  test('song titles and artists are cut to 200 characters', () => {
    const long = 'a'.repeat(1000)
    const s = parseSmtcLine(JSON.stringify({ app: 'Spotify.exe', title: long, artist: long, status: 'Playing' }))
    expect(s).toMatchObject({ track: { title: 'a'.repeat(199) + '…', artist: 'a'.repeat(199) + '…' } })
    expect(parsePlayerctlLine(`Playing\tspotify\t${long}\t${long}`)).toMatchObject({ track: { title: 'a'.repeat(199) + '…' } })
    expect(parseAppleScript('Music', `playing\t${long}\t${long}`)).toMatchObject({ artist: 'a'.repeat(199) + '…' })
  })
})
