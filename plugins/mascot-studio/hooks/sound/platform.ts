export type Os = 'windows' | 'macos' | 'linux' | 'other'

/** Windows by its environment; otherwise whatever `uname -s` says. */
export async function detectOs(osEnv: string | undefined, uname: () => Promise<string>): Promise<Os> {
  if (osEnv === 'Windows_NT') return 'windows'
  try {
    const name = (await uname()).trim()
    if (name === 'Darwin') return 'macos'
    if (name === 'Linux') return 'linux'
  } catch {
    // no uname: not a platform with a backend
  }
  return 'other'
}
