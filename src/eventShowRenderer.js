// All scenes are local, deterministic canvas graphics. No network; the only live input is the local date in the banner.
import { LIBERTY_CHARS, LIBERTY_TINTS } from './libertyAscii.js'

const W = 1440
const H = 900
const INK = '#050a0d'
const GREEN = '#ccff8b'
const CYAN = '#6fe7e7'
const MUTED = '#638387'
const PINK = '#ee89ba'
const FUCHSIA = '#ff4fd8'
const FONT = 'Unifont, monospace'

const GLYPHS = {
  S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
  P: ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
  R: ['11110', '11011', '11011', '11110', '11100', '11010', '11011'],
  A: ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
  W: ['11011', '11011', '11011', '11011', '11111', '11111', '01010'],
  L: ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
}
const LOGO = Array.from({ length: 7 }, (_, row) => [...'SPRAWL'].map(letter => GLYPHS[letter][row]).join('0'))
const POINTS = []
LOGO.forEach((row, y) => [...row].forEach((pixel, x) => {
  if (pixel !== '1') return
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      for (const z of [-24, 24]) POINTS.push([(x - 17) * 26 + sx * 8, (y - 3) * 26 + sy * 8, z])
    }
  }
}))

export const SCENES = [
  { name: 'LIBERTY.EXE / SEAL OF THE CITY', duration: 30, draw: liberty },
  { name: 'ASCII / ROTATION STUDY', duration: 26, draw: ascii },
  { name: 'MANHATTAN / NIGHT SIGNAL', duration: 24, draw: skyline },
  { name: 'SPRAWL.EXE / DESKTOP SESSION', duration: 32, draw: desktop },
  { name: 'FIVE BOROUGHS / SIGNAL TRACKING', duration: 24, draw: subway },
  { name: 'AFTER HOURS / TERMINAL SESSION', duration: 26, draw: terminal },
  { name: 'NEUROMANCER / NEW YORK CONSTRUCT', duration: 32, draw: neuromancer },
  { name: 'RADIO FREQUENCY / SPECTRUM WATERFALL', duration: 26, draw: spectrum },
  { name: 'PHYSICAL LAYER / PIN TUMBLER', duration: 28, draw: lockpick },
  { name: 'HARDWARE / UART DEBUG PORT', duration: 26, draw: hardware },
  { name: 'GAME OF LIFE / GLIDER GUN', duration: 26, draw: life },
]
// Scene eyebrows number themselves from their position in SCENES.
const sceneNumber = draw => String(SCENES.findIndex(scene => scene.draw === draw) + 1).padStart(2, '0')
export const LOOP_DURATION = SCENES.reduce((total, scene) => total + scene.duration, 0)

export function sceneAt(seconds) {
  let time = ((seconds % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION
  for (let index = 0; index < SCENES.length; index++) {
    if (time < SCENES[index].duration) return { index, time, scene: SCENES[index] }
    time -= SCENES[index].duration
  }
}

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
function today() {
  const date = new Date()
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function text(ctx, value, x, y, size = 18, color = CYAN, align = 'left') {
  ctx.font = `${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillText(value, x, y)
}
function line(ctx, x1, y1, x2, y2, color = MUTED, width = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
function box(ctx, x, y, w, h, fill, stroke) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h) }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h) }
}
function dot(ctx, x, y, radius, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}
function polyline(ctx, points, color, width) {
  ctx.beginPath()
  points.forEach(([x, y], n) => n ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)
const layerCache = new Map()
// Paints a static layer once per scale into an offscreen bitmap and draws that each frame.
// Until the bundled font is ready it paints directly, so a fallback font is never baked in.
function cachedLayer(ctx, key, x, y, width, height, paint) {
  if (typeof document !== 'undefined' && !document.fonts.check(`16px ${FONT}`)) {
    paint(ctx)
    return null
  }
  const scale = ctx.getTransform().a
  const id = `${key}@${scale}`
  let layer = layerCache.get(id)
  if (!layer) {
    const canvas = new OffscreenCanvas(Math.ceil(width * scale), Math.ceil(height * scale))
    const context = canvas.getContext('2d')
    context.scale(scale, scale)
    context.translate(-x, -y)
    paint(context)
    layer = { scale, canvas, x, y }
    layerCache.set(id, layer)
    // Resizes leave old scales behind; keep only the most recent few bitmaps.
    if (layerCache.size > 16) layerCache.delete(layerCache.keys().next().value)
  }
  ctx.drawImage(layer.canvas, x, y, layer.canvas.width / scale, layer.canvas.height / scale)
  return layer
}
function noise(seed) {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return n - Math.floor(n)
}
function logo(ctx, x, y, cell, color, character = '#') {
  LOGO.forEach((row, r) => [...row].forEach((pixel, c) => {
    if (pixel === '1') text(ctx, character, x + c * cell, y + r * cell, cell * 1.65, color)
  }))
}
function caption(ctx, eyebrow, title, subtitle) {
  text(ctx, eyebrow, 64, 128, 18, GREEN)
  text(ctx, title, 60, 162, 72, '#e0efec')
  text(ctx, subtitle, 64, 248, 20, MUTED)
}

export function drawShow(ctx, width, height, seconds, { fades = true } = {}) {
  if (!width || !height) return
  const { index, time, scene } = sceneAt(seconds)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  box(ctx, 0, 0, width, height, INK)
  const scale = Math.min(width / W, height / H)
  ctx.save()
  ctx.translate((width - W * scale) / 2, (height - H * scale) / 2)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()
  // Slow fades keep the loop comfortable on a large projection screen; a locked scene loops with a hard cut.
  ctx.globalAlpha = fades ? Math.min(1, time / 0.8, (scene.duration - time) / 0.8) : 1
  scene.draw(ctx, time)
  ctx.globalAlpha = 1
  box(ctx, 0, 0, W, 78, INK)
  text(ctx, 'S P R A W L', 48, 29, 24, GREEN)
  text(ctx, 'NYC HACKER COMMUNITY', 262, 33, 16, MUTED)
  text(ctx, today(), W / 2, 33, 16, '#c3d9d5', 'center')
  text(ctx, 'AFTER HOURS TRANSMISSION', W - 48, 33, 16, CYAN, 'right')
  line(ctx, 48, 77, W - 48, 77, '#274047')
  box(ctx, 0, 813, W, 87, INK)
  line(ctx, 48, 814, W - 48, 814, '#274047')
  text(ctx, `${String(index + 1).padStart(2, '0')} / ${String(SCENES.length).padStart(2, '0')}   ${scene.name}`, 48, 839, 16, MUTED)
  text(ctx, 'MEET PEOPLE. SHARE KNOWLEDGE. STAY CURIOUS.', W - 48, 839, 16, GREEN, 'right')
  for (let i = 0; i < SCENES.length; i++) {
    box(ctx, 48 + i * 36, 876, 26, 2, i === index ? GREEN : '#274047')
  }
  // Subtle static CRT texture; no rapid flashes or random full-screen glitches.
  for (let y = 0; y < H; y += 4) box(ctx, 0, y, W, 1, '#00000019')
  ctx.restore()
}

function ascii(ctx, t) {
  text(ctx, `${sceneNumber(ascii)}   /   THE CITY IS A COMPUTER`, 64, 128, 18, GREEN)
  text(ctx, '40.7128° N     74.0060° W', W - 64, 128, 18, MUTED, 'right')
  for (let i = 0; i < 180; i++) {
    const depth = ((noise(i + 4) + t * 0.045) % 1)
    const x = 720 + Math.cos(i * 2.4) * depth * 1000
    const y = 440 + Math.sin(i * 2.4) * depth * 420
    text(ctx, i % 5 ? '.' : '+', x, y, 10 + depth * 10, i % 6 ? '#24464b' : MUTED)
  }
  // The extrusion rotates in 3D; squared timing dwells on the readable front.
  const cycle = (t % 13) / 13
  const angle = Math.PI * 2 * (cycle < 0.24 ? 0 : (cycle - 0.24) / 0.76)
  const tilt = Math.sin(t * 0.35) * 0.13
  const points = POINTS.map(([x, y, z]) => {
    const rx = x * Math.cos(angle) + z * Math.sin(angle)
    const rz = -x * Math.sin(angle) + z * Math.cos(angle)
    const ry = y * Math.cos(tilt) - rz * Math.sin(tilt)
    const perspective = 1150 / (1150 + rz)
    return { x: 710 + rx * perspective * 1.2, y: 427 + ry * perspective * 1.2, z: rz, front: z > 0 }
  }).sort((a, b) => b.z - a.z)
  for (const p of points) {
    text(ctx, p.front ? '#' : ':', p.x, p.y, 13, p.front ? GREEN : '#328f87')
  }
  ctx.strokeStyle = '#254b50'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.ellipse(720, 642, 300 + i * 70, 22 + i * 10, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  text(ctx, 'S P R A W L . N Y C', 720, 703, 30, '#e0efec', 'center')
  text(ctx, 'SECURITY  /  SYSTEMS  /  PEOPLE', 720, 749, 18, MUTED, 'center')
  text(ctx, `ROT.Y  ${String(Math.floor(angle * 180 / Math.PI)).padStart(3, '0')}°`, 64, 748, 16, GREEN)
  text(ctx, 'RENDER: ASCII / 3D', W - 64, 748, 16, MUTED, 'right')
}

// ASCII New York: an 8x16 character grid built once, then cached as a bitmap at the current scale.
const CELL_W = 8
const CELL_H = 16
const CITY_COLS = W / CELL_W
const CITY_ROWS = 46
const CITY_Y = 80
const STREET = 38
const DECK = 32
const BRIDGE_TOWERS = [116, 160]
const BUILDING_BG = '#060b12'
const AMBER = '#e8c46a'
const STONE = '#c7bda4'
const cellX = col => col * CELL_W
const cellY = row => CITY_Y + row * CELL_H

function buildCity() {
  const cells = Array.from({ length: CITY_ROWS }, () => Array(CITY_COLS).fill(null))
  const lit = []
  const antennas = []
  // A null background keeps whatever is already behind the cell (cables over buildings, say).
  const put = (col, row, ch, fg, bg = BUILDING_BG) => {
    if (col < 0 || col >= CITY_COLS || row < 0 || row >= CITY_ROWS) return
    cells[row][col] = { ch, fg, bg: bg ?? cells[row][col]?.bg ?? null }
  }
  // Writes only the visible characters, leaving whatever is behind the spaces.
  const overlay = (col, row, value, fg) => [...value].forEach((ch, i) => { if (ch !== ' ') put(col + i, row, ch, fg, null) })
  const window = (col, row, on, ch = '#') => {
    put(col, row, on ? ch : '.', on ? AMBER : '#1f3a42')
    if (on) lit.push([col, row])
  }

  // Distant skyline: low-contrast silhouettes with sparse lights.
  for (let col = 0, i = 0; col < CITY_COLS; i++) {
    const width = 5 + Math.floor(noise(i + 300) * 8)
    const top = 17 + Math.floor(noise(i + 340) * 10)
    for (let row = top; row < STREET; row++) {
      for (let c = col; c < col + width; c++) {
        const light = noise(c * 7.3 + row * 13.1) > 0.82
        put(c, row, row === top ? '_' : light ? '.' : ' ', row === top ? '#1d3344' : '#2a4256', '#08111b')
      }
    }
    col += width
  }

  function block(col, width, top, style, extra) {
    for (let row = top; row < STREET; row++) {
      for (let x = 0; x < width; x++) {
        const c = col + x
        const depth = row - top
        const on = noise(c * 3.1 + row * 7.7 + col)
        if (row === top) put(c, row, x === 0 || x === width - 1 ? '.' : '_', '#4b7c84')
        else if (x === 0 || x === width - 1) put(c, row, '|', '#2c535b')
        else if (style === 'glass') {
          const glow = on > 0.86 ? (on > 0.97 ? FUCHSIA : CYAN) : null
          put(c, row, '=', glow || '#17404a')
          if (glow) lit.push([c, row])
        } else if (style === 'brick' && x >= width - 3) {
          // Zigzag fire escape: a landing every third floor, stairs between.
          const step = depth % 3
          const left = x === width - 3
          put(c, row, step === 0 ? '=' : step === (left ? 2 : 1) ? '/' : ' ', '#5d7d82')
        } else if (style === 'brick') {
          if (x % 3 === 0) put(c, row, ' ', null)
          else {
            const pair = noise(col + Math.floor(x / 3) * 5.3 + row * 2.9) > 0.62
            put(c, row, x % 3 === 1 ? '[' : ']', pair ? '#ffb86b' : '#23404a')
            if (pair) lit.push([c, row])
          }
        } else if (x % 2 === 0) put(c, row, ' ', null)
        else window(c, row, on > 0.62)
      }
    }
    if (extra === 'water') {
      overlay(col + 3, top - 3, '_', '#9a876a')
      overlay(col + 2, top - 2, '(_)', '#9a876a')
      overlay(col + 2, top - 1, '/|\\', '#6f6250')
    } else if (extra === 'antenna') {
      const c = col + Math.floor(width / 2)
      overlay(c, top - 1, '|', '#6bb4b9')
      overlay(c, top - 2, '|', '#6bb4b9')
      antennas.push([cellX(c) + 4, cellY(top - 3) + 10])
    }
  }

  ;[
    [0, 9, 18, 'glass'], [10, 11, 20, 'prewar', 'water'], [22, 9, 18, 'glass', 'antenna'], [33, 13, 19, 'prewar', 'water'],
    [47, 9, 21, 'brick', 'antenna'], [57, 13, 17, 'glass', 'antenna'], [71, 11, 20, 'prewar', 'water'], [83, 11, 15, 'glass'],
  ].forEach(spec => block(...spec))
  for (let col = 95, i = 0; col < CITY_COLS; i++) {
    const width = 7 + 2 * Math.floor(noise(i + 500) * 3)
    const style = ['prewar', 'glass', 'brick'][Math.floor(noise(i + 560) * 3)]
    block(col, width, 15 + Math.floor(noise(i + 530) * 11), style, style === 'glass' ? null : noise(i + 590) > 0.5 ? 'water' : null)
    col += width + Math.floor(noise(i + 620) * 2)
  }

  // 432 Park: a thin square grid.
  for (let row = 10; row < STREET; row++) {
    for (let x = -2; x <= 2; x++) {
      if (row === 10) put(118 + x, row, Math.abs(x) === 2 ? '.' : '_', '#8fa7ad')
      else if (Math.abs(x) === 2) put(118 + x, row, '|', '#8fa7ad')
      else window(118 + x, row, noise(x * 9.1 + row * 3.3) > 0.7)
    }
  }

  // Chrysler: sunburst crown of stacked arches, eagle gargoyles, needle spire.
  const chrysler = 106
  for (let row = 21; row < STREET; row++) {
    for (let x = -5; x <= 5; x++) {
      if (Math.abs(x) === 5) put(chrysler + x, row, '|', '#b9c9c7')
      else if (x % 2 === 0) put(chrysler + x, row, '|', '#3c6a73')
      else window(chrysler + x, row, noise(x * 4.7 + row * 1.3) > 0.55)
    }
  }
  for (let x = -5; x <= 5; x++) put(chrysler + x, 20, Math.abs(x) === 5 ? '.' : '_', '#d8e4e2')
  overlay(chrysler - 6, 20, '<', '#d8e4e2')
  overlay(chrysler + 6, 20, '>', '#d8e4e2')
  ;[1, 1, 2, 3, 3, 4, 5].forEach((half, k) => {
    for (let x = -half; x <= half; x++) {
      const edge = x === -half ? '/' : x === half ? '\\' : null
      put(chrysler + x, 13 + k, edge || (k % 2 ? 'v' : '^'), edge ? '#e6f2f0' : k % 2 ? CYAN : '#cfe0de')
    }
  })
  for (let row = 8; row < 13; row++) put(chrysler, row, '|', '#e6f2f0', null)

  // Empire State: setbacks, art deco piers, neon-lit crown and mast.
  const empire = 132
  const sections = [[10, 30], [8, 18], [6, 14], [4, 12], [2, 10]]
  sections.forEach(([half, top], s) => {
    const bottom = s ? sections[s - 1][1] - 1 : STREET - 1
    const neon = s === 2 ? CYAN : s > 2 ? FUCHSIA : null
    for (let row = top; row <= bottom; row++) {
      for (let x = -half; x <= half; x++) {
        const edge = Math.abs(x) === half
        if (row === top) put(empire + x, row, edge ? '.' : '_', '#9fd6da')
        else if (edge) put(empire + x, row, '|', '#9fd6da')
        else if (x % 2 === 0) put(empire + x, row, '|', neon || '#3c6a73')
        else window(empire + x, row, noise(x * 2.3 + row * 5.9) > 0.6)
      }
    }
  })
  for (let row = 4; row < 10; row++) put(empire, row, row < 7 ? '|' : '║', '#cfe8ea', null)

  // One World Trade: a tapering faceted prism.
  const wtc = 164
  for (let row = 2; row < 7; row++) put(wtc, row, '|', '#cfe8ea', null)
  for (let x = -2; x <= 2; x++) put(wtc + x, 7, '[===]'[x + 2], '#9fd6da')
  for (let row = 8, previous = 2; row < STREET; row++) {
    const half = 2 + Math.round((row - 8) / (STREET - 9) * 5)
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) === half
      const ch = edge && half > previous ? (x < 0 ? '/' : '\\') : edge || x === 0 ? '|' : x < 0 ? '/' : '\\'
      put(wtc + x, row, ch, edge ? '#9fd6da' : (row + x) % 3 === 0 ? '#5fb8c8' : '#2b5f6c')
    }
    previous = half
  }

  // Front row: the billboard warehouse, the bodega and the pizza place.
  block(2, 44, 28, 'brick')
  overlay(4, 21, `+${'-'.repeat(38)}+`, '#8a2f78')
  for (let row = 22; row < 26; row++) {
    put(4, row, '|', '#8a2f78', '#0b0612')
    for (let c = 5; c < 43; c++) put(c, row, ' ', null, '#0b0612')
    put(43, row, '|', '#8a2f78', '#0b0612')
  }
  overlay(4, 26, `+${'-'.repeat(38)}+`, '#8a2f78')
  for (let c = 7; c < 42; c += 7) overlay(c, 27, '/\\', '#5d4d6a')
  block(50, 15, 26, 'brick')
  block(68, 16, 28, 'prewar')
  for (let col = 0; col < CITY_COLS; col++) put(col, STREET, '_', '#2c5a62', '#070912')

  // Brooklyn Bridge: deck, catenary cables with suspenders, stone towers with twin gothic arches.
  for (let col = 70; col < CITY_COLS; col++) {
    put(col, DECK, '=', '#d8e4e2')
    put(col, DECK + 1, '-', '#5d7478')
  }
  const cable = (from, to, rowAt) => {
    for (let col = from; col <= to; col++) {
      const row = Math.round(rowAt(col))
      const slope = rowAt(col + 0.5) - rowAt(col - 0.5)
      put(col, row, Math.abs(slope) < 0.35 ? '-' : slope > 0 ? '\\' : '/', '#f2e3b8', null)
      if (col % 2 === 0) for (let r = row + 1; r < DECK; r++) put(col, r, ':', '#46606a', null)
    }
  }
  cable(84, 111, col => 27 + (111 - col) / 27 * 4.5)
  cable(121, 155, col => 27 + 4 * (1 - ((col - 138) / 17.5) ** 2))
  cable(165, CITY_COLS - 1, col => 27 + (col - 165) / 15 * 4)
  const tower = ['[=======]', '|_______|', '|/^\\|/^\\|', '||:|||:||', '||:|||:||', '||:|||:||', '|=======|']
  for (const center of BRIDGE_TOWERS) {
    for (let row = 26; row <= 40; row++) {
      const art = tower[row - 26] || '|:::::::|'
      ;[...art].forEach((ch, i) => put(center - 4 + i, row, ch, ch === ':' ? (row < DECK ? '#46606a' : '#6d6656') : STONE))
    }
  }

  return { cells, lit, antennas, empireTip: [cellX(empire) + 4, cellY(3) + 10], wtcTip: [cellX(wtc) + 4, cellY(1) + 10] }
}

function paintCity(ctx, { cells }) {
  const backgrounds = new Map()
  cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell?.bg) return
    if (!backgrounds.has(cell.bg)) backgrounds.set(cell.bg, new Path2D())
    backgrounds.get(cell.bg).rect(cellX(c), cellY(r), CELL_W, CELL_H)
  }))
  for (const [color, path] of backgrounds) {
    ctx.fillStyle = color
    ctx.fill(path)
  }
  ctx.font = `16px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell || cell.ch === ' ') return
    ctx.fillStyle = cell.fg
    ctx.fillText(cell.ch, cellX(c), cellY(r))
  }))
}

