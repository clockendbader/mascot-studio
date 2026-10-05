export type Opener = 'startup' | 'person' | null

declare module 'claude-code' {
  interface PluginState {
    'mascot-studio': {
      opener: Opener
    }
  }
}
