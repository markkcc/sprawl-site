// All scenes are local, deterministic canvas graphics. No network; the only live input is the local clock (banner date, monitor time).
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
  { name: 'PROCESS MONITOR / SPRAWL-0X9', duration: 28, draw: monitor },
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
  caption(ctx, `${sceneNumber(skyline)}   /   ESTABLISHING CONNECTION`, 'WE HAVE SIGNAL.', 'NEW YORK, NY     /     FIVE BOROUGHS. INFINITE CONNECTIONS.')
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

// A Turbo Vision desktop on a true 80x23 text-mode grid: 18x32 cells, the CGA palette and
// Turbo Vision's default colour scheme. Unifont at 32px is exactly twice its native pixels.
const TV_COLS = 80
const TV_ROWS = 23
const TV_TOP = 78
const CGA = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
  '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff']
const [BLACK, BLUE, GREEN_, CYAN_, RED, , , GRAY, DARK, LBLUE, LGREEN, LCYAN, , , YELLOW, WHITE] = CGA.map((_, i) => i)
const DOS_FILES = ['..\\', 'BOROUGHS\\', 'MEETUP.TXT', 'NYC.SYS', 'README.NFO', 'SIGNAL.EXE',
  'TALKS.DOC', 'PIZZA.BAT', 'BADGE.HEX', 'MESH.CFG', 'WINTERMT.EXE', 'ONO.SYS']
// Sizes match the C:\SPRAWL directory window; the rest are filler.
const DOS_SIZES = { 'MEETUP.TXT': '1,024', 'NYC.SYS': '40,712', 'README.NFO': '4,096', 'SIGNAL.EXE': '64,000', 'TALKS.DOC': '9,216', 'PIZZA.BAT': '512' }
const TV_MENU = ['~N~ew', '~O~pen...|F3', '~S~ave|F2', 'S~a~ve as...', '-', '~C~hange dir...', '~D~OS shell', 'E~x~it|Alt-X']

function textScreen() {
  const cells = Array.from({ length: TV_COLS * TV_ROWS }, () => ({ ch: ' ', fg: GRAY, bg: BLUE }))
  const at = (x, y) => (x >= 0 && x < TV_COLS && y >= 0 && y < TV_ROWS ? cells[y * TV_COLS + x] : null)
  const put = (x, y, ch, fg, bg) => {
    const cell = at(x, y)
    if (cell) Object.assign(cell, { ch, fg, bg: bg ?? cell.bg })
  }
  const write = (x, y, value, fg, bg) => [...value].forEach((ch, i) => put(x + i, y, ch, fg, bg))
  // Turbo Vision marks hotkeys with tildes: "~F~ile" draws the F in the hotkey colour.
  const writeHot = (x, y, value, fg, hot, bg) => {
    let col = x
    value.split('~').forEach((part, i) => { write(col, y, part, i % 2 ? hot : fg, bg); col += part.length })
  }
  const fill = (x0, y0, x1, y1, ch, fg, bg) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, ch, fg, bg) }
  // Shadows darken what is underneath: two columns to the right, one row below.
  const shadow = (x0, y0, x1, y1) => {
    for (let y = y0 + 1; y <= y1 + 1; y++) {
      for (let x = x0 + 2; x <= x1 + 2; x++) {
        if (x > x1 || y > y1) { const cell = at(x, y); if (cell) Object.assign(cell, { fg: DARK, bg: BLACK }) }
      }
    }
  }
  return { cells, put, write, writeHot, fill, shadow }
}

function tvWindow(s, x0, y0, x1, y1, { title, fg, bg, active, number, scrollV, scrollH }) {
  s.shadow(x0, y0, x1, y1)
  s.fill(x0, y0, x1, y1, ' ', fg, bg)
  const [h, v, tl, tr, bl, br] = active ? '═║╔╗╚╝' : '─│┌┐└┘'
  s.write(x0, y0, tl + h.repeat(x1 - x0 - 1) + tr, fg, bg)
  s.write(x0, y1, bl + h.repeat(x1 - x0 - 1) + br, fg, bg)
  for (let y = y0 + 1; y < y1; y++) { s.put(x0, y, v, fg, bg); s.put(x1, y, v, fg, bg) }
  const label = ` ${title} `
  s.write(Math.floor((x0 + x1 - label.length) / 2) + 1, y0, label, active ? WHITE : fg, bg)
  if (active) {
    s.write(x0 + 2, y0, '[ ]', fg, bg)
    s.put(x0 + 3, y0, '■', LGREEN, bg)
    if (number) {
      s.write(x1 - 4, y0, '[ ]', fg, bg)
      s.put(x1 - 3, y0, '↑', LGREEN, bg)
    }
  }
  if (number) s.write(x1 - (active ? 7 : 3), y0, String(number), fg, bg)
  if (scrollV !== undefined) {
    s.put(x1, y0 + 1, '▲', BLUE, CYAN_)
    s.fill(x1, y0 + 2, x1, y1 - 2, '░', BLUE, CYAN_)
    s.put(x1, y0 + 2 + Math.round(scrollV * (y1 - y0 - 4)), '■', BLUE, CYAN_)
    s.put(x1, y1 - 1, '▼', BLUE, CYAN_)
  }
  if (scrollH !== undefined) {
    const from = x0 + 18
    s.put(from, y1, '◄', BLUE, CYAN_)
    s.fill(from + 1, y1, x1 - 3, y1, '░', BLUE, CYAN_)
    s.put(from + 1 + Math.round(scrollH * (x1 - from - 5)), y1, '■', BLUE, CYAN_)
    s.put(x1 - 2, y1, '►', BLUE, CYAN_)
  }
}

// Buttons are green with a half-block shadow; a pressed button shifts right and loses it.
function tvButton(s, x, y, label, { pressed = false, enabled = true, focused = false, under = GRAY } = {}) {
  const width = label.replace(/~/g, '').length + 4
  const left = pressed ? x + 1 : x
  s.fill(left, y, left + width - 1, y, ' ', BLACK, GREEN_)
  const text = enabled ? (focused ? WHITE : BLACK) : DARK
  s.writeHot(left + 2, y, label, text, enabled ? YELLOW : DARK, GREEN_)
  if (pressed) s.put(x, y, ' ', BLACK, under)
  else {
    s.put(x + width, y, '▄', BLACK, under)
    s.write(x + 1, y + 1, '▀'.repeat(width), BLACK, under)
  }
}

function tvDialog(s, x0, y0, x1, y1, title) {
  tvWindow(s, x0, y0, x1, y1, { title, fg: WHITE, bg: GRAY, active: true })
}