let cityModel = null
function drawCity(ctx) {
  cityModel ??= buildCity()
  cachedLayer(ctx, 'city', 0, CITY_Y, W, CITY_ROWS * CELL_H, context => paintCity(context, cityModel))
}

const RIVER_REFLECTIONS = [[6, 30, FUCHSIA], [47, 51, CYAN], [83, 88, AMBER], [103, 109, '#e6f2f0'], [129, 136, FUCHSIA], [161, 168, CYAN]]

function verticalSign(ctx, col, row, word, color, dim = -1) {
  const x = cellX(col)
  box(ctx, x - 3, cellY(row) - 3, CELL_W + 6, word.length * CELL_H + 6, '#05070f', `${color}88`)
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  ;[...word].forEach((ch, i) => {
    ctx.globalAlpha = i === dim ? 0.35 : 1
    text(ctx, ch, x, cellY(row + i), 16, color)
  })
  ctx.restore()
}

function skyline(ctx, t) {
  const sky = ctx.createLinearGradient(0, 78, 0, 700)
  sky.addColorStop(0, '#05070f')
  sky.addColorStop(0.55, '#0e0b26')
  sky.addColorStop(1, '#2b0c33')
  box(ctx, 0, 78, W, 736, sky)
  const water = ctx.createLinearGradient(0, cellY(STREET + 1), 0, 814)
  water.addColorStop(0, '#0a0b1c')
  water.addColorStop(1, INK)
  box(ctx, 0, cellY(STREET + 1), W, 814 - cellY(STREET + 1), water)
  for (let i = 0; i < 50; i++) text(ctx, i % 7 ? '.' : '+', noise(i + 900) * W, 90 + noise(i + 960) * 300, 12, '#34406a')
  // Searchlights sweep slowly behind the buildings.
  for (const [x0, phase] of [[420, 0], [1240, 2.1]]) {
    const angle = -Math.PI / 2 + Math.sin(t * 0.18 + phase) * 0.38
    const tip = spread => [x0 + Math.cos(angle + spread) * 760, 690 + Math.sin(angle + spread) * 760]
    const beam = ctx.createLinearGradient(x0, 690, ...tip(0))
    beam.addColorStop(0, '#6fe7e726')
    beam.addColorStop(1, '#6fe7e700')
    ctx.beginPath()
    ctx.moveTo(x0, 690)
    ctx.lineTo(...tip(-0.05))
    ctx.lineTo(...tip(0.05))
    ctx.closePath()
    ctx.fillStyle = beam
    ctx.fill()
  }
  caption(ctx, `${sceneNumber(skyline)}   /   ESTABLISHING CONNECTION`, 'THE CITY NEVER IDLES.', 'NEW YORK, NY     /     FIVE BOROUGHS. INFINITE CONNECTIONS.')
  drawCity(ctx)
  const { lit, antennas, empireTip, wtcTip } = cityModel

  // A few windows switch off and on as the night goes on.
  lit.forEach(([col, row], i) => {
    if (noise(i * 3.7) < 0.88 || noise(i + Math.floor(t * 0.6) * 17) < 0.65) return
    box(ctx, cellX(col), cellY(row), CELL_W, CELL_H, BUILDING_BG)
    text(ctx, '.', cellX(col), cellY(row), 16, '#1f3a42')
  })

  ctx.save()
  ctx.globalAlpha *= noise(Math.floor(t * 3) + 77) > 0.94 ? 0.5 : 1
  ctx.shadowColor = FUCHSIA
  ctx.shadowBlur = 18
  text(ctx, 'SPRAWL', 58, 436, 38, FUCHSIA)
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 8
  text(ctx, 'A SIGNAL IN THE NOISE.', 60, 476, 16, CYAN)
  ctx.restore()
  verticalSign(ctx, 48, 27, 'BODEGA', CYAN, noise(Math.floor(t * 2) + 5) > 0.85 ? 3 : -1)
  verticalSign(ctx, 85, 29, 'PIZZA', AMBER)

  // Traffic on the bridge deck: headlights east, tail lights west.
  for (let i = 0; i < 8; i++) {
    const east = i % 2 === 0
    const travel = (noise(i + 40) * 880 + t * (40 + noise(i) * 30)) % 880
    dot(ctx, east ? 560 + travel : 1440 - travel, cellY(DECK) + 7, 2, east ? '#ffe8a8' : '#ff4b3e')
  }
  // Flying cars cross the skyline in both directions.
  for (const [speed, y, offset, east] of [[46, 306, 0, true], [32, 356, 0.5, false]]) {
    const span = W + 200
    const travel = (t * speed + offset * span) % span
    const x = east ? travel - 100 : W + 100 - travel
    text(ctx, east ? '-=[o]>' : '<[o]=-', x, y, 14, CYAN, 'center')
    if (Math.floor(t * 2) % 2 === 0) dot(ctx, x + (east ? -26 : 26), y + 7, 2, FUCHSIA)
  }

  // Fuchsia radio rings from the two tallest masts and the rooftop antennas, drawn as dotted arcs.
  function broadcast(x, y, offset, reach, width) {
    for (let n = 0; n < 4; n++) {
      const phase = (t * 0.25 + offset + n / 4) % 1
      ctx.save()
      ctx.globalAlpha *= (1 - phase) ** 1.6
      ctx.setLineDash([0.1, width * 3])
      ctx.lineCap = 'round'
      ctx.strokeStyle = FUCHSIA
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.arc(x, y, 8 + phase * reach, Math.PI * 1.25, Math.PI * 1.75)
      ctx.stroke()
      ctx.restore()
    }
  }
  antennas.forEach(([x, y], i) => {
    dot(ctx, x, y, 2.5, FUCHSIA)
    broadcast(x, y, i * 0.37, 46, 2)
  })
  for (const [[x, y], offset] of [[empireTip, 0], [wtcTip, 0.5]]) {
    dot(ctx, x, y, 3, FUCHSIA)
    broadcast(x, y, offset, 175, 3)
  }
  const link = f => [
    empireTip[0] + (wtcTip[0] - empireTip[0]) * f,
    (1 - f) ** 2 * empireTip[1] + 2 * (1 - f) * f * 66 + f ** 2 * wtcTip[1],
  ]
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  for (let f = 0; f <= 1.001; f += 0.05) ctx.lineTo(...link(f))
  ctx.strokeStyle = `${FUCHSIA}77`
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])
  for (const f of [(t * 0.18) % 1, 1 - (t * 0.18 + 0.5) % 1]) {
    const [x, y] = link(f)
    dot(ctx, x, y, 7, `${FUCHSIA}2e`)
    dot(ctx, x, y, 2.5, FUCHSIA)
  }

  // East River: ASCII swell with neon reflections; the bridge piers stand clear of the water.
  for (let row = STREET + 1; row < CITY_ROWS; row++) {
    let wave = ''
    for (let col = 0; col < CITY_COLS; col++) {
      const pier = row <= 40 && BRIDGE_TOWERS.some(center => Math.abs(col - center) <= 4)
      const swell = Math.sin(col * 0.37 + row * 1.9 + t * (row % 2 ? 1.1 : -0.8)) + Math.sin(col * 0.11 - t * 0.5 + row)
      wave += pier ? ' ' : swell > 0.9 ? '~' : swell > 0.2 ? '-' : ' '
    }
    text(ctx, wave, 0, cellY(row), 16, row < 42 ? '#2c5a62' : '#1c3a42')
    ctx.save()
    ctx.globalAlpha *= Math.max(0.15, 0.8 - (row - STREET - 1) * 0.11)
    for (const [from, to, color] of RIVER_REFLECTIONS) {
      const shift = Math.round(Math.sin(t * 1.3 + row) * 1.2)
      text(ctx, wave.slice(from + shift, to + shift), cellX(from + shift), cellY(row), 16, color)
    }
    ctx.restore()
  }
  box(ctx, 56, 783, 352, 22, INK)
  text(ctx, 'EAST RIVER   /   40.7061° N   73.9969° W', 64, 786, 14, MUTED)

  for (let i = 0; i < 70; i++) {
    const x = ((noise(i) * W - t * 30) % W + W) % W
    const y = (noise(i + 90) * 720 + t * (110 + noise(i) * 60)) % 720 + 84
    text(ctx, '/', x, y, 14, '#3d667066')
  }
}

