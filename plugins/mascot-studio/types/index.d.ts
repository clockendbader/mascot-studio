export type Opener = 'startup' | 'person' | null
export type Hat = 'beanie' | 'pumpkin' | 'santa' | 'party' | 'heart'

declare module 'claude-code' {
  interface PluginState {
    'mascot-studio': {
      opener: Opener
    }
  }
}