function paintTextScreen(ctx, s) {
  // Backgrounds first, as runs of the same colour, then glyphs scaled to 18px-wide cells.
  for (let y = 0; y < TV_ROWS; y++) {
    for (let x = 0; x < TV_COLS;) {
      const bg = s.cells[y * TV_COLS + x].bg
      let end = x
      while (end < TV_COLS && s.cells[y * TV_COLS + end].bg === bg) end++
      box(ctx, x * 18, TV_TOP + y * 32, (end - x) * 18, 32, CGA[bg])
      x = end
    }
  }
  ctx.save()
  ctx.translate(0, TV_TOP)
  ctx.scale(18 / 16, 1)
  ctx.font = `32px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let y = 0; y < TV_ROWS; y++) {
    for (let x = 0; x < TV_COLS;) {
      const fg = s.cells[y * TV_COLS + x].fg
      let end = x
      let run = ''
      while (end < TV_COLS && s.cells[y * TV_COLS + end].fg === fg) run += s.cells[y * TV_COLS + end++].ch
      if (run.trim()) {
        ctx.fillStyle = CGA[fg]
        ctx.fillText(run, x * 16, y * 32)
      }
      x = end
    }
  }
  ctx.restore()
}

function desktop(ctx, t) {
  const s = textScreen()
  const clock = new Date()
  const pad = n => String(n).padStart(2, '0')
  const menuOpen = t >= 2 && t < 6.5
  const openDialog = t >= 6.6 && t < 13.6
  const progressDialog = t >= 13.8 && t < 20.8
  const infoBox = t >= 22 && t < 29.6
  const modal = menuOpen || openDialog || progressDialog || infoBox

  // Desktop, menu bar and status line.
  s.fill(0, 1, 79, 21, '░', GRAY, BLUE)
  s.fill(0, 0, 79, 0, ' ', BLACK, GRAY)
  let col = 1
  for (const item of ['≡', '~F~ile', '~E~dit', '~S~earch', '~R~un', '~C~ompile', '~T~ools', '~O~ptions', '~W~indow', '~H~elp']) {
    const width = item.replace(/~/g, '').length + 2
    const open = menuOpen && item === '~F~ile'
    s.writeHot(col, 0, ` ${item} `, BLACK, RED, open ? GREEN_ : GRAY)
    col += width
  }
  s.write(71, 0, `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`, BLACK, GRAY)
  s.fill(0, 22, 79, 22, ' ', BLACK, GRAY)
  s.writeHot(1, 22, '~F1~ Help  ~F2~ Save  ~F3~ Open  ~Alt-F9~ Compile  ~F9~ Make  ~F10~ Menu', BLACK, RED, GRAY)
  s.write(61, 22, '│ SPRAWL OS 0x0B', BLACK, GRAY)

  // SPRAWL.NFO: the big logo in an editor window, with Turbo Pascal's line:column indicator.
  const fileSelected = t < 13.6 ? 1 : 5
  const listActive = !modal && t >= 13.6 && t < 22
  tvWindow(s, 2, 1, 77, 11, { title: 'SPRAWL.NFO', fg: modal || listActive ? GRAY : WHITE, bg: BLUE, active: !modal && !listActive, number: 1, scrollV: 0, scrollH: 0 })
  SPRAWL_BANNER.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== ' ') s.put(15 + c, 3 + r, ch, ch === '█' ? YELLOW : LBLUE, BLUE)
  }))
  s.write(18, 10, 'NEW YORK CITY  ·  CYBERSECURITY  ·  COMMUNITY', LCYAN, BLUE)
  s.write(6, 11, ' 1:1 ', modal ? GRAY : WHITE, BLUE)

  // C:\SPRAWL: a cyan directory window.
  tvWindow(s, 2, 13, 37, 20, { title: 'C:\\SPRAWL', fg: listActive ? WHITE : BLACK, bg: CYAN_, active: listActive, number: 2, scrollV: 0.2 })
  ;['..          <UP-DIR>', 'BOROUGHS    <DIR>', 'MEETUP   TXT    1,024', 'NYC      SYS   40,712', 'README   NFO    4,096', 'SIGNAL   EXE   64,000']
    .forEach((entry, i) => {
      const chosen = i === fileSelected
      if (chosen) s.fill(3, 14 + i, 36, 14 + i, ' ', WHITE, GREEN_)
      s.write(4, 14 + i, entry, chosen ? WHITE : BLACK, chosen ? GREEN_ : CYAN_)
    })

  // Network monitor: borough links with traffic meters, refreshed four times a second.
  tvWindow(s, 40, 13, 77, 20, { title: 'Network monitor', fg: GRAY, bg: BLUE, number: 3 })
  s.write(42, 14, 'INTERFACE   STATUS   TRAFFIC', YELLOW, BLUE)
  const tick = Math.floor(t * 4)
  ;['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN IS'].forEach((name, i) => {
    const level = 3 + Math.floor(smoothNoise(tick * 0.18 + i * 9.7) * 10)
    s.write(42, 15 + i, name.padEnd(12) + 'ONLINE', WHITE, BLUE)
    s.write(63, 15 + i, '█'.repeat(level), LGREEN, BLUE)
    s.write(63 + level, 15 + i, '░'.repeat(13 - level), DARK, BLUE)
  })

  if (menuOpen) {
    // File menu: a single-line box, the current item on a green bar.
    const selected = t < 3.4 ? 0 : 1
    s.shadow(2, 1, 22, 10)
    s.fill(2, 1, 22, 10, ' ', BLACK, GRAY)
    s.write(2, 1, `┌${'─'.repeat(19)}┐`, BLACK, GRAY)
    s.write(2, 10, `└${'─'.repeat(19)}┘`, BLACK, GRAY)
    TV_MENU.forEach((item, i) => {
      const y = 2 + i
      s.put(2, y, '│', BLACK, GRAY)
      s.put(22, y, '│', BLACK, GRAY)
      if (item === '-') { s.write(2, y, `├${'─'.repeat(19)}┤`, BLACK, GRAY); return }
      const [label, key = ''] = item.split('|')
      const bg = i === selected ? GREEN_ : GRAY
      s.fill(3, y, 21, y, ' ', BLACK, bg)
      s.writeHot(4, y, label, BLACK, RED, bg)
      s.write(21 - key.length, y, key, BLACK, bg)
    })
  }

  if (openDialog) {
    // Open a File: name input, a two-column file list, buttons and the file info pane.
    const local = t - 6.6
    const pick = Math.min(5, Math.max(0, Math.floor((local - 0.6) / 0.9)))
    tvDialog(s, 13, 3, 66, 19, 'Open a File')
    s.writeHot(15, 5, '~N~ame', BLACK, YELLOW, GRAY)
    s.fill(15, 6, 47, 6, ' ', WHITE, BLUE)
    s.write(16, 6, DOS_FILES[pick], WHITE, BLUE)
    if (Math.floor(t * 2) % 2 === 0) s.put(16 + DOS_FILES[pick].length, 6, '_', WHITE, BLUE)
    s.write(48, 6, '▐↓▌', LGREEN, GRAY)
    s.writeHot(15, 8, '~F~iles', BLACK, YELLOW, GRAY)
    s.fill(15, 9, 47, 14, ' ', BLACK, CYAN_)
    DOS_FILES.forEach((name, i) => {
      const x = i < 6 ? 16 : 32
      const chosen = i === pick
      if (chosen) s.fill(x - 1, 9 + (i % 6), x + 14, 9 + (i % 6), ' ', WHITE, GREEN_)
      s.write(x, 9 + (i % 6), name, chosen ? WHITE : BLACK, chosen ? GREEN_ : CYAN_)
    })
    s.put(31, 9, '│', BLUE, CYAN_)
    for (let y = 10; y <= 14; y++) s.put(31, y, '│', BLUE, CYAN_)
    s.write(15, 15, `◄${'░'.repeat(31)}►`, BLUE, CYAN_)
    s.put(16, 15, '■', BLUE, CYAN_)
    tvButton(s, 51, 6, '~O~pen', { focused: true, pressed: local >= 6.4 && local < 6.8 })
    tvButton(s, 51, 9, '~R~eplace')
    tvButton(s, 51, 12, 'Cancel')
    tvButton(s, 51, 15, '~H~elp')
    s.fill(15, 17, 64, 18, ' ', YELLOW, BLUE)
    s.write(16, 17, 'C:\\SPRAWL\\*.*', YELLOW, BLUE)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    s.write(16, 18, `${DOS_FILES[pick].padEnd(14)}${(DOS_FILES[pick].endsWith('\\') ? '<DIR>' : DOS_SIZES[DOS_FILES[pick]] ?? '2,048').padStart(7)}   ${months[clock.getMonth()]} ${String(clock.getDate()).padStart(2)}, ${clock.getFullYear()}   9:15pm`, YELLOW, BLUE)
  }

  if (progressDialog) {
    const local = t - 13.8
    const progress = Math.min(1, Math.max(0, (local - 0.5) / 4.5))
    tvDialog(s, 19, 6, 60, 15, 'Execute SIGNAL.EXE')
    s.write(22, 8, 'Establishing the neighborhood mesh...', BLACK, GRAY)
    const filled = Math.round(progress * 36)
    s.write(22, 10, '█'.repeat(filled), BLUE, GRAY)
    s.write(22 + filled, 10, '░'.repeat(36 - filled), DARK, GRAY)
    s.write(37, 11, `${String(Math.round(progress * 100)).padStart(3)}%`, BLACK, GRAY)
    tvButton(s, 35, 13, '  ~O~K  ', { enabled: progress === 1, focused: progress === 1, pressed: local >= 6.6 && local < 6.9 })
  }

  if (infoBox) {
    const local = t - 22
    tvDialog(s, 17, 5, 62, 16, 'Information')
    s.write(27, 7, 'You are among your people.', BLACK, GRAY)
    s.write(22, 9, '> Find a seat. Meet a stranger.', BLACK, GRAY)
    s.write(22, 10, '> Talks start soon. Stay curious.', BLACK, GRAY)
    s.write(22, 12, '> MEETUP.TXT  1,024 bytes', DARK, GRAY)
    tvButton(s, 35, 14, '  ~O~K  ', { focused: true, pressed: local >= 7.2 && local < 7.5 })
  }

  paintTextScreen(ctx, s)
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
// Target scan: the reticle visits real stations on matching lines and locks onto each meetup.
const TARGETS = [
  { route: 0, stop: 2, name: 'CHRISTOPHER ST', label: [44, -92] },
  { route: 1, stop: 3, name: 'CANAL ST', label: [48, -104] },
  { route: 2, stop: 3, name: 'BEDFORD AV', label: [52, -66] },
  { route: 4, stop: 4, name: 'COURT SQ', label: [44, 30] },
]
const TARGET_START = 1
const TARGET_SPAN = 5.5
const TARGET_TRAVEL = 1
const TARGET_LOCK = 3
const targetAt = ({ route, stop }) => routePosition(ROUTES[route].points, stop / 5)

function targetState(t) {
  const index = Math.min(TARGETS.length - 1, Math.max(0, Math.floor((t - TARGET_START) / TARGET_SPAN)))
  const local = t - TARGET_START - index * TARGET_SPAN
  const [tx, ty] = targetAt(TARGETS[index])
  const [fx, fy] = index ? targetAt(TARGETS[index - 1]) : [720, 470]
  const travel = ease(local / TARGET_TRAVEL)
  return {
    index,
    local,
    x: fx + (tx - fx) * travel,
    y: fy + (ty - fy) * travel,
    progress: Math.min(1, Math.max(0, (local - TARGET_TRAVEL) / (TARGET_LOCK - TARGET_TRAVEL))),
    locked: local >= TARGET_LOCK,
  }
}

function brackets(ctx, x, y, radius, angle, color, width) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(-radius, -radius + radius * 0.55)
    ctx.lineTo(-radius, -radius)
    ctx.lineTo(-radius + radius * 0.55, -radius)
    ctx.stroke()
  }
  ctx.restore()
}

function drawTargeting(ctx, t) {
  if (t < TARGET_START) return
  const scan = targetState(t)
  const target = TARGETS[scan.index]
  const route = ROUTES[target.route]
  const tone = scan.locked ? FUCHSIA : '#ffc145'

  // Stations already locked this cycle keep a marker.
  TARGETS.slice(0, scan.index).forEach(done => {
    const [x, y] = targetAt(done)
    brackets(ctx, x, y, 12, 0, `${FUCHSIA}aa`, 1.5)
    dot(ctx, x, y, 3, FUCHSIA)
  })

  if (!scan.locked) {
    // Acquiring: brackets spin and close in while a progress ring fills.
    const radius = 58 - 36 * ease(scan.progress)
    brackets(ctx, scan.x, scan.y, radius, (1 - scan.progress) * Math.PI * 1.5 + t * 0.6, tone, 2)
    if (scan.progress > 0) {
      ctx.save()
      ctx.strokeStyle = `${tone}cc`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(scan.x, scan.y, radius + 10, -Math.PI / 2, -Math.PI / 2 + scan.progress * Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    dot(ctx, scan.x, scan.y, 2.5, tone)
  } else {
    // Locked: brackets snap square with a pulse ring, then the detection card.
    const since = scan.local - TARGET_LOCK
    brackets(ctx, scan.x, scan.y, 18 + 6 * Math.max(0, 1 - since * 4), 0, tone, 2.5)
    if (since < 0.8) {
      ctx.save()
      ctx.globalAlpha *= 1 - since / 0.8
      ctx.strokeStyle = FUCHSIA
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(scan.x, scan.y, 20 + since * 90, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    dot(ctx, scan.x, scan.y, 3.5, FUCHSIA)
  }

  // The readout card, joined to the target by a leader line.
  const [dx, dy] = target.label
  const cx = scan.x + dx
  const cy = scan.y + dy
  if (scan.local >= TARGET_TRAVEL) {
    line(ctx, scan.x + Math.sign(dx) * 14, scan.y + Math.sign(dy) * 14, cx, cy + 30, `${tone}aa`)
    box(ctx, cx, cy, 240, 62, '#06090ef2', tone)
    if (scan.locked) {
      ctx.save()
      ctx.shadowColor = FUCHSIA
      ctx.shadowBlur = 14
      box(ctx, cx, cy, 240, 22, FUCHSIA)
      ctx.restore()
      text(ctx, 'SPRAWL MEETUP DETECTED', cx + 120, cy + 3, 16, INK, 'center')
      dot(ctx, cx + 18, cy + 38, 8, route.color)
      text(ctx, route.name, cx + 18, cy + 30, 14, INK, 'center')
      text(ctx, target.name, cx + 34, cy + 31, 16, '#e0efec')
      text(ctx, 'LOCKED', cx + 228, cy + 31, 14, GREEN, 'right')
    } else {
      const bars = Math.round(scan.progress * 12)
      text(ctx, 'ACQUIRING TARGET', cx + 12, cy + 6, 16, tone)
      text(ctx, `${String(Math.round(scan.progress * 100)).padStart(3)}%`, cx + 228, cy + 6, 16, tone, 'right')
      text(ctx, `${'▮'.repeat(bars)}${'▯'.repeat(12 - bars)}`, cx + 12, cy + 34, 16, tone)
      text(ctx, `${route.name} LINE`, cx + 228, cy + 34, 14, MUTED, 'right')
    }
  }

  // Scan status, top right.
  text(ctx, `TARGET ${String(scan.index + 1).padStart(2, '0')} / ${String(TARGETS.length).padStart(2, '0')}`, 1376, 134, 18, '#e0efec', 'right')
  text(ctx, scan.locked ? 'STATUS: LOCKED' : scan.local < TARGET_TRAVEL ? 'STATUS: TRACKING' : 'STATUS: ACQUIRING', 1376, 162, 16, tone, 'right')
}

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
  if (t >= TARGET_START) {
    const { x, y, locked } = targetState(t)
    line(ctx, Math.max(48, x - 380), y, Math.min(W - 48, x + 380), y, locked ? '#ff4fd833' : '#ffc14533')
    line(ctx, x, 290, x, 800, locked ? '#ff4fd833' : '#ffc14533')
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
  drawTargeting(ctx, t)
}

const COMMANDS = [
  { command: 'ssh guest@sprawl.nyc', output: ['Connection established over the neighborhood mesh.', 'Welcome to SPRAWL. No corporate overlords detected.'] },
  { command: 'cat /etc/motd', output: ['A non-corporate technical meetup.', 'Built by the NYC hacker community.', 'Bring your curiosity. Share what you know.'] },
  { command: './boroughs --connect', output: ['[OK] Manhattan     [OK] Brooklyn     [OK] Queens', '[OK] Bronx         [OK] Staten Island', '5 / 5 boroughs connected. The city is listening.'] },
  { command: 'make tonight', output: ['Compiling conversations... done.', 'Linking people and ideas... done.', 'SPRAWL is ready. Talks begin soon.'] },
]
// SSH telemetry beside the terminal: session details, host key randomart, link graphs and a live auth log.
// The fingerprint is fictional; the randomart uses OpenSSH's drunken bishop walk over its bytes.
const SSH_FINGERPRINT = Array.from({ length: 32 }, (_, i) => Math.floor(noise(i * 7.7 + 42) * 256))
const SSH_FINGERPRINT_TEXT = `SHA256:${btoa(String.fromCharCode(...SSH_FINGERPRINT)).replace(/=+$/, '')}`
const RANDOMART_SYMBOLS = ' .o+=*BOX@%&#/^'
const RANDOMART_WALK = [[8, 4]]
for (const byte of SSH_FINGERPRINT) {
  for (let pair = 0; pair < 4; pair++) {
    const bits = (byte >> (pair * 2)) & 3
    const [x, y] = RANDOMART_WALK.at(-1)
    RANDOMART_WALK.push([Math.max(0, Math.min(16, x + (bits & 1 ? 1 : -1))), Math.max(0, Math.min(8, y + (bits & 2 ? 1 : -1)))])
  }
}
// Outside addresses come from the RFC 5737 documentation ranges.
const AUTH_LOG = [
  ['Accepted publickey for guest from 10.0.7.42 port 51515 ssh2: ED25519', GREEN],
  ['Invalid user admin from 203.0.113.9 port 40122', PINK],
  ['Failed password for invalid user admin from 203.0.113.9 port 40122', PINK],
  ['pam_unix(sshd:session): session opened for user guest', MUTED],
  ['Failed password for root from 198.51.100.23 port 33910 ssh2', PINK],
  ['fail2ban.actions: [sshd] Ban 203.0.113.9', '#ffc145'],
  ['Accepted publickey for speaker from 10.0.7.16 port 60022 ssh2: ED25519', GREEN],
  ['Connection closed by authenticating user root 198.51.100.23 [preauth]', MUTED],
  ['Accepted publickey for case from 10.0.7.31 port 41414 ssh2: ED25519', GREEN],
  ['Invalid user ubnt from 203.0.113.77 port 22123', PINK],
  ['fail2ban.actions: [sshd] Ban 198.51.100.23', '#ffc145'],
  ['Received disconnect from 192.0.2.44 port 52011:11: see you next meetup', MUTED],
]
const LINK_RATE = 5

// Traffic follows the terminal: transmit while a command is typed, receive while its output prints.
function sessionActivity(time) {
  let tx = 0
  let rx = 0
  COMMANDS.forEach(({ command, output }, i) => {
    const local = time - i * 5.5
    if (local >= 0 && local < command.length / 21) tx = 1
    if (local >= 1.6 && local < 1.9 + output.length * 0.35) rx = 1
  })
  return { tx, rx }
}
// Mostly steady latency with jitter, plus the odd congestion spike of random height and length.
function linkRtt(sample) {
  const window = Math.floor(sample / 11)
  const length = 4 + Math.floor(noise(window * 5.3 + 1.7) * 7)
  const into = sample - window * 11
  const spike = noise(window * 7.31 + 3.7) > 0.7 && into < length ? (14 + 46 * noise(window * 2.9 + 8.1)) * Math.sin(into / length * Math.PI) : 0
  return 9.5 + 5 * smoothNoise(sample * 0.27) + 3 * noise(sample * 1.37) + spike
}

// Below 16px Chromium rounds Unifont advances per glyph, so grid art is placed one cell at a time.
function gridText(ctx, value, x, y, size, color, cell) {
  ;[...value].forEach((ch, i) => { if (ch !== ' ') text(ctx, ch, x + i * cell, y, size, color) })
}

function sshPanel(ctx, x, y, width, height, title, detail) {
  box(ctx, x, y, width, height, '#07100e', '#35574a')
  box(ctx, x, y, width, 28, '#193127')
  text(ctx, title, x + 16, y + 6, 15, GREEN)
  if (detail) text(ctx, detail, x + width - 16, y + 7, 13, MUTED, 'right')
}

function terminal(ctx, t) {
  caption(ctx, `${sceneNumber(terminal)}   /   ACCESS GRANTED`, 'WELCOME TO THE SPRAWL.', 'LOCAL SESSION  /  GUEST ACCESS  /  ALL CURIOSITIES WELCOME')
  box(ctx, 64, 300, 656, 456, '#07100e', '#35574a')
  box(ctx, 64, 300, 656, 35, '#193127')
  text(ctx, 'guest@sprawl: ~', 84, 308, 18, GREEN)
  text(ctx, 'PTY / 01', 700, 308, 16, MUTED, 'right')
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

  // Session details and the host key's randomart, which walks itself in over the first few seconds.
  sshPanel(ctx, 744, 300, 632, 176, 'sshd  /  session established', 'pts/0')
  ;[
    ['PEER', '10.0.7.42:51515  guest'],
    ['KEX', 'mlkem768x25519-sha256'],
    ['CIPHER', 'chacha20-poly1305'],
    ['AUTH', 'publickey  ED25519'],
    ['FPRINT', `${SSH_FINGERPRINT_TEXT.slice(0, 23)}…`],
    ['CHAN', '1 session  2 forwards'],
  ].forEach(([key, value], i) => {
    text(ctx, key, 760, 342 + i * 21, 15, MUTED)
    text(ctx, value, 836, 342 + i * 21, 15, key === 'AUTH' ? GREEN : '#c3d9d5')
  })
  const steps = Math.min(RANDOMART_WALK.length - 1, Math.floor(ease((t - 0.5) / 4) * (RANDOMART_WALK.length - 1)))
  const counts = Array.from({ length: 9 }, () => Array(17).fill(0))
  for (let i = 1; i <= steps; i++) counts[RANDOMART_WALK[i][1]][RANDOMART_WALK[i][0]]++
  const art = counts.map((row, r) => row.map((count, c) => {
    if (c === RANDOMART_WALK[0][0] && r === RANDOMART_WALK[0][1]) return 'S'
    if (steps === RANDOMART_WALK.length - 1 && c === RANDOMART_WALK.at(-1)[0] && r === RANDOMART_WALK.at(-1)[1]) return 'E'
    return RANDOMART_SYMBOLS[Math.min(count, RANDOMART_SYMBOLS.length - 1)]
  }).join(''))
  gridText(ctx, '+--[ED25519 256]--+', 1232, 332, 13, '#5d8f84', 6.5)
  art.forEach((row, r) => {
    gridText(ctx, `|${' '.repeat(17)}|`, 1232, 345 + r * 13, 13, '#5d8f84', 6.5)
    gridText(ctx, ` ${row}`, 1232, 345 + r * 13, 13, '#9fe0b0', 6.5)
  })
  gridText(ctx, '+----[SHA256]-----+', 1232, 462, 13, '#5d8f84', 6.5)
  if (steps < RANDOMART_WALK.length - 1) {
    const [bx, by] = RANDOMART_WALK[steps]
    box(ctx, 1232 + (bx + 1) * 6.5, 345 + by * 13, 6.5, 13, FUCHSIA)
  }

  // Link: round-trip time and traffic that tracks the terminal.
  const sample = t * LINK_RATE
  const now = Math.floor(sample)
  sshPanel(ctx, 744, 490, 632, 132, 'link', 'ServerAliveInterval 15')
  const rtts = Array.from({ length: 56 }, (_, i) => linkRtt(now - 55 + i))
  const rttY = ms => 590 - Math.min(1, ms / 70) * 62
  ctx.beginPath()
  ctx.moveTo(760, 590)
  rtts.forEach((ms, i) => ctx.lineTo(760 + i * 5, rttY(ms)))
  ctx.lineTo(1035, 590)
  ctx.closePath()
  ctx.fillStyle = '#ccff8b1f'
  ctx.fill()
  ctx.beginPath()
  rtts.forEach((ms, i) => i ? ctx.lineTo(760 + i * 5, rttY(ms)) : ctx.moveTo(760, rttY(ms)))
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 1.5
  ctx.stroke()
  rtts.forEach((ms, i) => { if (ms > 30) dot(ctx, 760 + i * 5, rttY(ms), 2, '#ffc145') })
  line(ctx, 760, 590, 1035, 590, '#35574a')
  const p95 = [...rtts].sort((a, b) => a - b)[Math.floor(rtts.length * 0.95)]
  text(ctx, `RTT ${rtts.at(-1).toFixed(1)} ms   p95 ${Math.round(p95)} ms`, 760, 598, 14, rtts.at(-1) > 30 ? '#ffc145' : '#c3d9d5')
  line(ctx, 1072, 557, 1360, 557, '#35574a')
  for (let i = 0; i < 58; i++) {
    const s = now - 57 + i
    const { tx, rx } = sessionActivity(s / LINK_RATE)
    const down = 0.08 + 0.12 * noise(s * 1.7) + rx * (0.5 + 0.4 * noise(s * 3.1))
    const upload = 0.05 + 0.08 * noise(s * 2.3) + tx * (0.35 + 0.35 * noise(s * 4.7))
    box(ctx, 1072 + i * 5, 557 - down * 30, 3, down * 30, CYAN)
    box(ctx, 1072 + i * 5, 558, 3, upload * 30, FUCHSIA)
  }
  text(ctx, `▲ RX ${(1.21 + t * 0.013).toFixed(2)} MiB   ▼ TX ${Math.round(286 + t * 3.1)} KiB`, 1072, 598, 14, '#c3d9d5')
  const beat = (t % 2) / 2
  dot(ctx, 1352, 605, 4 + beat * 6, `#ccff8b${Math.round((1 - beat) * 120).toString(16).padStart(2, '0')}`)
  dot(ctx, 1352, 605, 3, GREEN)

  // A live auth log; each new line slides the older ones up.
  sshPanel(ctx, 744, 636, 632, 120, 'tail -f /var/log/auth.log', 'sshd[4242]')
  const entry = Math.floor(t / 1.6)
  const slide = 1 - ease(Math.min(1, (t / 1.6 - entry) * 4))
  ctx.save()
  ctx.beginPath()
  ctx.rect(745, 665, 630, 90)
  ctx.clip()
  for (let k = 0; k < 6; k++) {
    const index = entry - 5 + k
    const [message, color] = AUTH_LOG[((index % AUTH_LOG.length) + AUTH_LOG.length) % AUTH_LOG.length]
    const stamp = new Date(Date.now() - (t - index * 1.6) * 1000)
    const ly = 650 + k * 18 + slide * 18
    text(ctx, [stamp.getHours(), stamp.getMinutes(), stamp.getSeconds()].map(n => String(n).padStart(2, '0')).join(':'), 760, ly, 13, '#4d6a68')
    text(ctx, message, 824, ly, 13, color)
  }
  ctx.restore()

  text(ctx, 'HOST NEW YORK CITY   /   STATUS MAKING THINGS   /   TRUST YOUR CURIOSITY', 64, 774, 15, MUTED)
  text(ctx, '[ YOU BELONG HERE. ]', 1376, 770, 22, PINK, 'right')
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

// A btop-style system monitor on the 8x16 character grid, in the show's neon palette.
const monX = col => col * 8
const monY = row => 80 + row * 16
const HEAT = ['#6fe7e7', '#7ff0c0', '#ccff8b', '#ffc145', '#ff8a5c', '#ff4fd8']
const heat = f => HEAT[Math.min(HEAT.length - 1, Math.max(0, Math.floor(f * HEAT.length)))]
const MON_RATE = 6
const MON_DIM = '#1d2a30'
const smoothNoise = x => {
  const i = Math.floor(x)
  return noise(i) + (noise(i + 1) - noise(i)) * ease(x - i)
}
const clamp01 = v => Math.min(0.99, Math.max(0.01, v))
// Braille dots filled from the bottom (up) or the top (down), for the left and right dot columns.
const BRAILLE = {
  up: [[0, 0x40, 0x44, 0x46, 0x47], [0, 0x80, 0xa0, 0xb0, 0xb8]],
  down: [[0, 0x01, 0x03, 0x07, 0x47], [0, 0x08, 0x18, 0x38, 0xb8]],
}
const cpuLoad = s => clamp01(0.36 + 0.22 * Math.sin(s * 0.045) + 0.14 * Math.sin(s * 0.21 + 1) + 0.18 * (smoothNoise(s * 0.4) - 0.5)
  + (noise(Math.floor(s / 40) + 9) > 0.62 ? 0.3 * Math.sin((s % 40) / 40 * Math.PI) : 0))
const PROCESSES = [
  ['wintermute', '/opt/tessier/wintermute --merge', 'root', 1.9, 64, 2048],
  ['neuromancer', '/opt/tessier/neuromancer --dream', 'root', 1.6, 48, 1730],
  ['sdr-waterfall', 'rtl_sdr -f 433.92M -s 2.4M -', 'guest', 1.4, 6, 212],
  ['glider-gun', 'life --rule B3/S23 --gosper', 'guest', 1.1, 4, 96],
  ['packet-sniffer', 'tcpdump -i mesh0 -w talks.pcap', 'root', 0.9, 2, 64],
  ['pizza-queue', 'pizzad --boroughs=5 --extra-cheese', 'sprawl', 0.8, 12, 420],
  ['lightning-talk', 'talkd --slot=20min --questions', 'speaker', 1.2, 8, 310],
  ['hallway-track', 'hallwayd --meet-strangers', 'guest', 0.7, 16, 128],
  ['ice-breaker', 'ice-breaker --target=sense-net', 'case', 1.0, 3, 77],
  ['badge-reader', 'badged --nfc /dev/ttyUSB0', 'root', 0.4, 2, 18],
  ['subway-signals', 'signald --lines=A,L,1,7,S', 'mta', 0.5, 5, 54],
  ['bodega-cat', 'catd --nap --guard-chips', 'bodega', 0.2, 1, 9],
  ['cold-brew', 'brewd --strength=max', 'sprawl', 0.3, 2, 33],
  ['nmap', 'nmap -sV 10.0.0.0/24', 'guest', 0.9, 4, 41],
  ['ghidra', 'ghidraRun firmware.bin', 'guest', 0.8, 38, 1288],
  ['wireshark', 'wireshark -k -i mesh0', 'guest', 0.6, 9, 389],
  ['tor', 'tor -f /etc/tor/torrc', 'tor', 0.3, 3, 61],
  ['meshd', 'meshd --peers=all --open', 'root', 0.4, 6, 27],
  ['sticker-swap', 'stickerd --trade --laptop-lid', 'guest', 0.2, 1, 12],
  ['coffee-mutex', 'mutexd --one-cup-at-a-time', 'sprawl', 0.3, 1, 8],
  ['cyberdeck', 'ono-sendai --jack-in', 'case', 1.3, 24, 960],
  ['uart-console', 'screen /dev/ttyUSB0 115200', 'guest', 0.2, 1, 6],
  ['qr-scanner', 'qrd --rsvp sprawl.nyc', 'sprawl', 0.3, 2, 22],
  ['mitmproxy', 'mitmproxy --mode transparent', 'guest', 0.7, 7, 174],
]
const processCpu = (i, time) => Math.min(99.9, PROCESSES[i][3] * 9 * (0.35 + 1.3 * smoothNoise(time * 0.55 + i * 13.1)))

function brailleGraph(ctx, col, row, width, height, values, colorAt, down = false) {
  const dots = height * 4
  for (let r = 0; r < height; r++) {
    const fromEdge = down ? r : height - 1 - r
    let line = ''
    for (let c = 0; c < width; c++) {
      let code = 0x2800
      for (let side = 0; side < 2; side++) {
        const value = values[c * 2 + side] ?? 0
        const filled = value > 0.01 ? Math.max(1, Math.round(value * dots)) : 0
        code |= BRAILLE[down ? 'down' : 'up'][side][Math.max(0, Math.min(4, filled - fromEdge * 4))]
      }
      // Unifont draws empty braille dots faintly, so fully empty cells become plain spaces.
      line += code === 0x2800 ? ' ' : String.fromCharCode(code)
    }
    text(ctx, line, monX(col), monY(row + r), 16, colorAt(height > 1 ? fromEdge / (height - 1) : 1))
  }
}

// Bars from the lower-eighth block elements; crisper than braille for small, mid-height graphs.
const BAR_GLYPHS = ' ▁▂▃▄▅▆▇█'
function blockGraph(ctx, col, row, width, height, values, colorAt) {
  for (let r = 0; r < height; r++) {
    const fromEdge = height - 1 - r
    const line = values.slice(-width).map(value => BAR_GLYPHS[Math.max(0, Math.min(8, Math.round(value * height * 8) - fromEdge * 8))]).join('')
    text(ctx, line, monX(col), monY(row + r), 16, colorAt(height > 1 ? fromEdge / (height - 1) : 1))
  }
}

function meter(ctx, col, row, width, value) {
  for (let i = 0; i < width; i++) text(ctx, '■', monX(col + i), monY(row), 16, i / width < value ? heat(i / width) : MON_DIM)
}

function monBox(ctx, c0, r0, c1, r1, color, labels) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  text(ctx, `╭${'─'.repeat(c1 - c0 - 1)}╮`, monX(c0), monY(r0), 16, color)
  text(ctx, `╰${'─'.repeat(c1 - c0 - 1)}╯`, monX(c0), monY(r1), 16, color)
  for (let r = r0 + 1; r < r1; r++) {
    text(ctx, '│', monX(c0), monY(r), 16, color)
    text(ctx, '│', monX(c1), monY(r), 16, color)
  }
  ctx.restore()
  // Labels sit in the top border between ┐ and ┌, as btop draws them.
  for (const [col, label, labelColor, row = r0] of labels) {
    box(ctx, monX(col), monY(row), (label.length + 2) * 8, 16, INK)
    text(ctx, '┐', monX(col), monY(row), 16, color)
    text(ctx, label, monX(col + 1), monY(row), 16, labelColor)
    text(ctx, '┌', monX(col + 1 + label.length), monY(row), 16, color)
  }
}