function windowFrame(ctx, x, y, w, h, title, fill = '#b6b7bd') {
  box(ctx, x + 12, y + 14, w, h, '#00000080')
  box(ctx, x, y, w, h, fill)
  box(ctx, x + 7, y + 7, w - 14, h - 14, null, '#f0f0d5')
  box(ctx, x + 11, y + 11, w - 22, h - 22, null, '#f0f0d5')
  const titleWidth = title.length * 10 + 28
  box(ctx, x + (w - titleWidth) / 2, y, titleWidth, 25, fill)
  text(ctx, title, x + w / 2, y + 3, 20, '#111340', 'center')
  text(ctx, '[■]', x + 20, y + 3, 20, '#111340')
}

function desktop(ctx, t) {
  box(ctx, 40, 98, 1360, 694, '#090a8a')
  for (let y = 142; y < 773; y += 18) text(ctx, '░ '.repeat(85), 45, y, 16, '#292ca4')
  box(ctx, 40, 98, 1360, 32, '#b6b7bd')
  text(ctx, ' ≡   File   Network   Windows   Help', 52, 103, 22, '#111340')
  text(ctx, 'SPRAWL OS  /  v.0x07', 1368, 105, 18, '#111340', 'right')
  box(ctx, 40, 760, 1360, 32, '#b6b7bd')
  text(ctx, ' F1 Help   F3 Open   F5 Zoom   F10 Menu', 52, 765, 21, '#111340')
  text(ctx, 'DEMO SESSION', 1370, 766, 18, '#111340', 'right')
  windowFrame(ctx, 98, 163, 1210, 233, 'Welcome to the sprawl', '#00a5a7')
  logo(ctx, 322, 207, 20, '#082451', '█')
  text(ctx, 'NEW YORK CITY  /  CYBERSECURITY  /  COMMUNITY', 700, 362, 19, '#082451', 'center')
  windowFrame(ctx, 107, 425, 460, 287, 'C:\\SPRAWL\\')
  const files = ['..             <UP-DIR>', 'BOROUGHS       <DIR>   ', 'SIGNAL   EXE   64,000  ', 'MEETUP   TXT    1,024  ', 'README   NFO    4,096  ', 'NYC      SYS   40,712  ']
  const selection = t < 7 ? 1 : t < 18 ? 2 : 3
  files.forEach((file, i) => {
    if (i === selection) box(ctx, 130, 465 + i * 31, 410, 29, '#080c80')
    text(ctx, file, 142, 467 + i * 31, 22, i === selection ? '#ffff73' : '#111340')
  })
  windowFrame(ctx, 610, 425, 690, 287, 'Network monitor', '#00a5a7')
  text(ctx, 'INTERFACE    STATUS       TRAFFIC', 644, 464, 21, '#082451')
  const boroughs = ['MANHATTAN', 'BROOKLYN ', 'QUEENS   ', 'BRONX    ', 'STATEN IS']
  boroughs.forEach((name, i) => {
    text(ctx, `${name}    ONLINE`, 644, 503 + i * 32, 21, '#082451')
    const bars = 3 + Math.floor((Math.sin(t * 1.4 + i) + 1) * 5)
    text(ctx, '▰'.repeat(bars), 986, 503 + i * 32, 21, '#ffff8a')
  })
  // Scripted desktop actions retain their timing without a simulated pointer.
  if (t > 2 && t < 7) {
    box(ctx, 217, 130, 269, 156, '#b6b7bd', '#111340')
    text(ctx, '  Connect all', 228, 144, 22, '#111340')
    box(ctx, 224, 179, 255, 29, '#080c80')
    text(ctx, '  View routes', 228, 182, 22, '#ffff73')
    text(ctx, '  Diagnostics', 228, 219, 22, '#111340')
    text(ctx, '  Disconnect', 228, 251, 22, '#111340')
  }
  if (t > 10 && t < 18) {
    windowFrame(ctx, 412, 436, 628, 221, 'Execute: SIGNAL.EXE')
    text(ctx, 'Establishing the neighborhood mesh...', 442, 482, 22, '#111340')
    const progress = Math.min(1, (t - 10) / 5)
    box(ctx, 452, 532, 546, 26, '#080c80')
    box(ctx, 452, 532, 546 * progress, 26, '#00a5a7')
    text(ctx, `${Math.floor(progress * 100)}%`, 724, 535, 20, '#ffff73', 'center')
    box(ctx, 785, 584, 150, 33, '#087e79')
    text(ctx, progress === 1 ? '[  OK  ]' : '[ Wait ]', 860, 590, 22, '#fff', 'center')
  }
  if (t > 22 && t < 29) {
    windowFrame(ctx, 362, 418, 718, 270, 'MEETUP.TXT')
    text(ctx, 'You are among your people.', 405, 465, 30, '#111340')
    text(ctx, '> Find a seat. Meet a stranger.', 405, 515, 24, '#111340')
    text(ctx, '> Talks start soon. Stay curious.', 405, 553, 24, '#111340')
    box(ctx, 748, 600, 160, 34, '#087e79')
    text(ctx, '[ Got it ]', 828, 606, 22, '#fff', 'center')
  }
}

const ROUTES = [
  { name: '1', color: '#ed837d', points: [[600, 742], [600, 510], [755, 355], [755, 180]], label: 'BRONX', lx: 790, ly: 194 },
  { name: 'A', color: '#6dc8ec', points: [[690, 755], [690, 535], [865, 360], [1130, 360]], label: 'QUEENS', lx: 1160, ly: 350 },
  { name: 'L', color: '#d5d8d6', points: [[454, 490], [785, 490], [984, 689], [1190, 689]], label: 'BROOKLYN', lx: 1090, ly: 724 },
  { name: 'S', color: '#eac875', points: [[346, 738], [470, 614], [600, 614]], label: 'STATEN ISLAND', lx: 152, ly: 748 },
  { name: '7', color: '#d696e4', points: [[524, 420], [850, 420], [1040, 230], [1200, 230]], label: 'UPLINK / 07', lx: 1090, ly: 184 },
]
function routePosition(points, fraction) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]))
  let distance = fraction * lengths.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i]) {
      const f = distance / lengths[i]
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f]
    }
    distance -= lengths[i]
  }
  return points[points.length - 1]
}
function routeSlice(points, from, to) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]))
  const total = lengths.reduce((a, b) => a + b, 0)
  const slice = [routePosition(points, from)]
  let walked = 0
  for (let i = 1; i < points.length - 1; i++) {
    walked += lengths[i - 1]
    if (walked / total > from && walked / total < to) slice.push(points[i])
  }
  slice.push(routePosition(points, to))
  return { slice, total }
}
// Track-circuit styling after old signal tower boards: lit blocks are occupied,
// and each block entry carries a signal showing stop, approach or clear.
const BLOCKS = 10
const OCCUPIED = '#ff4b3e'
const ASPECTS = { stop: OCCUPIED, approach: '#ffc145', clear: '#4fe08a' }
const trainId = (route, i) => `${route.name}-${String(i * 11 + 2).padStart(2, '0')}`
function subway(ctx, t) {
  for (let x = 48; x < W; x += 32) for (let y = 110; y < 810; y += 32) dot(ctx, x, y, 1, '#173033')
  caption(ctx, `${sceneNumber(subway)}   /   METROPOLITAN AREA NETWORK`, 'LOCAL CONNECTIONS.', 'SIGNAL TRACKING  /  A SUBWAY-INSPIRED NETWORK')
  // Schematic island boundary, deliberately a fictional network rather than a live map.
  ctx.beginPath()
  ctx.moveTo(515, 748); ctx.lineTo(515, 518); ctx.lineTo(739, 294)
  ctx.lineTo(739, 168); ctx.lineTo(819, 168); ctx.lineTo(819, 362)
  ctx.lineTo(635, 546); ctx.lineTo(635, 748); ctx.closePath()
  ctx.fillStyle = '#18333555'; ctx.fill(); ctx.strokeStyle = '#315051'; ctx.stroke()
  const occupancy = ROUTES.map((route, i) => Array.from({ length: 3 }, (_, n) => (t * 0.065 + n / 3 + i * 0.1) % 1))
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  for (const [i, route] of ROUTES.entries()) {
    const trains = occupancy[i]
    const occupied = new Set(trains.map(f => Math.floor(f * BLOCKS)))
    const normal = f => {
      const [ax, ay] = routePosition(route.points, Math.max(0, f - 0.005))
      const [bx, by] = routePosition(route.points, Math.min(1, f + 0.005))
      const length = Math.hypot(bx - ax, by - ay) || 1
      return [-(by - ay) / length, (bx - ax) / length]
    }
    for (let b = 0; b < BLOCKS; b++) {
      const { slice, total } = routeSlice(route.points, b / BLOCKS, (b + 1) / BLOCKS)
      const gap = 3 / total
      const { slice: block } = routeSlice(route.points, b / BLOCKS + (b ? gap : 0), (b + 1) / BLOCKS - (b < BLOCKS - 1 ? gap : 0))
      if (occupied.has(b)) polyline(ctx, slice, `${OCCUPIED}33`, 16)
      polyline(ctx, block, occupied.has(b) ? OCCUPIED : `${route.color}59`, 6)
      // The signal at each block entry protects the block beyond it.
      const aspect = occupied.has(b) ? 'stop' : occupied.has(b + 1) ? 'approach' : 'clear'
      const [x, y] = routePosition(route.points, b / BLOCKS)
      const [nx, ny] = normal(b / BLOCKS)
      line(ctx, x + nx * 5, y + ny * 5, x + nx * 11, y + ny * 11, '#4a6366')
      dot(ctx, x + nx * 15, y + ny * 15, 5, INK)
      dot(ctx, x + nx * 15, y + ny * 15, 3.5, ASPECTS[aspect])
    }
    for (let n = 0; n <= 5; n++) {
      const [x, y] = routePosition(route.points, n / 5)
      dot(ctx, x, y, 5, '#d8e4e2'); dot(ctx, x, y, 2.5, INK)
    }
    for (const f of trains) dot(ctx, ...routePosition(route.points, f), 3, '#fff')
    // Only the tracked train on each line carries an ID tag, to keep the board legible.
    const [x, y] = routePosition(route.points, trains[0])
    const [nx, ny] = normal(trains[0])
    const tx = x - nx * 26
    const ty = y - ny * 26
    line(ctx, x - nx * 4, y - ny * 4, tx, ty, '#4a6366')
    box(ctx, tx - 20, ty - 9, 40, 18, INK, route.color)
    text(ctx, trainId(route, i), tx, ty - 7, 13, route.color, 'center')
    text(ctx, route.label, route.lx, route.ly, 18, route.color)
  }
  box(ctx, 69, 345, 318, 325, '#091215', '#355154')
  text(ctx, 'SPRAWL / TRANSIT AUTHORITY', 89, 366, 18, GREEN)
  if (Math.floor(t) % 2 === 0) dot(ctx, 360, 374, 4, OCCUPIED)
  ROUTES.forEach((route, i) => {
    dot(ctx, 103, 419 + i * 40, 13, route.color)
    text(ctx, route.name, 103, 409 + i * 40, 20, INK, 'center')
    text(ctx, ['UPTOWN LINK', 'CROSS-BOROUGH', 'PEER EXCHANGE', 'HARBOR RELAY', 'NIGHT SERVICE'][i], 131, 410 + i * 40, 17, '#c3d9d5')
    text(ctx, trainId(route, i), 300, 411 + i * 40, 15, MUTED, 'right')
    text(ctx, `B${String(Math.floor(occupancy[i][0] * BLOCKS) + 1).padStart(2, '0')}`, 367, 411 + i * 40, 15, OCCUPIED, 'right')
  })
  line(ctx, 89, 610, 367, 610, '#24393c')
  box(ctx, 89, 630, 18, 6, OCCUPIED)
  text(ctx, 'OCC', 113, 625, 13, MUTED)
  ;[['stop', 'STOP', 165], ['approach', 'APPR', 232], ['clear', 'CLEAR', 302]].forEach(([aspect, label, x]) => {
    dot(ctx, x, 633, 4, ASPECTS[aspect])
    text(ctx, label, x + 10, 625, 13, MUTED)
  })
  text(ctx, 'MANHATTAN', 930, 520, 18, GREEN)
  text(ctx, 'ALL NODES WELCOME.', 930, 550, 16, MUTED)
}

