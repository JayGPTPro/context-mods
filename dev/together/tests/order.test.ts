// The mods and Smart PreCompact chained in every order the skills folder can list them. Each
// step does what that mod's row hook does: take the drawing beneath, seat its items with `seat`, or
// draw the shared row itself. The trees are plain data, as a hook receives them from next(e).
// Each mod's own tests check that its real hook calls `seat` this way.
import { describe, expect, test } from 'claude-code/testing'

import { DIVIDER, ROW_KEY, buttonPx, seat } from '../hooks/panel'

type Node = { type: string; props: Record<string, unknown>; children: unknown[] }
const el = (type: string, props: Record<string, unknown>, children: unknown[] = []): Node => ({ type, props, children })
const button = (key: string, label: string) => el('Button', { key, label })
const svg = (alt: string, width: number) => el('Svg', { source: '<svg/>', alt, width, height: 26 })
const spacer = () => el('Box', { flexGrow: 1 })

type Surface = 'desktop' | 'terminal'
type Step = { name: string; draw: (beneath: unknown, surface: Surface, columns: number) => unknown }

/** A mod of the collection: its items into a row beneath, or a shared row of its own above it. */
const mod = (name: string, items: (s: Surface) => Node[], lead: (s: Surface) => Node[] = () => [spacer()]): Step => ({
  name,
  draw: (beneath, surface, columns) => {
    const own = items(surface)
    const px = own.reduce((sum, n) => sum + (n.type === 'Button' ? buttonPx(String(n.props.label)) : Number(n.props.width ?? 0) + 7.9), 0)
    const isDesktop = surface === 'desktop'
    const placed = seat(beneath, own, { px, columns, isDesktop, divider: isDesktop ? svg('', 9) : null })
    if ('tree' in placed) return placed.tree
    return el('Box', { flexDirection: 'column' }, [el('Box', { key: ROW_KEY, flexDirection: 'row' }, [...lead(surface), ...placed.carry, ...own]), placed.beneath])
  },
})

const TLDR = mod('tldr', () => [button('tldr-off', '↩ No TL;DR')])
// Smart PreCompact's own row, with the rows beneath under it.
const SPC: Step = {
  name: 'smart-precompact',
  draw: beneath =>
    el('Box', { key: 'spc-stack', flexDirection: 'column' }, [
      el('Box', { key: 'spc-band', flexDirection: 'row' }, [svg('Smart PreCompact', 190), spacer(), button('compact', 'Smart compact'), button('hide', 'Hide')]),
      beneath,
    ]),
}

const orders = <T>(items: readonly T[]): T[][] =>
  items.length <= 1 ? [[...items]] : items.flatMap((item, i) => orders([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]))

/** The drawing with `order` chained, first outermost: the innermost draws first. */
const chain = (order: Step[], surface: Surface, columns = 140) =>
  [...order].reverse().reduce<unknown>((beneath, step) => step.draw(beneath, surface, columns), el('Box', { key: 'engine-band' }))

/** Every row that holds a button, its buttons' labels in order. */
const rows = (node: unknown, out: string[][] = []): string[][] => {
  if (node === null || typeof node !== 'object') return out
  const n = node as Node
  const labels = (n.children ?? []).filter(c => (c as Node)?.type === 'Button').map(c => String((c as Node).props.label))
  if (labels.length > 0) out.push(labels)
  for (const child of n.children ?? []) rows(child, out)
  return out
}
const count = (tree: unknown, needle: string) => JSON.stringify(tree).split(needle).length - 1
const sorted = (labels: string[]) => [...labels].sort()
const MODS = [TLDR]
const MOD_BUTTONS = ['↩ No TL;DR']

describe('the mods, no Smart PreCompact', () => {
  test('every order, both surfaces: one shared row with every button', () => {
    for (const order of orders(MODS)) {
      for (const surface of ['desktop', 'terminal'] as const) {
        const tree = chain(order, surface)
        const name = `${surface}: ${order.map(s => s.name).join(' > ')}`
        expect(rows(tree), name).toEqual([rows(tree)[0] ?? []])
        expect(sorted(rows(tree)[0] ?? []), name).toEqual(sorted(MOD_BUTTONS))
        expect(count(tree, `"${ROW_KEY}"`), name).toBe(1)
        expect(count(tree, '"engine-band"'), name).toBe(1)
      }
    }
  })
})

describe('with Smart PreCompact', () => {
  test('desktop, every order: one row, unless Smart PreCompact is outer of every mod', () => {
    for (const order of orders([...MODS, SPC])) {
      const tree = chain(order, 'desktop')
      const name = order.map(s => s.name).join(' > ')
      if (order[0] === SPC) {
        // Nothing outer of it is left to fold the shared row in: two rows, each whole.
        expect(rows(tree), name).toEqual([['Smart compact', 'Hide'], rows(tree)[1] ?? []])
        expect(sorted(rows(tree)[1] ?? []), name).toEqual(sorted(MOD_BUTTONS))
      } else {
        const [only] = rows(tree)
        expect(rows(tree).length, name).toBe(1)
        expect(sorted(only ?? []), name).toEqual(sorted([...MOD_BUTTONS, 'Smart compact', 'Hide']))
        expect((only ?? []).slice(-2), name).toEqual(['Smart compact', 'Hide'])
        expect(count(tree, `"${ROW_KEY}"`), name).toBe(0)
        // One hairline, between the collection's buttons and Smart PreCompact's.
        expect(count(tree, '"alt":""'), name).toBe(1)
      }
      expect(count(tree, '"engine-band"'), name).toBe(1)
    }
  })

  test('terminal, every order: Smart PreCompact keeps its row, the mods share one', () => {
    for (const order of orders([...MODS, SPC])) {
      const tree = chain(order, 'terminal')
      const name = order.map(s => s.name).join(' > ')
      expect(rows(tree).length, name).toBe(2)
      expect(rows(tree).map(sorted), name).toContainEqual(sorted(MOD_BUTTONS))
      expect(rows(tree), name).toContainEqual(['Smart compact', 'Hide'])
    }
  })

  test('a narrow desktop window: Smart PreCompact\'s row is left whole, the mods share one row', () => {
    for (const order of orders([...MODS, SPC])) {
      const tree = chain(order, 'desktop', 50)
      const name = order.map(s => s.name).join(' > ')
      expect(rows(tree), name).toContainEqual(['Smart compact', 'Hide'])
      expect(rows(tree).map(sorted), name).toContainEqual(sorted(MOD_BUTTONS))
    }
  })

  test('desktop, every width from 40 to 200 columns, every order: the mods never split over two rows', () => {
    for (let columns = 40; columns <= 200; columns += 1) {
      for (const order of orders([...MODS, SPC])) {
        const tree = chain(order, 'desktop', columns)
        const name = `${columns} columns: ${order.map(s => s.name).join(' > ')}`
        const holding = rows(tree).filter(row => row.some(label => MOD_BUTTONS.includes(label)))
        expect(holding.length, name).toBe(1)
        expect(sorted((holding[0] ?? []).filter(label => MOD_BUTTONS.includes(label))), name).toEqual(sorted(MOD_BUTTONS))
        expect(rows(tree), name).toContainEqual(expect.arrayContaining(['Smart compact', 'Hide']))
        expect(count(tree, '"engine-band"'), name).toBe(1)
        expect(count(tree, '"alt":""'), name).toBeLessThanOrEqual(1)
      }
    }
  })

  test('the divider markup is the one Smart PreCompact\'s row is told apart by', () => {
    expect(DIVIDER).toContain('width="9"')
  })
})