function monitor(ctx, t) {
  const sample = t * MON_RATE
  const now = Math.floor(sample)
  const history = (fn, count) => Array.from({ length: count }, (_, i) => fn(now - count + 1 + i))
  const clock = new Date()
  const pad = n => String(n).padStart(2, '0')

  // cpu: total history on the left, per-core meters in an inner box on the right.
  monBox(ctx, 5, 1, 174, 16, CYAN, [
    [7, '¹cpu', '#e0efec'],
    [83, `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`, '#ffffff'],
    [152, '- 166ms +', MUTED],
  ])
  const total = cpuLoad(sample)
  brailleGraph(ctx, 7, 2, 112, 14, history(cpuLoad, 224), heat)
  monBox(ctx, 122, 2, 172, 15, '#3f6c72', [[124, 'SPRAWL-0x9 @ 4.20 GHz', CYAN]])
  text(ctx, 'CPU', monX(124), monY(3), 16, '#e0efec')
  meter(ctx, 128, 3, 24, total)
  text(ctx, `${String(Math.round(total * 100)).padStart(3)}%`, monX(157), monY(3), 16, heat(total), 'right')
  text(ctx, `${Math.round(48 + total * 30)}°C`, monX(163), monY(3), 16, MUTED)
  for (let core = 0; core < 16; core++) {
    const load = clamp01(total * 0.7 + 0.45 * (smoothNoise(sample * 0.35 + core * 17.3) - 0.4))
    const col = core < 8 ? 124 : 148
    const row = 5 + core % 8
    text(ctx, `C${String(core).padStart(2, '0')}`, monX(col), monY(row), 16, MUTED)
    meter(ctx, col + 4, row, 12, load)
    text(ctx, `${String(Math.round(load * 100)).padStart(3)}%`, monX(col + 21), monY(row), 16, heat(load), 'right')
  }
  const loads = [1.24, 0.98, 0.77].map((base, i) => (base + total * (1.2 - i * 0.3)).toFixed(2))
  text(ctx, 'Load AVG:', monX(124), monY(13), 16, MUTED)
  text(ctx, loads.join('  '), monX(135), monY(13), 16, '#e0efec')
  const up = 13 * 3600 + 37 * 60 + Math.floor(t)
  text(ctx, `up ${pad(Math.floor(up / 3600))}:${pad(Math.floor(up / 60) % 60)}:${pad(up % 60)}`, monX(124), monY(14), 16, MUTED)
  text(ctx, `tasks ${1337 + Math.round(total * 40)}`, monX(171), monY(14), 16, MUTED, 'right')

  // mem: four metrics, each a figure and a short history graph.
  monBox(ctx, 5, 17, 64, 30, AMBER, [[7, '²mem', '#e0efec'], [46, 'Total 64.0 GiB', MUTED]])
  const used = s => clamp01(0.5 + 0.12 * Math.sin(s * 0.035) + 0.14 * (smoothNoise(s * 0.12) - 0.5))
  ;[
    ['Used', FUCHSIA, used],
    ['Available', '#ccff8b', s => 1 - used(s)],
    ['Cached', CYAN, s => clamp01(0.22 + 0.16 * smoothNoise(s * 0.09 + 5))],
    ['Free', AMBER, s => clamp01(0.2 - 0.1 * Math.sin(s * 0.035) + 0.12 * (smoothNoise(s * 0.15 + 9) - 0.5))],
  ].forEach(([label, color, fn], i) => {
    const row = 18 + i * 3
    const value = fn(sample)
    text(ctx, `${label}:`, monX(7), monY(row), 16, '#e0efec')
    text(ctx, `${(value * 64).toFixed(1)} GiB`, monX(54), monY(row), 16, color, 'right')
    text(ctx, `${String(Math.round(value * 100)).padStart(3)}%`, monX(62), monY(row), 16, MUTED, 'right')
    blockGraph(ctx, 7, row + 1, 55, 2, history(fn, 55), () => color)
  })

  // net: download graphed upward, upload graphed downward, like btop.
  monBox(ctx, 5, 31, 64, 44, '#ccff8b', [[7, '³net', '#e0efec'], [53, 'mesh0', CYAN]])
  const down = s => clamp01(0.3 + 0.25 * Math.sin(s * 0.07) + 0.3 * smoothNoise(s * 0.5 + 3) * (noise(Math.floor(s / 25)) > 0.4 ? 1 : 0.3))
  const upload = s => clamp01(0.12 + 0.1 * smoothNoise(s * 0.6 + 21) + (noise(Math.floor(s / 18) + 4) > 0.75 ? 0.35 : 0))
  brailleGraph(ctx, 7, 32, 56, 6, history(down, 112), heat)
  brailleGraph(ctx, 7, 38, 56, 6, history(upload, 112), f => ['#9d6bff', '#c45cff', FUCHSIA][Math.min(2, Math.floor(f * 3))], true)
  for (const [row, label, color] of [[32, `▼ Download ${(down(sample) * 120).toFixed(1)} MiB/s`, CYAN], [43, `▲ Upload ${(upload(sample) * 40).toFixed(1)} MiB/s`, FUCHSIA]]) {
    box(ctx, monX(8), monY(row), (label.length + 2) * 8, 16, INK)
    text(ctx, label, monX(9), monY(row), 16, color)
  }

  // proc: re-sorted by cpu every 1.5 seconds, with a selection stepping down the list.
  monBox(ctx, 66, 17, 174, 44, FUCHSIA, [[68, '⁴proc', '#e0efec'], [80, 'filter: sprawl', MUTED], [150, '< cpu lazy >', CYAN]])
  const sortTime = Math.floor(t / 1.5) * 1.5
  const order = PROCESSES.map((_, i) => i).sort((a, b) => processCpu(b, sortTime) - processCpu(a, sortTime))
  const selected = Math.floor(t / 2) % 12
  // Every 1.2 seconds a couple of processes briefly take the name sprawl.nyc, flashing fuchsia as they do.
  const renameSlot = Math.floor(t / 1.2)
  const renameFlash = 1 - (t / 1.2 - renameSlot) * 0.75
  const columns = [[74, 'Pid:', 'right'], [76, 'Program:'], [93, 'Command:'], [135, 'Thr:', 'right'], [137, 'User:'], [152, 'MemB', 'right'], [159, 'Cpu%', 'right']]
  columns.forEach(([col, label, align]) => text(ctx, label, monX(col), monY(18), 16, '#e0efec', align))
  order.forEach((index, rank) => {
    const [name, command, user, , threads, memory] = PROCESSES[index]
    const row = 19 + rank
    const cpu = processCpu(index, t)
    const active = rank === selected
    const renamed = noise(index * 7.3 + renameSlot * 3.1) > 0.92
    if (active) box(ctx, monX(67), monY(row), monX(107), 16, '#3a1240')
    if (renamed) {
      ctx.save()
      ctx.globalAlpha *= 0.4 * renameFlash
      box(ctx, monX(67), monY(row), monX(107), 16, FUCHSIA)
      ctx.restore()
    }
    text(ctx, String(1337 + index * 97), monX(74), monY(row), 16, active ? '#ffffff' : MUTED, 'right')
    if (renamed) {
      ctx.save()
      ctx.shadowColor = FUCHSIA
      ctx.shadowBlur = 10
      text(ctx, 'sprawl.nyc', monX(76), monY(row), 16, '#ff9ae8')
      ctx.restore()
    } else {
      text(ctx, name, monX(76), monY(row), 16, active ? '#ffffff' : '#e0efec')
    }
    text(ctx, command.slice(0, 40), monX(93), monY(row), 16, active ? '#f2c6ea' : '#5d7a80')
    text(ctx, String(threads), monX(135), monY(row), 16, active ? '#ffffff' : MUTED, 'right')
    text(ctx, user, monX(137), monY(row), 16, active ? '#ffffff' : '#4fb8c0')
    text(ctx, `${Math.round(memory * (1 + 0.04 * smoothNoise(t + index)))}M`, monX(152), monY(row), 16, active ? '#ffffff' : AMBER, 'right')
    text(ctx, cpu.toFixed(1), monX(159), monY(row), 16, heat(cpu / 30), 'right')
    blockGraph(ctx, 161, row, 12, 1, Array.from({ length: 12 }, (_, k) => processCpu(index, t - (11 - k) * 0.5) / 30), () => heat(cpu / 30))
  })
  // Key hints with the hotkey highlighted in place, as btop shows them.
  const hints = ['[↑] select [↓]', 'info [↵]', '[t]erminate', '[k]ill', '[s]ignals', '[n]ice']
  let col = 68
  for (const hint of hints) {
    for (const [i, part] of hint.split(/\[|\]/).entries()) {
      text(ctx, part, monX(col), monY(43), 16, i % 2 ? FUCHSIA : MUTED)
      col += part.length
    }
    col += 3
  }
  text(ctx, `${order.length}/${PROCESSES.length}`, monX(172), monY(43), 16, MUTED, 'right')
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
  caption(ctx, `${sceneNumber(hardware)}   /   HARDWARE HACKING`, 'YOU ARE IN THE DEBUG PORT.', 'UART IS REAL ART  /  TX  RX  GND  VCC  /  READ THE BOOT LOG')
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
  for (let x = 0; x <= LIFE_COLS; x++) for (let y = 0; y <= LIFE_ROWS; y++) grid.rect(left + x * cell - 1, top + y * cell - 1, 2, 2)
  ctx.fillStyle = '#3b4b53'
  ctx.fill(grid)

  ctx.setLineDash([4, 5])
  // Boxes are padded by how far each oscillator grows beyond its starting phase.
  for (const { col, row, pad, cells, label } of LIFE_PATTERNS) {
    const width = Math.max(...cells.map(pattern => pattern.length))
    const x = left + (col - 1 - pad) * cell
    box(ctx, x, top + (row - 1 - pad) * cell, (width + 2 + pad * 2) * cell, (cells.length + 2 + pad * 2) * cell, null, '#6e2a62')
    box(ctx, x - 2, top + (row + cells.length + 1 + pad) * cell + 4, label.length * 6.5 + 4, 17, INK)
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
  text(ctx, 'FIVE CELLS ALWAYS MOVING', panel + 158, 602, 16, MUTED, 'center')
  line(ctx, panel + 20, 634, panel + 296, 634, '#1f3d42')
  ;[['GENERATION', String(generation).padStart(4, '0')], ['POPULATION', String(current.length).padStart(4, '0')], ['RULE', 'B3/S23']].forEach(([key, value], i) => {
    text(ctx, key, panel + 20, 650 + i * 28, 16, MUTED)
    text(ctx, value, panel + 296, 650 + i * 28, 16, '#c3d9d5', 'right')
  })
  text(ctx, '[ NEIGHBORS IN PERPETUAL MOTION ]', panel + 20, 746, 16, FUCHSIA)
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

function paintSprawlBanner(ctx, left, top, size) {
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

// The auditorium filling up: 8 curved rows around the stage, split by a centre aisle.
// Seats are taken slowly in a shuffled order with a slight pull toward the front, each one filling in.
const SEAT_ROWS = 8
const SEAT_COLS = 24
const SEATS = []
for (let row = 0; row < SEAT_ROWS; row++) {
  for (let col = 0; col < SEAT_COLS; col++) {
    const x = 142 + col * 15 + (col >= SEAT_COLS / 2 ? 24 : 0)
    const offset = (x + 5 - 334) / 196
    SEATS.push({ x, y: 624 + row * 15 - offset * offset * 12, order: noise(row * 31.7 + col * 7.3) * 0.75 + row / SEAT_ROWS * 0.25 })
  }
}
const SEAT_FILL = 0.9
const SEATS_AT_START = 6
const SEAT_CUE = 0.9
const SEAT_EMPTY = '#2c4048'
const SEAT_ACTIVE = '#c8d2d5'
SEATS.map((seat, i) => [seat.order, i]).sort((a, b) => a[0] - b[0]).forEach(([, i], rank) => {
  SEATS[i].takenAt = rank < SEATS_AT_START ? -SEAT_FILL : 1.2 + (rank - SEATS_AT_START) * 0.32 + noise(i * 3.3) * 0.5
})

function drawAuditorium(ctx, t) {
  box(ctx, 64, 566, 540, 196, '#070f12', '#1f3d42')
  text(ctx, 'AUDITORIUM', 84, 580, 18, GREEN)
  const taken = SEATS.filter(seat => t >= seat.takenAt + SEAT_FILL).length
  text(ctx, `SEATS ${String(taken).padStart(3)} / ${SEATS.length}`, 584, 582, 16, taken ? FUCHSIA : '#c3d9d5', 'right')
  box(ctx, 214, 606, 240, 3, '#3f5560')
  text(ctx, 'STAGE', 334, 590, 12, MUTED, 'center')

  const empty = new Path2D()
  const filling = new Path2D()
  const filled = new Path2D()
  const cued = []
  for (const seat of SEATS) {
    const since = t - seat.takenAt
    // Mid-fill seats get a light grey outline; just before, it fades up to that grey and holds.
    if (since > 0 && since < SEAT_FILL) filling.rect(seat.x + 0.5, seat.y + 0.5, 9, 9)
    else if (since > -SEAT_CUE && since <= 0) cued.push([seat, 1 + since / SEAT_CUE])
    else empty.rect(seat.x + 0.5, seat.y + 0.5, 9, 9)
    // A seat being taken fills from the bottom in five 2px steps.
    if (since > 0) {
      const height = since >= SEAT_FILL ? 10 : Math.ceil(since / SEAT_FILL * 5) * 2
      filled.rect(seat.x, seat.y + 10 - height, 10, height)
    }
  }
  ctx.strokeStyle = SEAT_EMPTY
  ctx.lineWidth = 1
  ctx.stroke(empty)
  ctx.strokeStyle = SEAT_ACTIVE
  ctx.stroke(filling)
  // Fade the outline in over the first half of the cue, then hold briefly before the fill begins.
  for (const [seat, cue] of cued) {
    ctx.strokeStyle = mix(SEAT_EMPTY, SEAT_ACTIVE, ease(cue / 0.5))
    ctx.strokeRect(seat.x + 0.5, seat.y + 0.5, 9, 9)
  }
  ctx.save()
  ctx.shadowColor = FUCHSIA
  ctx.shadowBlur = 6
  ctx.fillStyle = FUCHSIA
  ctx.fill(filled)
  ctx.restore()
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
  caption(ctx, `${sceneNumber(liberty)}   /   SIGILLUM CIVITATIS NOVI EBORACI`, '', 'SEAL OF THE CITY OF NEW YORK  /  SPRAWL CHALLENGE COIN')
  // The ANSI Shadow SPRAWL logo stands in for the caption title.
  cachedLayer(ctx, 'sprawl-title', 60, 152, 380, 96, context => paintSprawlBanner(context, 64, 160, 14))
  const { glitching, jitter, revealed } = coinTiming(t)

  // Readout panel.
  box(ctx, 64, 304, 540, 236, '#070f12', '#1f3d42')
  text(ctx, 'ARTIFACT SCAN', 84, 322, 18, GREEN)
  const integrity = revealed < 1 ? `DECODING ${String(Math.floor(revealed * 100)).padStart(3, ' ')}%`
    : glitching ? `${(82 + noise(jitter) * 12).toFixed(1)}%  SIGNAL FAULT` : '100.0%'
  ;[
    ['OBJECT', 'CHALLENGE COIN'],
    ['ISSUER', 'SPRAWL.NYC'],
    ['SUBJECT', 'HACK THE PLANET'],
    ['INLAY', 'CYAN / MAGENTA'],
    ['RENDER', `ASCII  ${HEAD_COLS} x ${HEAD_ROWS}`],
    ['INTEGRITY', integrity],
  ].forEach(([key, value], i) => {
    text(ctx, key, 84, 360 + i * 28, 16, MUTED)
    text(ctx, value, 214, 360 + i * 28, 16, key === 'INTEGRITY' && glitching ? FUCHSIA : '#c3d9d5')
  })
  drawAuditorium(ctx, t)
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
