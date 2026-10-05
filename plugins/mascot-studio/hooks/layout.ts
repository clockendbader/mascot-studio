export const MIN_COLS = 32

export type LayoutV2 = { tooNarrow: boolean; content: number; stageCols: number }

const FIXED_ROWS = 16 // title chrome 2, tabs 1, Stage 12, status 1
const CONTENT_MIN = 4
const CONTENT_MAX = 8

/** Title, tabs, Stage and status are fixed; the tab content takes what is left, 4 to 8 rows. */
export function layoutV2(cols: number, rows: number): LayoutV2 {
  return {
    tooNarrow: cols < MIN_COLS,
    content: Math.max(CONTENT_MIN, Math.min(CONTENT_MAX, rows - FIXED_ROWS)),
    stageCols: cols - 2,
  }
}