const COMMANDS = [
  { command: 'ssh guest@sprawl.nyc', output: ['Connection established over the neighborhood mesh.', 'Welcome to SPRAWL. No corporate overlords detected.'] },
  { command: 'cat /etc/motd', output: ['A non-corporate technical meetup.', 'Built by the NYC hacker community.', 'Bring your curiosity. Share what you know.'] },
  { command: './boroughs --connect', output: ['[OK] Manhattan     [OK] Brooklyn     [OK] Queens', '[OK] Bronx         [OK] Staten Island', '5 / 5 boroughs connected. The city is listening.'] },
  { command: 'make tonight', output: ['Compiling conversations... done.', 'Linking people and ideas... done.', 'SPRAWL is ready. Talks begin soon.'] },
]
function terminal(ctx, t) {
  caption(ctx, `${sceneNumber(terminal)}   /   ACCESS GRANTED`, 'WELCOME TO THE SPRAWL.', 'LOCAL SESSION  /  GUEST ACCESS  /  ALL CURIOSITIES WELCOME')
  box(ctx, 64, 300, 920, 456, '#07100e', '#35574a')
  box(ctx, 64, 300, 920, 35, '#193127')
  text(ctx, 'guest@sprawl: ~', 84, 308, 18, GREEN)
  text(ctx, 'PTY / 01', 962, 308, 16, MUTED, 'right')
  let y = 355
  COMMANDS.forEach(({ command, output }, i) => {
    const local = t - i * 5.5
    if (local < 0) return
    const count = Math.floor(local * 21)
    text(ctx, '~ $', 85, y, 20, GREEN)
    text(ctx, command.slice(0, count), 133, y, 20, '#e0efec')
    if (count <= command.length && Math.floor(t * 2) % 2 === 0) {
      box(ctx, 133 + Math.min(count, command.length) * 10, y + 2, 10, 20, GREEN)
    }
    y += 24
    if (local > 1.6) output.forEach((entry, j) => {
      if (local > 1.6 + j * 0.35) text(ctx, entry, 85, y, 18, MUTED)
      y += 20
    })
    y += 8
  })
  text(ctx, 'SYSTEM PULSE', 1030, 314, 18, GREEN)
  for (let i = 0; i < 34; i++) {
    const height = 15 + (Math.sin(i * 0.5 + t * 2) + 1) * 35 + noise(i) * 22
    box(ctx, 1030 + i * 9, 469 - height, 5, height, i % 4 ? '#397c67' : GREEN)
  }
  line(ctx, 1030, 483, 1355, 483, '#35574a')
  text(ctx, 'HOST      NEW YORK CITY', 1030, 510, 18, MUTED)
  text(ctx, 'STATUS    MAKING THINGS', 1030, 550, 18, MUTED)
  text(ctx, 'UPTIME    AFTER HOURS', 1030, 590, 18, MUTED)
  text(ctx, 'TRUST     YOUR CURIOSITY', 1030, 630, 18, MUTED)
  text(ctx, '[ YOU BELONG HERE. ]', 1030, 710, 24, PINK)
}

// An abridged passage from the novel; the ellipsis marks the cut. Blank entries are paragraph breaks.
const NEUROMANCER_QUOTE = [
  '“Home was BAMA, the Sprawl,',
  'the Boston-Atlanta Metropolitan Axis.',
  '',
  'Program a map to display frequency of data exchange…',
  '',
  'Manhattan and Atlanta burn solid white.',
  '',
  'Then they start to pulse, the rate of traffic threatening to overload',
  'your simulation. Your map is about to go nova.”',
]
const QUOTE_HIGHLIGHTS = ['Sprawl', 'Manhattan']

function neuromancer(ctx, t) {
  const blue = '#75baff'
  const violet = '#b09aff'
  const glow = ctx.createRadialGradient(720, 393, 20, 720, 393, 640)
  glow.addColorStop(0, '#152c53')
  glow.addColorStop(0.55, '#101529')
  glow.addColorStop(1, INK)
  box(ctx, 0, 78, W, 736, glow)
  text(ctx, `${sceneNumber(neuromancer)}   /   A SIGNAL FROM THE SPRAWL`, 64, 128, 18, violet)
  text(ctx, 'NEUROMANCER', 60, 162, 72, '#e0eaff')
  text(ctx, 'BAMA  /  NEW YORK CONSTRUCT  /  CONSENSUAL HALLUCINATION', 64, 248, 18, blue)
  text(ctx, 'DECK: ONO-SENDAI', W - 64, 173, 18, violet, 'right')
  text(ctx, 'ICE FIELD: ACTIVE', W - 64, 206, 16, MUTED, 'right')

  ctx.save()
  ctx.beginPath()
  ctx.rect(48, 285, W - 96, 506)
  ctx.clip()
  // Travel between wireframe data towers, toward a distant matrix horizon.
  const project = (x, y, z) => [720 + x * 600 / z, 355 + (160 - y) * 600 / z]
  for (let x = -2400; x <= 2400; x += 160) {
    const a = project(x, 0, 2600), b = project(x, 0, 160)
    line(ctx, ...a, ...b, '#254268')
  }
  for (let i = 0; i < 24; i++) {
    const z = 160 + ((i * 110 - t * 70 % 110 + 2640) % 2640)
    line(ctx, ...project(-2400, 0, z), ...project(2400, 0, z), '#254268')
  }
  line(ctx, 48, 355, W - 48, 355, '#3a5b80')
  const towers = Array.from({ length: 36 }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (250 + Math.floor(i / 2) % 3 * 175),
    z: 300 + ((Math.floor(i / 6) * 350 - t * 70 + 4200) % 2100),
    height: 190 + noise(i + 66) * 230,
    color: i % 5 === 0 ? violet : blue,
  })).sort((a, b) => b.z - a.z)
  for (const tower of towers) {
    const { x, z, height, color } = tower
    const corners = [
      [x - 48, 0, z], [x + 48, 0, z], [x + 48, 0, z + 100], [x - 48, 0, z + 100],
      [x - 48, height, z], [x + 48, height, z], [x + 48, height, z + 100], [x - 48, height, z + 100],
    ].map(p => project(...p))
    ctx.save()
    ctx.globalAlpha *= Math.min(1, (z - 300) / 180, (2400 - z) / 300)
    // Transparent faces and stepped crowns suggest Manhattan's Art Deco towers.
    for (const face of [[0, 1, 5, 4], [1, 2, 6, 5], [4, 5, 6, 7]]) {
      ctx.beginPath()
      face.forEach((point, i) => i ? ctx.lineTo(...corners[point]) : ctx.moveTo(...corners[point]))
      ctx.closePath()
      ctx.fillStyle = '#0b1a3599'
      ctx.fill()
    }
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      line(ctx, ...corners[a], ...corners[b], color)
    }
    for (let floor = 35; floor < height; floor += 35) {
      line(ctx, ...project(x - 48, floor, z), ...project(x + 48, floor, z), '#375e8d')
    }
    const crown = [[x - 25, height, z + 50], [x - 25, height + 45, z + 50], [x + 25, height + 45, z + 50], [x + 25, height, z + 50]]
    crown.slice(1).forEach((p, i) => line(ctx, ...project(...crown[i]), ...project(...p), color))
    line(ctx, ...project(x, height + 45, z + 50), ...project(x, height + 85, z + 50), color)
    ctx.restore()
  }
  // A slowly rotating geometric AI core, suspended over the data grid.
  const angle = t * 0.24
  const vertices = [[0, -83, 0], [0, 83, 0], [-65, 0, 0], [0, 0, 65], [65, 0, 0], [0, 0, -65]].map(([x, y, z]) => {
    const rx = x * Math.cos(angle) - z * Math.sin(angle)
    const rz = x * Math.sin(angle) + z * Math.cos(angle)
    const scale = 400 / (400 + rz)
    return [720 + rx * scale, 426 + y * scale + Math.sin(t * 0.7) * 8]
  })
  for (let i = 2; i < 6; i++) {
    line(ctx, ...vertices[0], ...vertices[i], violet)
    line(ctx, ...vertices[1], ...vertices[i], violet)
    line(ctx, ...vertices[i], ...vertices[i === 5 ? 2 : i + 1], blue)
  }
  vertices.forEach(([x, y]) => dot(ctx, x, y, 3, '#d5e8ff'))
  text(ctx, 'W I N T E R M U T E', 720, 539, 16, violet, 'center')
  ctx.restore()

  // A stable reading area; the passage holds, scrolls down slowly, then holds on its last line.
  const panel = '#070d1a'
  box(ctx, 64, 567, 1312, 214, `${panel}f2`, '#35527a')
  box(ctx, 64, 567, 3, 214, violet)
  const windowTop = 575
  const windowHeight = 160
  const heights = NEUROMANCER_QUOTE.map(entry => entry ? 42 : 20)
  // Stop with the "Manhattan and Atlanta" paragraph at the top so the closing lines sit whole.
  const travel = heights.slice(0, NEUROMANCER_QUOTE.findIndex(entry => entry.startsWith('Manhattan'))).reduce((a, b) => a + b, 0)
  const progress = ease((t - 3) / 25)
  ctx.save()
  ctx.beginPath()
  ctx.rect(70, windowTop, 1290, windowHeight)
  ctx.clip()
  let y = windowTop + 8 - progress * travel
  NEUROMANCER_QUOTE.forEach((entry, i) => {
    text(ctx, entry, 100, y, 32, '#e0eaff')
    for (const word of QUOTE_HIGHLIGHTS) {
      const position = entry.indexOf(word)
      if (position === -1) continue
      const x = 100 + ctx.measureText(entry.slice(0, position)).width
      box(ctx, x - 4, y - 1, ctx.measureText(word).width + 8, 35, GREEN)
      text(ctx, word, x, y, 32, INK)
    }
    y += heights[i]
  })
  for (const [edge, from, to] of [[windowTop, 1, 0], [windowTop + windowHeight - 8, 0, 1]]) {
    const fade = ctx.createLinearGradient(0, edge, 0, edge + 8)
    fade.addColorStop(from, `${panel}00`)
    fade.addColorStop(to, panel)
    box(ctx, 70, edge, 1290, 8, fade)
  }
  ctx.restore()
  box(ctx, 1356, windowTop + 4, 2, windowHeight - 8, '#1d2c48')
  const thumb = (windowHeight - 8) * windowHeight / (windowHeight + travel)
  box(ctx, 1356, windowTop + 4 + progress * (windowHeight - 8 - thumb), 2, thumb, violet)
  text(ctx, 'WILLIAM GIBSON  /  NEUROMANCER (1984)', 100, 746, 17, violet)
}

