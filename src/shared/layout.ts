// UnityUI ships components but no layout primitives, so Stack and Grid are
// plain flexbox and CSS grid built on UnityUI's 4px spacing scale. The renderer
// and the JSX export use the same mapping, so the exported code looks the same.

import type { NodeOf } from './catalog.js';

export const GAP_PX = { none: 0, sm: 8, md: 16, lg: 24, xl: 40 } as const;

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const;
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const;

export function stackStyle(props: NodeOf<'Stack'>['props']): Record<string, string | number> {
  return {
    display: 'flex',
    flexDirection: props.direction === 'horizontal' ? 'row' : 'column',
    gap: GAP_PX[props.gap],
    alignItems: ALIGN[props.align],
    justifyContent: JUSTIFY[props.justify],
    ...(props.wrap ? { flexWrap: 'wrap' } : {}),
  };
}

export function gridStyle(props: NodeOf<'Grid'>['props']): Record<string, string | number> {
  // At most `columns` per row; each column is at least 200px wide, so the grid
  // drops to fewer columns on narrow screens instead of squeezing them.
  const columns = Number(props.columns);
  const gap = GAP_PX[props.gap];
  const share = `(100% - ${(columns - 1) * gap}px) / ${columns}`;
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, max(200px, ${share})), 1fr))`,
    gap,
  };
}
