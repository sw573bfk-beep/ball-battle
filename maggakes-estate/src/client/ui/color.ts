import { h } from './dom';

/** Preset swatches plus a "🎨 Any colour" picker. */
/**
 * A row of preset swatches plus a "🎨 any colour" picker.
 * The row updates its own highlight, so callers don't need to re-render.
 * While the colour picker is being dragged `live` is true; the final pick has live = false.
 */
export function colorRow(value: string | undefined, presets: string[], onPick: (c: string, live?: boolean) => void): HTMLElement {
  const row = h('div.row.colors');
  const input = h<HTMLInputElement>('input.anycolor', { type: 'color', value: value ?? presets[0] ?? '#ff6f91', title: 'Pick any colour' });
  const swatches: [string, HTMLElement][] = [];
  const dot = h('span.dot');
  const label = h('label.anylabel', { title: 'Any colour' }, dot, '🎨', input);
  const show = (v: string | undefined) => {
    const lv = v?.toLowerCase();
    for (const [c, el] of swatches) el.classList.toggle('on', lv === c.toLowerCase());
    const custom = !!v && !presets.some((c) => c.toLowerCase() === lv);
    label.classList.toggle('on', custom);
    dot.style.background = custom ? v! : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)';
  };
  input.oninput = () => { show(input.value); onPick(input.value, true); };
  input.onchange = () => { show(input.value); onPick(input.value, false); };
  for (const c of presets) {
    const el = h('button.swatch', { style: { background: c }, title: c, onclick: () => { show(c); input.value = c; onPick(c, false); } });
    swatches.push([c, el]);
    row.append(el);
  }
  row.append(label);
  show(value);
  return row;
}

export const CLOTH_COLORS = ['#ffffff', '#111111', '#f6a6c8', '#ff6f91', '#d7263d', '#ff9f1c', '#ffd23f', '#9bd36a', '#4fd1c5', '#6aa7e8', '#1f3b5c', '#9b7ede', '#c9b79a', '#7a5230'];