// A fictional 433 MHz capture; the SPRAWL bitmap is painted in as spectrogram art.
const BIN_COUNT = 160
const BIN_WIDTH = 6
const ROW_HEIGHT = 6
const ROWS_PER_SECOND = 6
const LOGO_BIN = 19
const LOGO_STARTS = [2, 13.5].map(seconds => Math.round(seconds * ROWS_PER_SECOND))
const WATERFALL = ['#061015', '#08181e', '#0b2128', '#0f2c33', '#143b40', '#1b4d4f', '#24625d', '#317a6a', '#479374', '#68ad7d', '#94cb84', '#ccff8b']
const frequency = bin => (432.72 + bin * 0.015).toFixed(2)

function logoRow(sample) {
  for (const start of LOGO_STARTS) {
    // Waterfalls scroll downward, so the bottom row of the logo is sent first.
    if (sample >= start && sample < start + 21) return 6 - Math.floor((sample - start) / 3)
  }
  return -1
}
function signalLevel(bin, sample) {
  let level = 0.09 + noise(bin * 1.37 + sample * 91.3) * 0.17 + 0.05 * (1 - ((bin - 80) / 80) ** 2)
  const carrier = 9 + Math.sin(sample * 0.04) * 1.2
  level += 0.62 * Math.exp(-((bin - carrier) ** 2) / 1.2)
  if (sample % 40 >= 5 && sample % 40 < 13) {
    const tone = noise(sample * 3.1) > 0.5 ? 147 : 152
    level += 0.7 * Math.exp(-((bin - tone) ** 2) / 0.8)
  }
  const row = logoRow(sample)
  if (row !== -1) {
    const column = Math.floor((bin - LOGO_BIN) / 3)
    if (column >= 0 && column < LOGO[0].length && LOGO[row][column] === '1') level = 0.8 + noise(bin + sample * 7.1) * 0.2
  } else if (bin > 32 && bin < 68 && noise(Math.floor(sample / 5) + 7) > 0.55) {
    level += 0.2 * Math.min(1, (bin - 32) / 4, (68 - bin) / 4) * (0.6 + noise(bin * 3.3 + sample) * 0.4)
  }
  return Math.min(1, level)
}

function spectrum(ctx, t) {
  caption(ctx, `${sceneNumber(spectrum)}   /   RADIO FREQUENCY`, 'LISTEN TO THE CITY.', 'SOFTWARE-DEFINED RADIO  /  433 MHz ISM BAND  /  RECEIVE ONLY')
  const left = 64
  const width = BIN_COUNT * BIN_WIDTH
  const top = 452
  const rows = 55
  const position = t * ROWS_PER_SECOND
  const head = Math.floor(position)
  const fraction = position - head

  // Spectrum trace: live level plus a dim peak hold over the last two seconds.
  box(ctx, left, 296, width, 116, '#060e12', '#1f3d42')
  for (let i = 1; i < 4; i++) line(ctx, left, 296 + i * 29, left + width, 296 + i * 29, '#132a2e')
  const traceY = level => 404 - level * 98
  const live = []
  const peak = []
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    const now = signalLevel(bin, head) * (1 - fraction) + signalLevel(bin, head + 1) * fraction
    live.push(now)
    let held = now
    for (let back = 1; back < 12; back++) held = Math.max(held, signalLevel(bin, head - back))
    peak.push(held)
  }
  const fill = ctx.createLinearGradient(0, 300, 0, 412)
  fill.addColorStop(0, '#6fe7e766')
  fill.addColorStop(1, '#6fe7e705')
  ctx.beginPath()
  ctx.moveTo(left, 411)
  live.forEach((level, bin) => ctx.lineTo(left + bin * BIN_WIDTH + 3, traceY(level)))
  ctx.lineTo(left + width, 411)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 1.5
  ctx.stroke()
  peak.forEach((level, bin) => box(ctx, left + bin * BIN_WIDTH + 1, traceY(level), 4, 1, '#ccff8b4d'))
  for (const [label, level] of [['-20', 0.95], ['-60', 0.5], ['-100', 0.05]]) text(ctx, label, left + 8, traceY(level) - 8, 12, MUTED)
  const center = left + width / 2
  line(ctx, center, 304, center, 411, PINK)
  text(ctx, '▼ 433.920', center + 6, 300, 14, PINK)
  for (let bin = 0; bin <= BIN_COUNT; bin += 40) {
    const x = left + bin * BIN_WIDTH
    line(ctx, x, 412, x, 420, '#2c5156')
    text(ctx, frequency(bin), x, 425, 13, MUTED, bin === 0 ? 'left' : bin === BIN_COUNT ? 'right' : 'center')
  }

  // Waterfall: newest sample on top, colors batched into one path per level.
  box(ctx, left, top, width, rows * ROW_HEIGHT, WATERFALL[0])
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, width, rows * ROW_HEIGHT)
  ctx.clip()
  const paths = WATERFALL.map(() => new Path2D())
  for (let row = 0; row <= rows; row++) {
    const y = top + (row + fraction) * ROW_HEIGHT
    for (let bin = 0; bin < BIN_COUNT; bin++) {
      const level = Math.min(WATERFALL.length - 1, Math.floor(signalLevel(bin, head - row) * WATERFALL.length))
      if (level) paths[level].rect(left + bin * BIN_WIDTH, y, BIN_WIDTH, ROW_HEIGHT)
    }
  }
  paths.forEach((path, level) => { if (level) { ctx.fillStyle = WATERFALL[level]; ctx.fill(path) } })
  ctx.restore()
  box(ctx, left, top, width, rows * ROW_HEIGHT, null, '#1f3d42')
  for (let second = 0; second <= 9; second += 3) {
    text(ctx, `-${second}s`, left + width + 8, top + second * ROWS_PER_SECOND * ROW_HEIGHT - 6, 12, MUTED)
  }

  const panel = 1080
  box(ctx, panel, 296, 296, 486, '#070f12', '#1f3d42')
  text(ctx, 'RECEIVER', panel + 20, 314, 18, GREEN)
  ;[['FREQ', '433.920 MHz'], ['SPAN', '2.400 MHz'], ['RBW', '15 kHz'], ['GAIN', '32 dB'], ['MODE', 'RX ONLY']].forEach(([key, value], i) => {
    text(ctx, key, panel + 20, 352 + i * 28, 16, MUTED)
    text(ctx, value, panel + 276, 352 + i * 28, 16, '#c3d9d5', 'right')
  })
  line(ctx, panel + 20, 502, panel + 276, 502, '#1f3d42')
  text(ctx, 'SIGNALS OF INTEREST', panel + 20, 518, 18, GREEN)
  const receiving = logoRow(head) !== -1
  const decoded = LOGO_STARTS.some(start => head >= start + 21 && head - start < rows)
  ;[
    ['CW BEACON', frequency(9), CYAN, false],
    ['WIDEBAND', frequency(50), MUTED, false],
    ['KEYFOB FSK', frequency(149.5), '#eac875', false],
    ['SPRAWL', '433.92', GREEN, decoded],
  ].forEach(([name, freq, color, active], i) => {
    const y = 556 + i * 32
    if (active) box(ctx, panel + 12, y - 5, 272, 28, '#ccff8b1f')
    dot(ctx, panel + 26, y + 8, 4, color)
    text(ctx, name, panel + 42, y, 16, active ? GREEN : '#c3d9d5')
    text(ctx, freq, panel + 276, y, 16, MUTED, 'right')
  })
  const status = decoded ? 'PAYLOAD: S P R A W L' : receiving ? 'RECEIVING...' : 'AWAITING BURST...'
  text(ctx, status, panel + 20, 696, 16, decoded ? GREEN : receiving ? CYAN : MUTED)
  text(ctx, '[ THE AIR IS FULL OF SIGNALS. ]', panel + 20, 740, 16, PINK)
}

// An ASCII pin tumbler lock, picked in binding order, in neon colour with glitches on every set pin.
// Static parts sit on an 8x16 character grid; pins, springs and tools move freely between rows.
const SHEAR = 560
const KEY_TIP = 655
const CHAMBER_TOP = 352
const PINS = [
  { x: 296, depth: 30, driver: 62 },
  { x: 416, depth: 16, driver: 70 },
  { x: 536, depth: 40, driver: 58 },
  { x: 656, depth: 22, driver: 66 },
  { x: 776, depth: 34, driver: 60 },
]
const BINDING = [2, 0, 3, 1, 4]
const PICK_START = 2
const PICK_STEP = 3.2
const PICK_DONE = PICK_START + BINDING.length * PICK_STEP
const TURN_START = PICK_DONE + 1.4
const OPEN_TIME = TURN_START + 2.4
const SHRAPNEL = '*+x#@%&$!?'
const setTime = pin => PICK_START + BINDING.indexOf(pin) * PICK_STEP + 2.2

function pickState(t) {
  if (t < PICK_START) return { x: -60 + 170 * ease((t - 0.3) / 1.5), lift: -10, active: -1 }
  if (t >= PICK_DONE) return { x: PINS[BINDING.at(-1)].x - 1000 * ease((t - PICK_DONE) / 1.6), lift: -10, active: -1 }
  const step = Math.floor((t - PICK_START) / PICK_STEP)
  const local = t - PICK_START - step * PICK_STEP
  const pin = PINS[BINDING[step]]
  const from = step ? PINS[BINDING[step - 1]].x : 110
  // Drop below the key pin tips while travelling, then lift until the driver sets.
  const lift = local < 0.8 ? -10
    : local < 2.2 ? -10 + (pin.depth + 10) * ease((local - 0.8) / 1.4)
      : local < 2.4 ? pin.depth
        : pin.depth - (pin.depth + 10) * ease((local - 2.4) / 0.8)
  return { x: from + (pin.x - from) * ease(local / 0.8), lift, active: BINDING[step] }
}

