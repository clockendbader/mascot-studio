// Prints the AppleScript the macOS backend sends to Music, so CI can prove it
// compiles: `watch` (the now-playing poll) or `control` (play/pause).

import { appScript, controlScript } from '../plugins/mascot-studio/hooks/sound/macos'

const which = process.argv[2] ?? 'watch'
console.log(which === 'control' ? controlScript('Music', 'play-pause') : appScript('Music'))