// Housing and plug as ASCII hatching in opposite directions; the open variant tints the plug green.
function paintLockBody(ctx, open) {
  ctx.font = `16px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const inChamber = (col, row) => row >= 17 && row <= 34 && PINS.some(({ x }) => col >= x / 8 - 2 && col <= x / 8 + 1)
  const chamberWall = col => PINS.some(({ x }) => col === x / 8 - 3 || col === x / 8 + 2)
  for (let row = 16; row <= 40; row++) {
    for (let col = 20; col <= 112; col++) {
      const plug = row >= 30 && row <= 38 && col >= 22
      if (inChamber(col, row) || (row >= 35 && row <= 37 && col >= 22 && col <= 109)) continue
      let ch = null
      let color = plug ? (open ? '#2e6b45' : '#1f4f55') : '#22404a'
      if (row === 16 || row === 40) { ch = '='; color = '#7fb0b8' }
      else if (col === 20 || col === 112) { ch = '|'; color = '#7fb0b8' }
      else if (chamberWall(col) && row >= 17 && row <= 34) { ch = '|'; color = '#4f7f88' }
      else if ((row === 34 || row === 38) && col <= 109) { ch = '='; color = plug && open ? '#5fae7a' : '#4f7f88' }
      else if (plug && col === 22) { ch = '|'; color = open ? GREEN : '#7fb0b8' }
      else if (plug ? (col - row + 400) % 4 === 0 : (col + row) % 4 === 0) ch = plug ? '\\' : '/'
      if (!ch) continue
      ctx.fillStyle = color
      ctx.fillText(ch, col * 8, CITY_Y + row * 16)
    }
  }
}

// Copies a horizontal band of what is already on screen sideways, in device pixels.
function tearBand(ctx, y, height, shift) {
  const m = ctx.getTransform()
  const sx = m.e
  const sy = m.f + y * m.d
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(ctx.canvas, sx, sy, W * m.a, height * m.d, sx + shift * m.a, sy, W * m.a, height * m.d)
  ctx.restore()
}

// A stack of glyph rows spread evenly between top and bottom, so pins move smoothly between grid rows.
function glyphColumn(ctx, x, top, bottom, rows, color) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  rows.forEach((row, i) => text(ctx, row, x, top + (bottom - top - 16) * (rows.length > 1 ? i / (rows.length - 1) : 0), 16, color, 'center'))
  ctx.restore()
}

function lockpick(ctx, t) {
  const pick = pickState(t)
  const rotation = ease((t - TURN_START) / 2.4)
  const open = rotation > 0
  const sinceOpen = t - OPEN_TIME
  const glow = ctx.createRadialGradient(540, 540, 20, 540, 540, 620)
  glow.addColorStop(0, '#140b24')
  glow.addColorStop(1, INK)
  box(ctx, 0, 78, W, 736, glow)
  caption(ctx, `${sceneNumber(lockpick)}   /   PHYSICAL LAYER`, 'EVERY LOCK IS A PUZZLE.', 'PIN TUMBLER  /  CROSS-SECTION  /  TENSION, FEEDBACK, PATIENCE')

  cachedLayer(ctx, 'lock-body', 160, 336, 752, 416, context => paintLockBody(context, false))
  if (open) {
    ctx.save()
    ctx.globalAlpha *= rotation
    cachedLayer(ctx, 'lock-body-open', 160, 336, 752, 416, context => paintLockBody(context, true))
    ctx.restore()
  }
  // A few hatch cells are always mid-corruption.
  for (let i = 0; i < 4; i++) {
    const seed = i * 13.7 + Math.floor(t * 5) * 3.3
    const col = 21 + Math.floor(noise(seed) * 91)
    const row = 17 + Math.floor(noise(seed + 1) * 22)
    text(ctx, SHRAPNEL[Math.floor(noise(seed + 2) * SHRAPNEL.length)], col * 8, CITY_Y + row * 16, 16, i % 2 ? FUCHSIA : CYAN)
  }

  PINS.forEach((pin, i) => {
    const active = pick.active === i
    const set = t >= setTime(i)
    const keyBottom = KEY_TIP - (active ? Math.max(0, pick.lift) : 0)
    const keyTop = keyBottom - (KEY_TIP - SHEAR - pin.depth)
    const driverBottom = set ? SHEAR - 3 : keyTop
    const driverTop = driverBottom - pin.driver
    for (let n = 0; n < 9; n++) {
      text(ctx, n % 2 ? '/\\/' : '\\/\\', pin.x, CHAMBER_TOP + (driverTop - CHAMBER_TOP - 14) * n / 8, 14, '#9a7fb0', 'center')
    }
    glyphColumn(ctx, pin.x, driverTop, driverBottom, Array(Math.ceil(pin.driver / 16)).fill('███'), active && !set ? FUCHSIA : CYAN)
    const keyRows = Math.ceil((keyBottom - keyTop) / 16)
    glyphColumn(ctx, pin.x, keyTop, keyBottom, [...Array(keyRows - 1).fill('███'), '\\█/'], AMBER)
    // Feedback when a pin sets: a click and a small burst of sparks off the shear line.
    const since = t - setTime(i)
    if (since > 0 && since < 1) {
      ctx.save()
      ctx.globalAlpha *= 1 - since
      text(ctx, '* CLICK *', pin.x, SHEAR - 150 - since * 24, 16, GREEN, 'center')
      for (let k = 0; k < 18; k++) {
        const angle = noise(i * 100 + k) * Math.PI * 2
        const speed = 60 + noise(i * 100 + k + 50) * 160
        text(ctx, SHRAPNEL[k % SHRAPNEL.length], pin.x + Math.cos(angle) * speed * since, SHEAR + Math.sin(angle) * speed * since, 14, [CYAN, FUCHSIA, AMBER, '#ffffff'][k % 4], 'center')
      }
      ctx.restore()
    }
  })

  ctx.save()
  ctx.shadowColor = open ? GREEN : PINK
  ctx.shadowBlur = 10
  text(ctx, '- '.repeat(48), 144, SHEAR - 8, 16, open ? GREEN : PINK)
  ctx.restore()
  ;[['SPRINGS', 410], ['DRIVER PINS', 500], ['SHEAR LINE', SHEAR], ['KEY PINS', 610], ['KEYWAY', 664]].forEach(([label, y]) => {
    if (label !== 'SHEAR LINE') line(ctx, 912, y, 926, y, '#2c5156')
    text(ctx, label, 932, y - 8, 14, label === 'SHEAR LINE' ? (open ? GREEN : PINK) : MUTED)
  })

  // Tension wrench in the bottom of the keyway; hook pick riding along beneath the pins.
  ctx.save()
  ctx.shadowColor = '#b89bff'
  ctx.shadowBlur = 6
  text(ctx, `┏${'━'.repeat(9)}`, 128, 680, 16, '#b89bff')
  for (let y = 694; y < 776; y += 14) text(ctx, '┃', 128, y, 16, '#b89bff')
  ctx.restore()
  text(ctx, 'TENSION', 146, 760, 14, MUTED)
  ctx.save()
  ctx.beginPath()
  ctx.rect(48, 290, 860, 500)
  ctx.clip()
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 8
  const hookX = pick.x - 4
  const hookTop = KEY_TIP - pick.lift
  text(ctx, '━'.repeat(76), hookX - 8 - 76 * 8, 662, 16, '#f2f6f5')
  text(ctx, '┛', hookX - 4, 662, 16, '#f2f6f5')
  for (let y = 650; y > hookTop - 2; y -= 12) text(ctx, '┃', hookX - 4, y, 16, '#f2f6f5')
  text(ctx, '▐▓▓▓▓▓▓▓▌', hookX - 8 - 76 * 8 - 72, 662, 16, FUCHSIA)
  ctx.restore()

  // Front view: rings of glyphs; the plug, keyway and wrench turn together.
  const cx = 1210
  const cy = 446
  const cam = rotation * Math.PI / 2
  text(ctx, 'FRONT VIEW', cx, 314, 16, GREEN, 'center')
  ctx.font = `14px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#4f7f88'
  for (let k = 0; k < 64; k++) ctx.fillText('#', cx + Math.cos(k / 64 * Math.PI * 2) * 104, cy + Math.sin(k / 64 * Math.PI * 2) * 104)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(cam)
  ctx.fillStyle = open ? GREEN : CYAN
  for (let k = 0; k < 40; k++) ctx.fillText('o', Math.cos(k / 40 * Math.PI * 2) * 68, Math.sin(k / 40 * Math.PI * 2) * 68)
  ctx.fillStyle = '#ffffff'
  ;['[', '|', '<', '|', '>', '|', ']'].forEach((ch, k) => ctx.fillText(ch, 0, -42 + k * 14))
  ctx.fillStyle = AMBER
  ctx.fillText('@', 0, -56)
  ctx.fillStyle = '#b89bff'
  for (let y = 54; y < 100; y += 12) ctx.fillText('┃', 0, y)
  ctx.restore()
  ctx.fillStyle = CYAN
  ctx.fillText('@', cx, cy - 86)
  text(ctx, `PLUG ROT  ${String(Math.round(rotation * 90)).padStart(2, '0')}°`, cx, 566, 16, open ? GREEN : MUTED, 'center')

  const setCount = PINS.filter((_, i) => t >= setTime(i)).length
  text(ctx, open ? 'STATUS: OPEN' : `PINS SET: ${setCount} / ${PINS.length}`, 1060, 610, 18, open ? GREEN : '#c3d9d5')
  PINS.forEach((_, i) => {
    const set = t >= setTime(i)
    const binding = pick.active === i && !set
    const y = 642 + i * 22
    text(ctx, `PIN ${i + 1}`, 1060, y, 16, MUTED)
    text(ctx, `#${BINDING.indexOf(i) + 1}`, 1140, y, 16, '#3f6c72')
    text(ctx, set ? 'SET' : binding ? 'BINDING' : '---', 1376, y, 16, set ? GREEN : binding ? PINK : '#3f6c72', 'right')
  })
  text(ctx, '[ PICK ONLY WHAT YOU OWN. ]', 1060, 766, 16, PINK)

  // The lock opening: ASCII shrapnel off the plug and a shockwave ring.
  if (sinceOpen > 0 && sinceOpen < 2.6) {
    ctx.save()
    ctx.globalAlpha *= Math.min(1, (2.6 - sinceOpen) / 1.3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let k = 0; k < 160; k++) {
      const angle = noise(k * 3.1) * Math.PI * 2
      const travel = (100 + noise(k * 5.7) * 560) * (1 - Math.exp(-sinceOpen * 1.8)) / 1.8
      ctx.font = `${12 + Math.floor(noise(k * 1.9) * 12)}px ${FONT}`
      ctx.fillStyle = [CYAN, FUCHSIA, GREEN, AMBER][k % 4]
      ctx.fillText(SHRAPNEL[k % SHRAPNEL.length], 180 + noise(k * 7.3) * 720 + Math.cos(angle) * travel, SHEAR + Math.sin(angle) * travel * 0.7)
    }
    ctx.font = `20px ${FONT}`
    for (let k = 0; k < 72; k++) {
      const angle = k / 72 * Math.PI * 2
      ctx.fillStyle = k % 2 ? GREEN : CYAN
      ctx.fillText('*', 540 + Math.cos(angle) * sinceOpen * 460, SHEAR + Math.sin(angle) * sinceOpen * 280)
    }
    ctx.restore()
  }

  // Glitch: strongest as the lock opens, a short tear on each set pin, a light flicker now and then.
  const pinGlitch = PINS.some((_, i) => t - setTime(i) >= 0 && t - setTime(i) < 0.2)
  const intensity = sinceOpen >= 0 && sinceOpen < 0.7 ? 0.8 : pinGlitch ? 0.45 : t % 4.3 < 0.15 ? 0.25 : 0
  if (intensity > 0) {
    const seed = Math.floor(t * 12)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= 0.15 * intensity
    tearBand(ctx, 290, 500, -4 - intensity * 6)
    tearBand(ctx, 290, 500, 4 + intensity * 6)
    ctx.restore()
    for (let b = 0; b < 1 + Math.floor(intensity * 5); b++) {
      tearBand(ctx, 290 + noise(seed * 7 + b) * 470, 8 + noise(seed * 11 + b) * 28, (noise(seed * 13 + b) - 0.5) * 90 * intensity)
    }
    if (intensity >= 0.8) {
      ctx.save()
      ctx.globalCompositeOperation = 'difference'
      for (let b = 0; b < 2; b++) box(ctx, 48, 300 + noise(seed * 17 + b) * 470, W - 96, 4 + noise(seed * 19 + b) * 14, b ? CYAN : FUCHSIA)
      ctx.restore()
    }
  }
}

// A fictional board boots over its UART header while a logic analyzer decodes each frame.
const UART_SCRIPT = [
  ['TX', 'BOOTROM 0x0A\n'],
  ['TX', 'DRAM 64M OK\n'],
  ['TX', 'mesh0: link up\n'],
  ['TX', 'sprawl login: '],
  ['RX', 'guest\n'],
  ['TX', '$ '],
  ['RX', 'cat hello\n'],
  ['TX', 'hello, new york.\n'],
]
const BIT = 1 / 60
const UART_FRAMES = []
let uartClock = 1
for (const [channel, value] of UART_SCRIPT) {
  for (const char of value) {
    UART_FRAMES.push({ channel, char, start: uartClock })
    uartClock += channel === 'TX' ? 0.18 : 0.26
  }
  uartClock += 0.5
}
const PCB_TRACES = [
  [[384, 475], [384, 439], [404, 419], [495, 419]],
  [[372, 475], [372, 427], [392, 407], [495, 407]],
  [[360, 475], [360, 415], [380, 395], [495, 395]],
  [[348, 475], [348, 403], [368, 383], [495, 383]],
  [[245, 530], [200, 530], [170, 500], [170, 415]],
  [[245, 542], [195, 542], [140, 487], [140, 415]],
  [[415, 554], [584, 554]],
  ...Array.from({ length: 10 }, (_, k) => {
    const pin = 276 + k * 12
    const finger = 222 + k * 24
    return [[pin, 645], [pin, 670], [finger, 670 + Math.abs(finger - pin)], [finger, 748]]
  }),
]
const UART_TRACES = {
  TX: [[415, 578], [470, 578], [530, 638], [582, 638]],
  RX: [[415, 590], [465, 590], [539, 664], [582, 664]],
  GND: [[415, 602], [460, 602], [548, 690], [582, 690]],
  VCC: [[415, 614], [455, 614], [557, 716], [582, 716]],
}
const uartActive = (channel, t) => UART_FRAMES.some(frame => frame.channel === channel && t >= frame.start && t < frame.start + 0.2)

function uartTrace(ctx, t, channel, top, color) {
  const x = time => 1360 - (t - time) * 240
  const y = level => top + (1 - level) * 30
  ctx.save()
  ctx.beginPath()
  ctx.rect(760, top - 40, 600, 90)
  ctx.clip()
  for (const frame of UART_FRAMES) {
    if (frame.channel !== channel || frame.start + 10 * BIT > t || x(frame.start + 10 * BIT) < 760) continue
    const left = x(frame.start)
    const code = frame.char.charCodeAt(0)
    const label = frame.char === '\n' ? '↵' : frame.char === ' ' ? '␠' : frame.char
    box(ctx, left + 1, top - 30, 38, 20, `${color}1f`, `${color}66`)
    text(ctx, label, left + 20, top - 29, 16, color, 'center')
    text(ctx, `0x${code.toString(16).padStart(2, '0')}`, left + 20, top + 37, 12, MUTED, 'center')
  }
  // Idle high; each frame is a low start bit, eight data bits LSB first, then a high stop bit.
  ctx.beginPath()
  ctx.moveTo(700, y(1))
  let level = 1
  for (const frame of UART_FRAMES) {
    if (frame.channel !== channel || frame.start > t || x(frame.start + 10 * BIT) < 700) continue
    const code = frame.char.charCodeAt(0)
    for (let bit = 0; bit < 10; bit++) {
      const time = frame.start + bit * BIT
      if (time > t) break
      const next = bit === 0 ? 0 : bit === 9 ? 1 : (code >> (bit - 1)) & 1
      if (next !== level) {
        ctx.lineTo(x(time), y(level))
        ctx.lineTo(x(time), y(next))
        level = next
      }
    }
  }
  ctx.lineTo(1360, y(level))
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

function hardware(ctx, t) {
  caption(ctx, `${sceneNumber(hardware)}   /   HARDWARE HACKING`, 'FIND THE DEBUG PORT.', 'UART  /  TX  RX  GND  VCC  /  READ THE BOOT LOG')
  const gold = '#b6a66b'
  const silk = '#9fbdb8'

  ctx.beginPath()
  ctx.roundRect(64, 296, 576, 486, 14)
  ctx.fillStyle = '#071613'
  ctx.fill()
  ctx.strokeStyle = '#2b5a4c'
  ctx.lineWidth = 1.5
  ctx.stroke()
  for (const [x, y] of [[90, 322], [614, 322], [90, 756], [614, 756]]) {
    dot(ctx, x, y, 11, gold)
    dot(ctx, x, y, 6, INK)
  }
  text(ctx, 'SPRAWL-NYC  REV 0A', 114, 314, 14, silk)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  PCB_TRACES.forEach((points, i) => {
    polyline(ctx, points, '#1d4a40', 3)
    const [x, y] = routePosition(points, (t * 0.35 + i * 0.23) % 1)
    dot(ctx, x, y, 6, '#6fe7e71f')
    dot(ctx, x, y, 2, CYAN)
  })
  for (const [name, points] of Object.entries(UART_TRACES)) {
    const live = name === 'TX' || name === 'RX' ? uartActive(name, t) : false
    polyline(ctx, points, live ? (name === 'TX' ? GREEN : CYAN) : '#1d4a40', 3)
  }
  ctx.lineCap = 'butt'

  // U1: the SoC, with ten pins per side on a 12px pitch.
  for (let k = 0; k < 10; k++) {
    const p = 276 + k * 12
    const q = 506 + k * 12
    box(ctx, p - 2, 475, 4, 10, gold)
    box(ctx, p - 2, 635, 4, 10, gold)
    box(ctx, 245, q - 2, 10, 4, gold)
    box(ctx, 405, q - 2, 10, 4, gold)
  }
  box(ctx, 255, 485, 150, 150, '#0c1416', '#3a5c58')
  dot(ctx, 270, 500, 4, '#26383a')
  text(ctx, 'SPRAWL', 330, 532, 24, GREEN, 'center')
  text(ctx, 'SoC  0x0A', 330, 566, 14, MUTED, 'center')
  text(ctx, 'U1', 255, 455, 14, silk)

  // U2 flash, Y1 crystal, D1 activity LED, decoupling caps and the edge connector.
  for (let k = 0; k < 4; k++) {
    box(ctx, 495, 381 + k * 12, 10, 4, gold)
    box(ctx, 575, 381 + k * 12, 10, 4, gold)
  }
  box(ctx, 505, 373, 70, 56, '#0c1416', '#3a5c58')
  text(ctx, 'FLASH', 540, 393, 14, MUTED, 'center')
  text(ctx, 'U2', 505, 353, 14, silk)
  ctx.beginPath()
  ctx.roundRect(122, 383, 66, 32, 14)
  ctx.fillStyle = '#1a2628'
  ctx.fill()
  ctx.strokeStyle = '#8fa7ad'
  ctx.stroke()
  text(ctx, '24M', 155, 391, 14, silk, 'center')
  text(ctx, 'Y1', 122, 363, 14, silk)
  for (const [x, y] of [[196, 610], [196, 640], [452, 456], [470, 676]]) {
    box(ctx, x, y, 18, 9, '#2d3c3a')
    box(ctx, x, y, 4, 9, gold)
    box(ctx, x + 14, y, 4, 9, gold)
  }
  const led = uartActive('TX', t)
  if (led) dot(ctx, 594, 554, 18, '#ccff8b2e')
  box(ctx, 584, 547, 20, 14, led ? GREEN : '#2d3c3a', '#8fa7ad')
  text(ctx, 'D1 ACT', 578, 534, 12, silk, 'right')
  for (let k = 0; k < 10; k++) box(ctx, 214 + k * 24, 748, 16, 30, gold)

  // J1: the four-pin UART header, with probe leads running to the analyzer.
  text(ctx, 'J1', 560, 612, 14, silk)
  ;['TX', 'RX', 'GND', 'VCC'].forEach((name, k) => {
    const y = 638 + k * 26
    box(ctx, 582, y - 8, 16, 16, gold)
    dot(ctx, 590, y, 4, INK)
    text(ctx, name, 604, y - 7, 12, silk)
  })
  for (const [y, target, color] of [[638, 388, GREEN], [664, 494, CYAN], [690, 548, MUTED]]) {
    ctx.beginPath()
    ctx.moveTo(590, y)
    ctx.bezierCurveTo(594, y - 44, 630, target, 680, target)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }

  box(ctx, 680, 296, 696, 264, '#060e12', '#1f3d42')
  text(ctx, 'LOGIC ANALYZER', 700, 310, 18, GREEN)
  text(ctx, 'UART  115200 8N1  /  DECODE ON', 1360, 312, 14, MUTED, 'right')
  text(ctx, 'D0  TX', 700, 380, 16, GREEN)
  text(ctx, 'D1  RX', 700, 486, 16, CYAN)
  line(ctx, 692, 432, 1364, 432, '#132a2e')
  uartTrace(ctx, t, 'TX', 372, GREEN)
  uartTrace(ctx, t, 'RX', 478, CYAN)
  for (let k = 0; k <= 5; k++) {
    const x = 1360 - k * 120
    line(ctx, x, 528, x, 534, '#2c5156')
    text(ctx, k ? `-${(k * 0.5).toFixed(1)}s` : 'NOW', x, 538, 12, MUTED, k ? 'center' : 'right')
  }

  box(ctx, 680, 580, 696, 202, '#07100e', '#35574a')
  box(ctx, 680, 580, 696, 28, '#193127')
  text(ctx, 'ttyUSB0', 696, 585, 16, GREEN)
  text(ctx, 'SERIAL CONSOLE', 1360, 586, 14, MUTED, 'right')
  const received = UART_FRAMES.filter(frame => frame.start + 10 * BIT <= t).map(frame => frame.char).join('')
  const lines = received.split('\n').slice(-7)
  lines.forEach((entry, i) => text(ctx, entry, 698, 620 + i * 22, 18, entry.startsWith('hello') ? GREEN : '#c3d9d5'))
  if (Math.floor(t * 2) % 2 === 0) {
    ctx.font = `18px ${FONT}`
    box(ctx, 698 + ctx.measureText(lines.at(-1)).width, 621 + (lines.length - 1) * 22, 9, 18, GREEN)
  }
}

// Conway's Game of Life, simulated on an unbounded sparse grid so gliders leave cleanly.
const LIFE_PATTERNS = [
  { col: 2, row: 2, pad: 0, label: 'GOSPER GLIDER GUN', cells: [
    '........................O',
    '......................O.O',
    '............OO......OO............OO',
    '...........O...O....OO............OO',
    'OO........O.....O...OO',
    'OO........O...O.OO....O.O',
    '..........O.....O.......O',
    '...........O...O',
    '............OO',
  ] },
  { col: 6, row: 23, pad: 1, label: 'PULSAR  /  P3', cells: [
    '..OOO...OOO', '', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO', '',
    '..OOO...OOO', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '', '..OOO...OOO',
  ] },
  { col: 58, row: 9, pad: 3, label: 'PENTADECATHLON  /  P15', cells: ['..O....O', 'OO.OOOO.OO', '..O....O'] },
]
const LIFE_COLS = 78
const LIFE_ROWS = 40
const LIFE_RATE = 9
const LIFE_WARMUP = 150
// Cyan cells with magenta trails, after the Liberty coin's inlay colours.
const LIFE_TRAIL = ['#d24fb8', '#9c3a8f', '#6d2a6a', '#47204c', '#2c1734']
const lifeHistory = []
function lifeGeneration(n) {
  if (!lifeHistory.length) {
    const cells = []
    for (const { col, row, cells: rows } of LIFE_PATTERNS) {
      rows.forEach((pattern, y) => [...pattern].forEach((cell, x) => { if (cell === 'O') cells.push([col + x, row + y]) }))
    }
    lifeHistory.push(cells)
  }
  while (lifeHistory.length <= n) {
    const previous = lifeHistory.at(-1)
    const alive = new Set(previous.map(([x, y]) => `${x},${y}`))
    const neighbours = new Map()
    for (const [x, y] of previous) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue
          const key = `${x + dx},${y + dy}`
          neighbours.set(key, (neighbours.get(key) || 0) + 1)
        }
      }
    }
    const next = []
    for (const [key, count] of neighbours) {
      if (count === 3 || (count === 2 && alive.has(key))) next.push(key.split(',').map(Number))
    }
    lifeHistory.push(next)
  }
  return lifeHistory[n]
}

function life(ctx, t) {
  caption(ctx, `${sceneNumber(life)}   /   EMERGENT BEHAVIOR`, 'ENDLESS SYSTEM SPRAWL.', "CONWAY'S GAME OF LIFE  /  B3/S23  /  NO PLAYERS REQUIRED")
  const left = 64
  const top = 300
  const cell = 12
  const visible = ([x, y]) => x >= 0 && x < LIFE_COLS && y >= 0 && y < LIFE_ROWS
  const grid = new Path2D()
  for (let x = 0; x <= LIFE_COLS; x++) for (let y = 0; y <= LIFE_ROWS; y++) grid.rect(left + x * cell, top + y * cell, 1, 1)
  ctx.fillStyle = '#1e2529'
  ctx.fill(grid)

  ctx.setLineDash([4, 5])
  // Boxes are padded by how far each oscillator grows beyond its starting phase.
  for (const { col, row, pad, cells, label } of LIFE_PATTERNS) {
    const width = Math.max(...cells.map(pattern => pattern.length))
    const x = left + (col - 1 - pad) * cell
    box(ctx, x, top + (row - 1 - pad) * cell, (width + 2 + pad * 2) * cell, (cells.length + 2 + pad * 2) * cell, null, '#6e2a62')
    text(ctx, label, x, top + (row + cells.length + 1 + pad) * cell + 6, 13, MUTED)
  }
  ctx.setLineDash([])

  // Recent generations linger as a fading trail beneath the live cells.
  const generation = LIFE_WARMUP + Math.floor(t * LIFE_RATE)
  for (let age = LIFE_TRAIL.length; age >= 1; age--) {
    const trail = new Path2D()
    for (const [x, y] of lifeGeneration(generation - age)) {
      if (visible([x, y])) trail.rect(left + x * cell + 2, top + y * cell + 2, cell - 3, cell - 3)
    }
    ctx.fillStyle = `${LIFE_TRAIL[age - 1]}${age === 1 ? 'cc' : '88'}`
    ctx.fill(trail)
  }
  const current = lifeGeneration(generation).filter(visible)
  const glow = new Path2D()
  const live = new Path2D()
  for (const [x, y] of current) {
    glow.rect(left + x * cell - 2, top + y * cell - 2, cell + 5, cell + 5)
    live.rect(left + x * cell + 1, top + y * cell + 1, cell - 1, cell - 1)
  }
  ctx.fillStyle = '#6fe7e722'
  ctx.fill(glow)
  ctx.fillStyle = CYAN
  ctx.fill(live)

  const panel = 1060
  box(ctx, panel, 300, 316, 482, '#070f12', '#1f3d42')
  text(ctx, 'HACKER EMBLEM', panel + 20, 318, 18, GREEN)
  // The emblem sits inside the coin's paired magenta and cyan rings.
  const ex = panel + 80
  const ey = 374
  const pulse = 0.75 + Math.sin(t * 1.4) * 0.25
  ctx.save()
  ctx.shadowBlur = 10
  for (const [radius, color, width] of [[104, FUCHSIA, 3], [98, CYAN, 2]]) {
    ctx.shadowColor = color
    ctx.beginPath()
    ctx.arc(ex + 78, ey + 78, radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(ex + 78, ey + 78, 95, 0, Math.PI * 2)
  ctx.clip()
  for (let i = 0; i <= 3; i++) {
    line(ctx, ex, ey + i * 52, ex + 156, ey + i * 52, '#3a4a52')
    line(ctx, ex + i * 52, ey, ex + i * 52, ey + 156, '#3a4a52')
  }
  ctx.restore()
  for (const [x, y] of [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) {
    ctx.save()
    ctx.globalAlpha *= pulse
    dot(ctx, ex + x * 52 + 26, ey + y * 52 + 26, 26, '#6fe7e722')
    ctx.restore()
    dot(ctx, ex + x * 52 + 26, ey + y * 52 + 26, 17, CYAN)
  }
  text(ctx, 'THE GLIDER', panel + 158, 566, 26, '#e0efec', 'center')
  text(ctx, 'FIVE CELLS. ALWAYS MOVING.', panel + 158, 602, 16, MUTED, 'center')
  line(ctx, panel + 20, 634, panel + 296, 634, '#1f3d42')
  ;[['GENERATION', String(generation).padStart(4, '0')], ['POPULATION', String(current.length).padStart(4, '0')], ['RULE', 'B3/S23']].forEach(([key, value], i) => {
    text(ctx, key, panel + 20, 650 + i * 28, 16, MUTED)
    text(ctx, value, panel + 296, 650 + i * 28, 16, '#c3d9d5', 'right')
  })
  text(ctx, '[ START SMALL. KEEP GOING. ]', panel + 20, 746, 16, FUCHSIA)
}

// The SPRAWL challenge coin's circuit-traced Liberty, rebuilt from ASCII with brief, local glitches.
const COIN_X = 1010
const COIN_Y = 446
const COIN_R = 345
const FACE_R = 300
const GLYPH_W = 5
const GLYPH_H = 10
const HEAD_X = COIN_X - 300
const HEAD_Y = COIN_Y - 300
const HEAD_ROWS = LIBERTY_CHARS.length
const HEAD_COLS = 600 / GLYPH_W
const LIBERTY_COLORS = { c: CYAN, p: FUCHSIA, 1: '#2b363d', 2: '#435159', 3: '#62727a' }
const LIBERTY_ROWS = LIBERTY_CHARS.map((line, row) => [...line]
  .map((ch, col) => [col, ch, LIBERTY_TINTS[row][col]])
  .filter(([, ch]) => ch !== ' '))
const LIBERTY_CELLS = LIBERTY_ROWS.flatMap((cells, row) => cells.map(([col, , tint]) => [col, row, tint]))
const SCRAMBLE = '01#%&$@/\\|<>{}[]=+*'
const REVEAL = 4
const GLITCH_START = 5
const GLITCH_EVERY = 3.6
const GLITCH_LENGTH = 0.4
const scramble = seed => SCRAMBLE[Math.floor(noise(seed) * SCRAMBLE.length)]

function paintLiberty(ctx, color) {
  ctx.font = `${GLYPH_H}px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  LIBERTY_ROWS.forEach((cells, row) => cells.forEach(([col, ch, tint]) => {
    const neon = tint === 'c' || tint === 'p'
    ctx.fillStyle = color || LIBERTY_COLORS[tint]
    ctx.shadowColor = neon && !color ? LIBERTY_COLORS[tint] : 'transparent'
    ctx.shadowBlur = neon && !color ? 5 : 0
    ctx.fillText(ch, HEAD_X + col * GLYPH_W, HEAD_Y + row * GLYPH_H)
  }))
}

// SPRAWL in the figlet "ANSI Shadow" style: solid blocks shaded cyan to magenta, box-drawing shadow.
const SPRAWL_BANNER = [
  '███████╗██████╗ ██████╗  █████╗ ██╗    ██╗██╗     ',
  '██╔════╝██╔══██╗██╔══██╗██╔══██╗██║    ██║██║     ',
  '███████╗██████╔╝██████╔╝███████║██║ █╗ ██║██║     ',
  '╚════██║██╔═══╝ ██╔══██╗██╔══██║██║███╗██║██║     ',
  '███████║██║     ██║  ██║██║  ██║╚███╔███╔╝███████╗',
  '╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝',
]
const mix = (from, to, f) => `#${[1, 3, 5].map(i => Math.round(parseInt(from.slice(i, i + 2), 16) * (1 - f) + parseInt(to.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('')}`

function paintSprawlBanner(ctx) {
  const size = 20
  const left = 64 + (540 - SPRAWL_BANNER[0].length * size / 2) / 2
  const top = 566 + (196 - SPRAWL_BANNER.length * size) / 2
  ctx.font = `${size}px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  SPRAWL_BANNER.forEach((row, r) => {
    const color = mix(CYAN, FUCHSIA, r / (SPRAWL_BANNER.length - 1))
    ;[...row].forEach((ch, c) => {
      if (ch === ' ') return
      const block = ch === '█'
      ctx.fillStyle = block ? color : '#3f5560'
      ctx.shadowColor = block ? color : 'transparent'
      ctx.shadowBlur = block ? 8 : 0
      ctx.fillText(ch, left + c * size / 2, top + r * size)
    })
  })
}

function arcText(ctx, value, radius, center, step, size, color, swap) {
  const letters = [...value]
  const top = Math.sin(center) < 0
  letters.forEach((letter, i) => {
    const offset = (i - (letters.length - 1) / 2) * step / radius
    const angle = top ? center + offset : center - offset
    ctx.save()
    ctx.translate(COIN_X + Math.cos(angle) * radius, COIN_Y + Math.sin(angle) * radius)
    ctx.rotate(top ? angle + Math.PI / 2 : angle - Math.PI / 2)
    ctx.font = `${size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.fillText(swap(i) || letter, 0, 0)
    ctx.restore()
  })
}

function coinTiming(t) {
  const burst = t >= GLITCH_START ? Math.floor((t - GLITCH_START) / GLITCH_EVERY) : -1
  const burstTime = t - GLITCH_START - burst * GLITCH_EVERY
  const glitching = burst >= 0 && burstTime < GLITCH_LENGTH
  const jitter = glitching ? burst * 31 + Math.floor(burstTime / 0.1) : 0
  return { burst, glitching, jitter, revealed: ease(t / REVEAL) }
}

// The homepage intro: just the coin, decoding then glitching, fitted to any canvas on a transparent background.
export function drawCoinIntro(ctx, width, height, seconds) {
  if (!width || !height) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const scale = Math.min(width, height) / ((COIN_R + 30) * 2)
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.scale(scale, scale)
  ctx.translate(-COIN_X, -COIN_Y)
  drawCoin(ctx, seconds)
  ctx.restore()
}

function liberty(ctx, t) {
  for (let x = 48; x < W; x += 32) for (let y = 110; y < 810; y += 32) dot(ctx, x, y, 1, '#14262a')
  caption(ctx, `${sceneNumber(liberty)}   /   SIGILLUM CIVITATIS NOVI EBORACI`, 'LIBERTY.EXE', 'SEAL OF THE CITY OF NEW YORK  /  SPRAWL CHALLENGE COIN')
  const { glitching, jitter, revealed } = coinTiming(t)

  // Readout panel.
  box(ctx, 64, 304, 540, 236, '#070f12', '#1f3d42')
  text(ctx, 'ARTIFACT SCAN', 84, 322, 18, GREEN)
  const integrity = revealed < 1 ? `DECODING ${String(Math.floor(revealed * 100)).padStart(3, ' ')}%`
    : glitching ? `${(82 + noise(jitter) * 12).toFixed(1)}%  SIGNAL FAULT` : '100.0%'
  ;[
    ['OBJECT', 'CHALLENGE COIN'],
    ['ISSUER', 'SPRAWL.NYC'],
    ['SUBJECT', 'LIBERTY ENLIGHTENING THE WORLD'],
    ['INLAY', 'CYAN / MAGENTA'],
    ['RENDER', `ASCII  ${HEAD_COLS} x ${HEAD_ROWS}`],
    ['INTEGRITY', integrity],
  ].forEach(([key, value], i) => {
    text(ctx, key, 84, 360 + i * 28, 16, MUTED)
    text(ctx, value, 214, 360 + i * 28, 16, key === 'INTEGRITY' && glitching ? FUCHSIA : '#c3d9d5')
  })
  box(ctx, 64, 566, 540, 196, '#070f12', '#1f3d42')
  cachedLayer(ctx, 'sprawl-banner', 64, 566, 540, 196, paintSprawlBanner)
  drawCoin(ctx, t)
}

function drawCoin(ctx, t) {
  const { burst, glitching, jitter, revealed } = coinTiming(t)
  // Coin body: black nickel with a reeded edge.
  const metal = ctx.createRadialGradient(COIN_X - 120, COIN_Y - 150, 30, COIN_X, COIN_Y, COIN_R * 1.15)
  metal.addColorStop(0, '#24292c')
  metal.addColorStop(0.6, '#131719')
  metal.addColorStop(1, '#090b0c')
  ctx.save()
  ctx.shadowColor = '#000'
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.arc(COIN_X, COIN_Y, COIN_R, 0, Math.PI * 2)
  ctx.fillStyle = metal
  ctx.fill()
  ctx.restore()
  for (let i = 0; i < 180; i++) {
    const angle = i / 180 * Math.PI * 2
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    line(ctx, COIN_X + cos * (COIN_R - 7), COIN_Y + sin * (COIN_R - 7), COIN_X + cos * COIN_R, COIN_Y + sin * COIN_R, '#30373b')
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(COIN_X, COIN_Y, FACE_R - 2, 0, Math.PI * 2)
  ctx.clip()
  if (revealed < 1) {
    // Decode top to bottom: settled rows above, a band of scrambled glyphs at the edge.
    const edge = revealed * (HEAD_ROWS + 4) - 4
    ctx.save()
    ctx.beginPath()
    ctx.rect(HEAD_X, HEAD_Y, 600, Math.max(0, Math.floor(edge)) * GLYPH_H)
    ctx.clip()
    cachedLayer(ctx, 'liberty', HEAD_X, HEAD_Y, 600, 600, context => paintLiberty(context))
    ctx.restore()
    ctx.font = `${GLYPH_H}px ${FONT}`
    for (let row = Math.max(0, Math.floor(edge)); row < Math.min(HEAD_ROWS, edge + 4); row++) {
      for (const [col, , tint] of LIBERTY_ROWS[row]) {
        ctx.fillStyle = LIBERTY_COLORS[tint]
        ctx.fillText(scramble(col * 7 + row * 131 + Math.floor(t * 18)), HEAD_X + col * GLYPH_W, HEAD_Y + row * GLYPH_H)
      }
    }
  } else {
    const layer = cachedLayer(ctx, 'liberty', HEAD_X, HEAD_Y, 600, 600, context => paintLiberty(context))
    if (glitching && layer) {
      // Colour-split ghosts, then a few torn bands slid sideways.
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha *= 0.16
      cachedLayer(ctx, 'liberty-magenta', HEAD_X - 5, HEAD_Y, 600, 600, context => { context.translate(5, 0); paintLiberty(context, FUCHSIA) })
      cachedLayer(ctx, 'liberty-cyan', HEAD_X + 5, HEAD_Y, 600, 600, context => { context.translate(-5, 0); paintLiberty(context, CYAN) })
      ctx.restore()
      const bands = 2 + Math.floor(noise(burst * 7) * 3)
      for (let b = 0; b < bands; b++) {
        const row = Math.floor(noise(jitter * 13 + b) * (HEAD_ROWS - 4))
        const height = (1 + Math.floor(noise(jitter * 17 + b) * 4)) * GLYPH_H
        const shift = Math.round((noise(jitter * 19 + b) - 0.5) * 12) * GLYPH_W
        const y = HEAD_Y + row * GLYPH_H
        box(ctx, HEAD_X, y, 600, height, metal)
        ctx.drawImage(layer.canvas, 0, (y - HEAD_Y) * layer.scale, layer.canvas.width, height * layer.scale, HEAD_X + shift, y, 600, height)
      }
    }
    // A handful of glyphs are always mid-corruption; more during a burst.
    const corrupt = glitching ? 16 : 4
    for (let i = 0; i < corrupt; i++) {
      const [col, row, tint] = LIBERTY_CELLS[Math.floor(noise(i * 7.7 + Math.floor(t * 3.3) * 3.1 + jitter) * LIBERTY_CELLS.length)]
      box(ctx, HEAD_X + col * GLYPH_W, HEAD_Y + row * GLYPH_H, GLYPH_W, GLYPH_H, metal)
      text(ctx, scramble(i + t * 7), HEAD_X + col * GLYPH_W, HEAD_Y + row * GLYPH_H, GLYPH_H, glitching ? FUCHSIA : LIBERTY_COLORS[tint])
    }
    // A slow scan line sweeps down the face.
    const scan = HEAD_Y + ((t * 70) % 700) - 50
    const sweep = ctx.createLinearGradient(0, scan - 40, 0, scan)
    sweep.addColorStop(0, '#6fe7e700')
    sweep.addColorStop(1, '#6fe7e71c')
    box(ctx, HEAD_X, scan - 40, 600, 40, sweep)
    line(ctx, HEAD_X, scan, HEAD_X + 600, scan, '#6fe7e733')
  }
  ctx.restore()

  ctx.save()
  ctx.shadowBlur = 10
  ctx.shadowColor = FUCHSIA
  ctx.beginPath()
  ctx.arc(COIN_X, COIN_Y, FACE_R + 3, 0, Math.PI * 2)
  ctx.strokeStyle = FUCHSIA
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.shadowColor = CYAN
  ctx.beginPath()
  ctx.arc(COIN_X, COIN_Y, FACE_R - 3, 0, Math.PI * 2)
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
  const swap = salt => i => glitching && noise(jitter * 3 + i + salt) > 0.82 ? scramble(i + jitter + salt) : null
  arcText(ctx, 'SIGILLUM CIVITATIS NOVI EBORACI', 322, -Math.PI / 2, 25, 26, FUCHSIA, swap(0))
  arcText(ctx, 'SPRAWL.NYC', 322, Math.PI / 2, 25, 26, FUCHSIA, swap(50))
}
