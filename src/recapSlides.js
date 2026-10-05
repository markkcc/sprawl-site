// The /slides deck for the 1-year recap: a title card, then a dark NYC map that flies to each venue.
// Like the live show, everything is drawn locally on canvas. The map is OpenStreetMap data baked into
// recapMap.json by scripts/build-recap-map.mjs; this module is loaded on demand so the site doesn't carry it.
import MAP from './recapMap.json'
import { currentEvent, pastEvents } from './events.js'
import { box, COIN_R, COIN_X, COIN_Y, CYAN, drawCoin, ease, FACE_R, FONT, FUCHSIA, GREEN, INK, line, LOGO, MUTED, noise, text } from './eventShowRenderer.js'

const W = 1440
const H = 900
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value))
const lerp = (a, b, k) => a + (b - a) * k
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const mix = (a, b, k) => `rgb(${rgb(a).map((value, i) => Math.round(lerp(value, rgb(b)[i], k))).join(', ')})`
const rgba = (hex, alpha) => `rgba(${rgb(hex).join(', ')}, ${alpha})`
const SCRAMBLE = '01#%&$@/\\|<>{}[]=+*'

// The year in review is 0x1 to 0x7. They're looked up among the current and the past events alike, so the
// deck doesn't depend on whether 0x7 has been archived yet.
const RECAP_EVENTS = ['0x1', '0x2', '0x3', '0x4', '0x5', '0x6', '0x7'].map(id => [currentEvent, ...pastEvents].find(event => event.id === id))
const recapEvent = id => RECAP_EVENTS.find(event => event.id === id)
const scramble = seed => SCRAMBLE[Math.floor(noise(seed) * SCRAMBLE.length)]

// Same local projection as the build script: metres from the origin, y pointing south.
const METRES_PER_DEGREE = 111320
const COS = Math.cos(MAP.origin.lat * Math.PI / 180)
const project = (lat, lon) => [(lon - MAP.origin.lon) * METRES_PER_DEGREE * COS, (MAP.origin.lat - lat) * METRES_PER_DEGREE]
const unproject = (x, y) => [MAP.origin.lat - y / METRES_PER_DEGREE, MAP.origin.lon + x / (METRES_PER_DEGREE * COS)]

// A camera is a map point drawn at the centre of the 1440x900 stage, and metres per stage pixel.
const camera = (lat, lon, mpp, [atX, atY] = [W / 2, H / 2]) => {
  const [x, y] = project(lat, lon)
  return { x: x + (W / 2 - atX) * mpp, y: y + (H / 2 - atY) * mpp, mpp }
}
const toStage = (view, [x, y]) => [W / 2 + (x - view.x) / view.mpp, H / 2 + (y - view.y) / view.mpp]

const OVERVIEW = camera(40.748, -73.975, 13.5)
// Frames all seven venues.
const FINALE_VIEW = camera(40.7282, -74.0000, 10)
const STREET_MPP = 0.9
// Venue pins sit left of centre so the label fits to their right.
const PIN_AT = [560, 500]

// A venue's pin, label and camera. A badge is an extra callout under the label that flashes, along with the pin.
// side puts the venue's name left (-1) or right (1) of its marker on the finale's all-venues map.
// Building footprints only exist around the venues listed in scripts/build-recap-map.mjs.
function venue(id, host, address, lat, lon, { color = FUCHSIA, badge = null, side = 1 } = {}) {
  const { date } = recapEvent(id)
  const [year, month, day] = date.split('-').map(Number)
  const longDate = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  return {
    id,
    host,
    color,
    badge,
    side,
    tag: `${id}: ${date}`,
    label: `SPRAWL ${id}: ${host}`,
    detail: `${address}  /  ${longDate}`,
    point: project(lat, lon),
    view: camera(lat, lon, STREET_MPP, PIN_AT),
  }
}

// Each photo is captioned with its speaker: photo n of an event shows its talk n, so the names come from
// the schedule, less the company after the comma. 0x5's lightning talks aren't in the schedule; their
// speakers are listed here, in photo order.
const LIGHTNING_SPEAKERS = ['Ali Diamond', 'Jay Little', 'Ramazan Uysal', 'Will Woodruff', 'Perly Dahan', 'Brian Hong',
  'Joe Lothan', 'Edie Ismene Nicolaou', 'Eric Norris', 'Pete Markowsky', 'Kai Zhong']
function photoSpeaker(id, n) {
  if (id === '0x5') return LIGHTNING_SPEAKERS[n - 1] ?? ''
  return recapEvent(id)?.talks.find(talk => talk.id === Number(n))?.speaker.split(',')[0] ?? ''
}

// Photos from each event: src/assets/photos/<event>-<n>.jpg, so 2-1 is the first photo from 0x2. Any other
// photo there, like uwu-1.jpg, is kept by name for the slides that use it. The build resizes them to fit a
// 1600 px square, as WebP, and hands over each one's size for the layouts.
const PHOTOS = {}
const NAMED_PHOTOS = {}
for (const [file, photo] of Object.entries(import.meta.glob('./assets/photos/*.jpg', {
  eager: true,
  import: 'default',
  query: { w: 1600, h: 1600, fit: 'inside', format: 'webp', quality: 76, as: 'metadata' },
}))) {
  const entry = { src: photo.src, aspect: photo.width / photo.height }
  const [, event, n] = file.match(/\/(\d+)-(\d+)\.jpg$/) ?? []
  if (event) (PHOTOS[`0x${event}`] ??= [])[n - 1] = { ...entry, speaker: photoSpeaker(`0x${event}`, n) }
  else NAMED_PHOTOS[file.match(/([^/]+)\.jpg$/)[1]] = entry
}

const VENUES = [
  venue('0x1', 'Oscar Health', '75 VARICK ST', 40.72318, -74.00688, { side: -1 }),
  venue('0x2', 'Datadog', '620 8TH AVE', 40.75589, -73.98967),
  venue('0x3', 'Spotify', '4 WORLD TRADE CENTER', 40.71029, -74.01199, { side: -1 }),
  venue('0x4', 'Figma', '27 W 23RD ST', 40.74213, -73.99059),
  venue('0x5', 'Etsy', '117 ADAMS ST, BROOKLYN', 40.70051, -73.98822, { color: GREEN, badge: 'B R O O K L Y N' }),
  venue('0x6', 'CLEAR', '85 10TH AVE', 40.74311, -74.00784, { side: -1 }),
  venue('0x7', 'Microsoft', '300 LAFAYETTE ST', 40.72466, -73.99586),
]

export const SLIDES = [
  { name: 'SPRAWL 0x7 / 1-YEAR RECAP', draw: title },
  { name: 'ONE YEAR IN NUMBERS', draw: stats },
  { name: 'HACK SPACE CON / CAPE CANAVERAL', draw: launch },
  { name: 'NEW YORK CITY', view: OVERVIEW },
  // Each venue, then a card of its photos opening over it, for the venues that have photos.
  ...VENUES.flatMap(venue => [
    { name: `SPRAWL ${venue.id} / ${venue.host.toUpperCase()}`, view: venue.view, venue },
    ...PHOTOS[venue.id] ? [{ name: `SPRAWL ${venue.id} / PHOTOS`, view: venue.view, venue, photos: PHOTOS[venue.id].filter(Boolean) }] : [],
  ]),
  // Pull back until every venue is in frame, then trace the year's route through them.
  { name: 'SPRAWL 0x1 -> 0x7 / ONE YEAR IN NYC', view: FINALE_VIEW, finale: true },
  // Then the map falls away, and the route pulls itself into a pentagram.
  { name: 'SPRAWL 0x1 -> 0x7 / THE ROUTE', draw: route, seamless: true },
  { name: 'SPRAWL 0x1 -> 0x7 / PENTAGRAM', draw: pentagram, seamless: true },
  // The pentagram's circle becomes the ring of the challenge coin from the live show's first scene.
  { name: 'SPRAWL / CHALLENGE COIN', draw: coin, seamless: true },
  { name: 'UWU-UNDERGROUND', draw: underground, fadeIn: true },
  // What's next: 2027, and then SPRAWLcon flashes in under it.
  { name: '2027', draw: year },
  { name: '2027 / SPRAWLCON', draw: sprawlcon, seamless: true },
]

// slide: { index, from, fromTime } for the current slide and the one it replaced; time: seconds on this slide.
export function drawRecap(ctx, width, height, slide, time) {
  if (!width || !height) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  box(ctx, 0, 0, width, height, '#000')
  const scale = Math.min(width / W, height / H)
  ctx.save()
  ctx.translate((width - W * scale) / 2, (height - H * scale) / 2)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()
  const current = SLIDES[slide.index]
  const previous = SLIDES[slide.from]
  // A fadeIn slide first fades the slide before it to black, then starts.
  const fading = current.fadeIn && previous?.draw && previous !== current
  if (fading && time < FADE_THROUGH) {
    previous.draw(ctx, slide.fromTime + time)
    box(ctx, 0, 0, W, H, `rgba(0, 0, 0, ${ease(time / FADE_THROUGH)})`)
  } else if (current.view) {
    drawMapSlide(ctx, slide, time)
  } else {
    current.draw(ctx, fading ? time - FADE_THROUGH : time)
  }
  // Leaving a card (anything but the map): it glitches out over the incoming slide, unless the incoming
  // slide runs on seamlessly from it or fades through black instead.
  if (previous?.draw && previous !== current && !current.seamless && !current.fadeIn && time < OUTRO) {
    ctx.save()
    glitchOut(ctx, previous, slide.fromTime + time, time / OUTRO)
    ctx.restore()
  }
  for (let y = 0; y < H; y += 4) box(ctx, 0, y, W, 1, '#00000019')
  ctx.restore()
}

const OUTRO = 0.5
const FADE_THROUGH = 1.2
let outro = null
function glitchOut(ctx, previous, t, progress) {
  // Draw the outgoing card once offscreen, then tear that bitmap into bands.
  const scale = ctx.getTransform().a
  const [width, height] = [Math.ceil(W * scale), Math.ceil(H * scale)]
  if (outro?.width !== width || outro?.height !== height) outro = new OffscreenCanvas(width, height)
  const card = outro.getContext('2d')
  card.setTransform(scale, 0, 0, scale, 0, 0)
  card.clearRect(0, 0, W, H)
  previous.draw(card, t)
  box(ctx, 0, 0, W, H, `rgba(0, 0, 0, ${1 - progress})`)
  ctx.globalAlpha = 1 - ease(progress)
  // Torn horizontal bands slide apart as the card collapses.
  const band = H / 14
  for (let i = 0; i < 14; i++) {
    const shift = (noise(i * 3.1 + Math.floor(t * 30)) - 0.5) * 260 * progress
    const visible = band * (1 - progress * 0.7)
    ctx.drawImage(outro, 0, i * band * scale, width, visible * scale, shift, i * band, W, visible)
  }
}

// ---- Title card ---------------------------------------------------------------------------------

// The chunky 7-row pixel font of the SPRAWL logo, for 0x7 and the stats.
const PIXELS = {
  0: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
  1: ['01100', '11100', '01100', '01100', '01100', '01100', '11110'],
  2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
  3: ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
  4: ['11011', '11011', '11011', '11111', '00011', '00011', '00011'],
  5: ['11111', '11000', '11110', '00011', '00011', '11011', '01110'],
  6: ['01110', '11000', '11000', '11110', '11011', '11011', '01110'],
  7: ['11111', '00011', '00011', '00110', '01100', '01100', '01100'],
  8: ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
  9: ['01110', '11011', '11011', '01111', '00011', '00011', '01110'],
  x: ['00000', '00000', '11011', '01110', '00100', '01110', '11011'],
  '.': ['00', '00', '00', '00', '00', '11', '11'],
}
const pixelRows = value => Array.from({ length: 7 }, (_, row) => [...value].map(glyph => PIXELS[glyph][row]).join('0'))
const SUFFIX = pixelRows('0x7')
const cells = rows => rows.flatMap((row, y) => [...row].flatMap((pixel, x) => pixel === '1' ? [[x, y]] : []))
const LOGO_CELLS = cells(LOGO)
const SUFFIX_CELLS = cells(SUFFIX)
const CELL = 30
const LOGO_X = W / 2 - LOGO[0].length * CELL / 2
const LOGO_Y = 200
const SUFFIX_CELL = 18
const SUFFIX_X = W / 2 - SUFFIX[0].length * SUFFIX_CELL / 2
const SUFFIX_Y = 468
const SUBTITLE = '1 - Y E A R   R E C A P'
const SUBTITLE_Y = 646

// Beats of the title card, in seconds.
const GRID_IN = 0.6
const FILL_START = 1.8
const FILL_END = 7
const FLASH = 7.15
const SLAM = 7.9
const SLAM_LENGTH = 0.45
const TYPE_START = 9
const TYPE_RATE = 14
const SETTLED = TYPE_START + SUBTITLE.length / TYPE_RATE + 0.6

const monthYear = event => new Date(`${event.date.slice(0, 7)}-15`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
const SPAN = `${monthYear(RECAP_EVENTS[0])}  ->  ${monthYear(RECAP_EVENTS.at(-1))}     ${RECAP_EVENTS.length} EVENTS     NEW YORK CITY`

const BOOT = ['> /slides', '> mount recap.dat .......... ok', '> decrypt 0x1-0x7 ........... ok', '> render']

function title(ctx, t) {
  // A hit of camera shake when 0x7 lands.
  const impact = t - SLAM - SLAM_LENGTH
  if (impact > 0 && impact < 0.35) {
    const decay = 1 - impact / 0.35
    ctx.translate((noise(t * 91) - 0.5) * 16 * decay, (noise(t * 57) - 0.5) * 12 * decay)
  }
  BOOT.forEach((value, i) => {
    const shown = Math.floor((t - i * 0.45) * 40)
    if (shown <= 0) return
    const fade = clamp((SETTLED + 1 - t) / 1.5)
    ctx.globalAlpha = fade
    text(ctx, value.slice(0, shown), 64, 64 + i * 22, 16, i === BOOT.length - 1 ? GREEN : MUTED)
    ctx.globalAlpha = 1
  })
  drawLogo(ctx, t)
  drawSuffix(ctx, t)
  drawSubtitle(ctx, t)
}

function drawLogo(ctx, t) {
  const fillLevel = ease((t - FILL_START) / (FILL_END - FILL_START)) * 7.6
  const flash = clamp(1 - Math.abs(t - FLASH) / 0.25)
  // After the fill, a light bar sweeps across the logo every few seconds.
  const sweepX = t > FILL_END ? ((t - FILL_END) % 6) / 1.6 * (LOGO[0].length + 12) - 6 : -99
  // Once settled, a cell or two flickers into a glyph now and then.
  const flicker = Math.floor(t * 6)
  for (const [col, row] of LOGO_CELLS) {
    const x = LOGO_X + col * CELL
    const y = LOGO_Y + row * CELL
    const appear = GRID_IN + noise(col * 7.1 + row * 3.3) * 1.1
    if (t < appear) continue
    // The frame of every cell traces in first.
    const frame = clamp((t - appear) / 0.25)
    ctx.strokeStyle = `rgba(111, 231, 231, ${0.35 * frame})`
    ctx.lineWidth = 1
    ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5)
    // Liquid fill rises from the bottom row; the surface wobbles across columns.
    const wave = Math.sin(col * 0.55 + t * 3.2) * 0.35
    const depth = clamp(fillLevel + wave - (6 - row))
    if (depth < 1 && t > appear + 0.2) {
      // The empty part of the cell scrambles while it waits.
      text(ctx, scramble(col * 13 + row * 7 + Math.floor(t * 12)), x + CELL / 2, y + 7, 16, '#1f4d50', 'center')
    }
    if (depth <= 0) continue
    const fillHeight = (CELL - 6) * depth
    const top = y + 3 + (CELL - 6) - fillHeight
    const gradient = lerp(0, 1, row / 6)
    ctx.fillStyle = depth < 1 ? CYAN : `rgb(${lerp(204, 111, gradient * 0.5)}, ${lerp(255, 231, gradient * 0.5)}, ${lerp(139, 231, gradient * 0.5)})`
    ctx.fillRect(x + 3, top, CELL - 6, fillHeight)
    if (depth < 1) box(ctx, x + 3, top, CELL - 6, 2, '#ffffff')
    const sweep = clamp(1 - Math.abs(col - sweepX) / 3)
    const glow = Math.max(flash, sweep * 0.6)
    if (glow > 0) box(ctx, x + 3, y + 3, CELL - 6, CELL - 6, `rgba(255, 255, 255, ${glow})`)
    if (t > FILL_END + 0.5 && noise(col * 3.7 + row * 11.3 + flicker) > 0.985) {
      box(ctx, x + 3, y + 3, CELL - 6, CELL - 6, INK)
      text(ctx, scramble(col + row + flicker), x + CELL / 2, y + 7, 16, GREEN, 'center')
    }
  }
  if (t > FILL_START && t < FILL_END + 0.3) {
    const percent = Math.floor(clamp(fillLevel / 7.6) * 100)
    text(ctx, `SYNC ${String(percent).padStart(3, ' ')}%`, LOGO_X + LOGO[0].length * CELL, LOGO_Y + 7 * CELL + 12, 14, MUTED, 'right')
  }
}

function drawSuffix(ctx, t) {
  if (t < SLAM) return
  // 0x7 slams in from oversized, its colour channels converging as it lands.
  const k = clamp((t - SLAM) / SLAM_LENGTH)
  const landed = k >= 1
  const scale = lerp(3.2, 1, 1 - (1 - k) ** 3)
  const split = landed ? glitchSplit(t) : (1 - k) * 46
  const width = SUFFIX[0].length * SUFFIX_CELL
  const height = 7 * SUFFIX_CELL
  ctx.save()
  ctx.translate(SUFFIX_X + width / 2, SUFFIX_Y + height / 2)
  ctx.scale(scale, scale)
  ctx.translate(-width / 2, -height / 2)
  ctx.globalAlpha = clamp(k * 2.5)
  if (split > 0) {
    ctx.globalCompositeOperation = 'lighter'
    paintSuffix(ctx, -split, 0, '#00e5ff', 0.7)
    paintSuffix(ctx, split, 0, '#ff2b6e', 0.7)
    ctx.globalCompositeOperation = 'source-over'
  }
  paintSuffix(ctx, 0, 0, FUCHSIA, 1)
  ctx.restore()
  // A shockwave ring and a flash bar when it lands.
  const after = t - SLAM - SLAM_LENGTH
  if (after > 0 && after < 0.7) {
    const ring = ease(after / 0.7)
    ctx.strokeStyle = `rgba(255, 79, 216, ${0.8 * (1 - ring)})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(W / 2, SUFFIX_Y + height / 2, 160 + ring * 600, 70 + ring * 200, 0, 0, Math.PI * 2)
    ctx.stroke()
    box(ctx, 0, SUFFIX_Y + height / 2 - 1, W, 2, `rgba(255, 79, 216, ${0.9 * (1 - ring)})`)
  }
  // Glitch slices for a moment after impact, then again every few seconds.
  if (landed && glitchSplit(t) > 0) {
    for (let i = 0; i < 3; i++) {
      const y = SUFFIX_Y + Math.floor(noise(Math.floor(t * 20) + i * 5) * 7) * SUFFIX_CELL
      const shift = (noise(Math.floor(t * 20) * 3 + i) - 0.5) * 60
      box(ctx, SUFFIX_X - 40, y, width + 80, SUFFIX_CELL, '#000')
      ctx.save()
      ctx.beginPath()
      ctx.rect(SUFFIX_X - 40, y, width + 80, SUFFIX_CELL)
      ctx.clip()
      paintSuffix(ctx, SUFFIX_X + shift, SUFFIX_Y, FUCHSIA, 1)
      ctx.restore()
    }
  }
}

// Chromatic offset for the landed 0x7: a burst right after impact, then brief glitches every ~4.3 s.
function glitchSplit(t) {
  const after = t - SLAM - SLAM_LENGTH
  if (after < 0.3) return 10 * (1 - after / 0.3)
  const phase = (after - 1.5) % 4.3
  return after > 1.5 && phase < 0.18 ? 4 + noise(Math.floor(t * 30)) * 8 : 0
}

function paintSuffix(ctx, x, y, color, alpha) {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = alpha === 1 ? 18 : 0
  for (const [col, row] of SUFFIX_CELLS) ctx.fillRect(x + col * SUFFIX_CELL + 1, y + row * SUFFIX_CELL + 1, SUFFIX_CELL - 2, SUFFIX_CELL - 2)
  ctx.restore()
}

function drawSubtitle(ctx, t) {
  if (t < TYPE_START) return
  const shown = Math.min(SUBTITLE.length, Math.floor((t - TYPE_START) * TYPE_RATE))
  let value = SUBTITLE.slice(0, shown)
  // The newest letter decodes from noise before it settles.
  if (shown < SUBTITLE.length && SUBTITLE[shown] !== ' ') value += scramble(Math.floor(t * 40))
  text(ctx, value, W / 2 - SUBTITLE.length * 8, SUBTITLE_Y, 32, '#e0efec')
  const typing = shown < SUBTITLE.length
  if (typing || Math.floor(t * 2) % 2) box(ctx, W / 2 - SUBTITLE.length * 8 + value.length * 16 + 4, SUBTITLE_Y + 2, 14, 30, GREEN)
  if (t > SETTLED) {
    ctx.globalAlpha = clamp((t - SETTLED) / 0.6)
    line(ctx, W / 2 - 260, SUBTITLE_Y + 58, W / 2 + 260, SUBTITLE_Y + 58, '#274047')
    text(ctx, SPAN, W / 2, SUBTITLE_Y + 74, 16, MUTED, 'center')
    ctx.globalAlpha = 1
  }
}

// ---- Stats ---------------------------------------------------------------------------------------

const STATS = [
  { value: 7, label: 'EVENTS' },
  { value: 25, label: 'SPEAKERS', note: '11 LIGHTNING TALKS' },
  { value: 8.5, label: 'HOURS OF TECHNICAL CONTENT' },
  { value: 723, label: 'UNIQUE SUBSCRIBERS' },
]
const STAT_CELL = 14
const STAT_TOP = 180
const STAT_ROW = 150
// Numbers are right-aligned to this edge, labels start just after it.
const STAT_EDGE = 600
const STAT_LABEL_X = 660
const STAT_STAGGER = 0.7
const COUNT = 1.4

function stats(ctx, t) {
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === stats), ease(t / 0.5))
  STATS.forEach((stat, i) => {
    const local = t - 0.5 - i * STAT_STAGGER
    if (local < 0) return
    const top = STAT_TOP + i * STAT_ROW
    // A divider draws in, then the number counts up and flashes as it lands.
    const divider = ease(local / 0.5)
    line(ctx, W / 2 - 360 * divider, top + 124, W / 2 + 360 * divider, top + 124, '#1a3036')
    const counted = 1 - (1 - clamp(local / COUNT)) ** 3
    const value = (stat.value * counted).toFixed(Number.isInteger(stat.value) ? 0 : 1)
    const flash = local < COUNT ? 0 : clamp(1 - (local - COUNT) / 0.4)
    ctx.save()
    if (local >= COUNT) {
      ctx.shadowColor = GREEN
      ctx.shadowBlur = 14
    }
    ctx.fillStyle = local < COUNT ? CYAN : mix(GREEN, '#ffffff', flash)
    const rows = pixelRows(value)
    const left = STAT_EDGE - rows[0].length * STAT_CELL
    for (const [col, row] of cells(rows)) ctx.fillRect(left + col * STAT_CELL + 1, top + row * STAT_CELL + 1, STAT_CELL - 2, STAT_CELL - 2)
    ctx.restore()
    const labelTop = stat.note ? top + 14 : top + 33
    const typed = Math.floor((local - 0.2) * 40)
    if (typed > 0) text(ctx, stat.label.slice(0, typed), STAT_LABEL_X, labelTop, 32, '#e0efec')
    const noted = Math.floor((local - 0.2) * 40) - stat.label.length
    if (stat.note && noted > 0) text(ctx, stat.note.slice(0, noted), STAT_LABEL_X, top + 60, 20, FUCHSIA)
  })
}

// ---- Launch: Hack Space Con ---------------------------------------------------------------------

const YEAR_CELLS = cells(pixelRows('2025'))
const YEAR_CELL = 22
const YEAR_X = 112
const YEAR_Y = 300
const PLACE = 'May 15, Cape Canaveral, Florida'
const HOST = '@ Hack Space Con'
// The launch camera's viewport, and the rocket's place in it.
const CAM = { x: 760, y: 110, w: 600, h: 680 }
const ROCKET_X = CAM.x + 330
const GROUND = CAM.y + CAM.h - 60
const PAD = 14
const LIFTOFF = 4.5
const IGNITION = LIFTOFF - 1.2
const ARM_SWING = LIFTOFF - 2.6
// Climb in stage pixels: a slow push off the pad up to a gentle top speed.
const THRUST = 8
const TOP_SPEED = 70
// How far the rocket rises on screen before the camera starts tracking it.
const MAX_RISE = 250
const TOWER = '#2a5258'
const FLAME = ['#fff6d5', '#ffd27a', '#ff8a5c', FUCHSIA]
const PLUME_GLYPHS = '#%&@*+'
const SMOKE_GLYPHS = '@%#*+=-:.'
const SMOKE = 180
const SMOKE_SPAN = 7
const SMOKE_LIFE = 5

function altitude(s) {
  if (s <= 0) return 0
  const cruise = TOP_SPEED / THRUST
  return s < cruise ? THRUST * s * s / 2 : TOP_SPEED * cruise / 2 + TOP_SPEED * (s - cruise)
}

function launch(ctx, t) {
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === launch), ease(t / 0.5))
  // The year decodes cell by cell.
  ctx.save()
  ctx.beginPath()
  for (const [col, row] of YEAR_CELLS) {
    const at = 0.3 + noise(col * 5.3 + row * 2.1) * 0.9
    const x = YEAR_X + col * YEAR_CELL
    const y = YEAR_Y + row * YEAR_CELL
    if (t < at) continue
    if (t < at + 0.25) text(ctx, scramble(col * 7 + row * 3 + Math.floor(t * 14)), x + YEAR_CELL / 2, y + 3, 16, CYAN, 'center')
    else ctx.rect(x + 1, y + 1, YEAR_CELL - 2, YEAR_CELL - 2)
  }
  ctx.shadowColor = GREEN
  ctx.shadowBlur = 12
  ctx.fillStyle = GREEN
  ctx.fill()
  ctx.restore()
  const typed = Math.floor((t - 1.2) * 30)
  if (typed > 0) text(ctx, PLACE.slice(0, typed), YEAR_X, YEAR_Y + 7 * YEAR_CELL + 40, 28, '#e0efec')
  const hosted = typed - PLACE.length - 6
  if (hosted > 0) {
    ctx.save()
    ctx.shadowColor = FUCHSIA
    ctx.shadowBlur = 18
    text(ctx, HOST.slice(0, hosted), YEAR_X, YEAR_Y + 7 * YEAR_CELL + 92, 40, FUCHSIA)
    ctx.restore()
  }
  drawLaunchCam(ctx, t)
}

function drawLaunchCam(ctx, t) {
  const s = t - LIFTOFF
  const climb = altitude(s)
  const rise = MAX_RISE * (1 - Math.exp(-climb / MAX_RISE))
  // Once the camera tracks the rocket, the world slides down past it.
  const scroll = climb - rise
  const ground = GROUND + scroll
  const shake = t > IGNITION && s < 4 ? (noise(t * 53) - 0.5) * 1.6 : 0
  const x = ROCKET_X + shake
  const y = GROUND - PAD - rise
  ctx.save()
  ctx.beginPath()
  ctx.rect(CAM.x, CAM.y, CAM.w, CAM.h)
  ctx.clip()
  box(ctx, CAM.x, CAM.y, CAM.w, CAM.h, '#03080b')
  for (let i = 0; i < 70; i++) {
    const starY = CAM.y + (noise(i * 7.7) * CAM.h + scroll * 0.25) % CAM.h
    box(ctx, CAM.x + noise(i * 3.1) * CAM.w, starY, 2, 2, i % 7 ? '#1d3a40' : '#6f9497')
  }
  box(ctx, CAM.x, ground, CAM.w, CAM.h, '#060d10')
  line(ctx, CAM.x, ground, CAM.x + CAM.w, ground, TOWER)
  for (let tick = CAM.x + 12; tick < CAM.x + CAM.w; tick += 24) line(ctx, tick, ground + 8, tick - 8, ground + 16, '#14262a')
  drawTower(ctx, ground, t)
  box(ctx, ROCKET_X - 90, ground - PAD, 180, PAD, '#0b1a1f', TOWER)
  if (t > IGNITION) {
    const ignite = clamp((t - IGNITION) / 0.6)
    const glow = ctx.createRadialGradient(x, y + 16, 0, x, y + 16, 110)
    glow.addColorStop(0, `rgba(255, 210, 122, ${0.45 * ignite})`)
    glow.addColorStop(1, 'rgba(255, 210, 122, 0)')
    box(ctx, x - 110, y - 94, 220, 220, glow)
    drawPlume(ctx, x, y, t, Math.min(ground - y, 620) * ignite)
  }
  drawRocket(ctx, x, y)
  drawSmoke(ctx, ground, t)
  // Keep the telemetry readable over the exhaust trail.
  const shade = ctx.createLinearGradient(0, CAM.y + CAM.h - 72, 0, CAM.y + CAM.h)
  shade.addColorStop(0, 'rgba(3, 8, 11, 0)')
  shade.addColorStop(0.5, 'rgba(3, 8, 11, 0.85)')
  shade.addColorStop(1, 'rgba(3, 8, 11, 0.85)')
  box(ctx, CAM.x, CAM.y + CAM.h - 72, CAM.w, 72, shade)
  ctx.restore()

  ctx.strokeStyle = '#1f3d42'
  ctx.lineWidth = 1
  ctx.strokeRect(CAM.x + 0.5, CAM.y + 0.5, CAM.w, CAM.h)
  text(ctx, 'CAM 02  /  CAPE CANAVERAL', CAM.x + 16, CAM.y + 14, 14, MUTED)
  if (Math.floor(t * 1.5) % 2 === 0) {
    box(ctx, CAM.x + CAM.w - 62, CAM.y + 18, 8, 8, FUCHSIA)
    text(ctx, 'REC', CAM.x + CAM.w - 16, CAM.y + 14, 14, FUCHSIA, 'right')
  }
  const seconds = Math.floor(Math.max(0, s))
  const clock = s < 0 ? `T- 00:${String(Math.ceil(-s)).padStart(2, '0')}`
    : `T+ ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const status = t < ARM_SWING ? 'TERMINAL COUNT' : t < IGNITION ? 'ARM RETRACT' : s < 0 ? 'IGNITION' : 'LIFTOFF'
  // Telemetry runs at a believable 12 m/s², even though the picture climbs slowly.
  const metres = s > 0 ? 6 * s * s : 0
  text(ctx, clock, CAM.x + 16, CAM.y + CAM.h - 44, 22, GREEN)
  text(ctx, status, CAM.x + 140, CAM.y + CAM.h - 40, 16, s < 0 ? '#ffd27a' : CYAN)
  text(ctx, `ALT ${(metres / 1000).toFixed(2)} KM   VEL ${Math.round(Math.max(0, s) * 12 * 3.6)} KM/H`, CAM.x + CAM.w - 16, CAM.y + CAM.h - 40, 16, '#c3d9d5', 'right')
}

function drawTower(ctx, ground, t) {
  const left = ROCKET_X - 104
  const right = ROCKET_X - 72
  const top = ground - 340
  line(ctx, left, ground, left, top, TOWER, 2)
  line(ctx, right, ground, right, top, TOWER, 2)
  for (let y = ground; y > top; y -= 32) {
    line(ctx, left, y, right, y, TOWER)
    line(ctx, left, y, right, Math.max(top, y - 32), TOWER)
    line(ctx, right, y, left, Math.max(top, y - 32), TOWER)
  }
  line(ctx, left - 12, top, right + 18, top, TOWER, 2)
  if (Math.floor(t * 1.2) % 2) box(ctx, left + 12, top - 8, 6, 6, '#ff4b3e')
  // The access arm swings clear of the rocket before ignition.
  const swing = ease((t - ARM_SWING) / 1.2) * 1.25
  const pivotY = ground - 274
  line(ctx, right, pivotY, right + Math.cos(swing) * 48, pivotY - Math.sin(swing) * 48, '#3b8d93', 4)
}

function drawRocket(ctx, x, y) {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = 2
  ctx.strokeStyle = CYAN
  ctx.fillStyle = '#0a161b'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(24 * side, -88)
    ctx.lineTo(46 * side, -16)
    ctx.lineTo(46 * side, -2)
    ctx.lineTo(24 * side, -24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(-24, -22)
  ctx.lineTo(-24, -250)
  ctx.quadraticCurveTo(-24, -298, 0, -318)
  ctx.quadraticCurveTo(24, -298, 24, -250)
  ctx.lineTo(24, -22)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-12, -22)
  ctx.lineTo(12, -22)
  ctx.lineTo(18, 0)
  ctx.lineTo(-18, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#6f9497'
  ctx.stroke()
  for (const seam of [-60, -250]) line(ctx, -23, seam, 23, seam, '#1f4d50')
  box(ctx, -23, -112, 46, 8, FUCHSIA)
  ;[...'SPRAWL'].forEach((letter, i) => text(ctx, letter, 0, -240 + i * 18, 16, GREEN, 'center'))
  ctx.restore()
}

// ASCII exhaust: white-hot at the nozzle, through amber to fuchsia, then a fading smoke trail.
function drawPlume(ctx, x, y, t, length) {
  ctx.save()
  ctx.font = `12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const frame = Math.floor(t * 18)
  for (let d = 0; d < length; d += 9) {
    const half = 8 + 20 * Math.sin(clamp(d / 140) * Math.PI / 2) + Math.max(0, d - 140) * 0.12
    ctx.fillStyle = d < 24 ? FLAME[0] : d < 70 ? FLAME[1] : d < 130 ? FLAME[2] : d < 220 ? FLAME[3] : '#2c4a50'
    ctx.globalAlpha = Math.min(1, (length - d) / 120)
    for (let c = -half; c <= half; c += 8) {
      if (noise(c * 1.3 + d * 0.7 + frame) < 0.25) continue
      ctx.fillText(PLUME_GLYPHS[Math.floor(noise(c * 2.9 + d * 1.1 + frame * 0.37) * PLUME_GLYPHS.length)], x + c, y + d)
    }
  }
  ctx.restore()
}

// Exhaust smoke billows out along the ground from the pad and thins as it ages.
function drawSmoke(ctx, ground, t) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < SMOKE; i++) {
    const age = t - (IGNITION + 0.3 + i / SMOKE * SMOKE_SPAN)
    if (age < 0 || age > SMOKE_LIFE) continue
    const k = age / SMOKE_LIFE
    const side = i % 2 ? 1 : -1
    const speed = 50 + noise(i * 3.3) * 110
    const x = ROCKET_X + side * (14 + speed * age * (1 - k / 2))
    const y = ground - 10 - age * (6 + noise(i * 5.1) * 18)
    const size = Math.round(12 + k * 16)
    ctx.font = `${size}px ${FONT}`
    ctx.fillStyle = k < 0.12 ? '#ffd27a' : '#5d7f84'
    ctx.globalAlpha = (1 - k) * 0.85
    const glyph = SMOKE_GLYPHS[Math.floor(k * SMOKE_GLYPHS.length)]
    ctx.fillText(glyph, x, y)
    ctx.fillText(glyph, x + side * size * 0.6, y + size * 0.3)
  }
  ctx.restore()
}

// ---- Map ----------------------------------------------------------------------------------------

const WATER = '#020507'
const LAND = '#0d1a1f'
const PARK = '#0f2420'
const BUILDING = '#11222a'
const BUILDING_EDGE = '#1d3b44'
// Width in stage pixels at the overview (far) and at street level (near).
const ROADS = [
  { layer: 'minor', far: { color: '#1f3d44', width: 0.45 }, near: { color: '#17292f', width: 7 } },
  { layer: 'mid', far: { color: '#2d5f67', width: 0.8 }, near: { color: '#1c343b', width: 11 } },
  { layer: 'major', far: { color: '#3f9399', width: 1.3 }, near: { color: '#22424a', width: 12 } },
]

let layers = null
function decode(flat) {
  const points = []
  let x = 0
  let y = 0
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i]
    y += flat[i + 1]
    points.push([x, y])
  }
  return points
}
function toPath(lines, closed) {
  const path = new Path2D()
  for (const points of lines) {
    points.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y))
    if (closed) path.closePath()
  }
  return path
}
// The data is delta-encoded, which is exactly SVG's relative lineto, so each layer becomes one SVG path
// string that Path2D parses natively. Point by point, lineTo calls took the better part of two seconds.
const svgPath = (features, closed) => features.map(flat => `M${flat[0]} ${flat[1]}l${flat.slice(2).join(' ')}${closed ? 'z' : ''}`).join('')
// Path2D only exists in the browser, so the layers are built on first draw.
function mapLayers() {
  if (!layers) {
    layers = {
      land: new Path2D(svgPath(MAP.land, true)),
      parks: new Path2D(svgPath(MAP.parks, true)),
      minor: new Path2D(svgPath(MAP.roads.minor)),
      mid: new Path2D(svgPath(MAP.roads.mid)),
      major: new Path2D(svgPath(MAP.roads.major)),
      buildings: new Path2D(svgPath(MAP.buildings, true)),
      footprints: new Map(),
    }
  }
  return layers
}

// Builds the map layers and venue outlines ahead of the first map slide. EventShow calls this in an idle
// moment once the visuals open, so the deck never pauses to build them.
export function prepare() {
  mapLayers()
  for (const { point } of VENUES) footprint(point)
  for (const photo of [...Object.values(PHOTOS).flat(), ...Object.values(NAMED_PHOTOS)]) loadPhoto(photo)
}

// The building a venue's pin lands in, outlined on arrival. An address point can sit on the pavement,
// so failing a direct hit, take the nearest building within 40 m.
function footprint(point) {
  const { footprints } = mapLayers()
  if (!footprints.has(point)) {
    const [px, py] = point
    let best = null
    let bestDistance = 40
    for (const flat of MAP.buildings) {
      const ring = decode(flat)
      let inside = false
      let distance = Infinity
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside
        const k = clamp(((px - xj) * (xi - xj) + (py - yj) * (yi - yj)) / ((xi - xj) ** 2 + (yi - yj) ** 2 || 1))
        distance = Math.min(distance, Math.hypot(px - lerp(xj, xi, k), py - lerp(yj, yi, k)))
      }
      if (inside) { best = ring; break }
      if (distance < bestDistance) { best = ring; bestDistance = distance }
    }
    footprints.set(point, best ? toPath([best], true) : null)
  }
  return footprints.get(point)
}

// Overview labels fade out as the camera closes in; neighbourhood labels fade in.
const LABELS = [
  { at: [40.7755, -73.9705], value: 'M A N H A T T A N', size: 22, color: '#8fb0b2', angle: -61, far: true },
  { at: [40.7040, -73.9480], value: 'B R O O K L Y N', size: 18, color: MUTED, far: true },
  { at: [40.7480, -73.9150], value: 'Q U E E N S', size: 18, color: MUTED, far: true },
  { at: [40.7300, -74.0640], value: 'N E W   J E R S E Y', size: 18, color: MUTED, far: true },
  { at: [40.7760, -74.0020], value: 'HUDSON RIVER', size: 14, color: '#2f7f86', angle: -66, far: true },
  { at: [40.7320, -73.9665], value: 'EAST RIVER', size: 14, color: '#2f7f86', angle: -62, far: true },
  { at: [40.7262, -74.0085], value: 'H U D S O N   S Q U A R E', size: 15, color: '#6f9497' },
  { at: [40.7212, -74.0080], value: 'T R I B E C A', size: 15, color: '#6f9497' },
  { at: [40.7255, -74.0000], value: 'S O H O', size: 15, color: '#6f9497' },
  { at: [40.7335, -74.0040], value: 'W E S T   V I L L A G E', size: 15, color: '#6f9497' },
  { at: [40.7160, -73.9985], value: 'C H I N A T O W N', size: 15, color: '#6f9497' },
  { at: [40.7580, -73.9855], value: 'T I M E S   S Q U A R E', size: 15, color: '#6f9497' },
  { at: [40.7540, -73.9915], value: 'G A R M E N T   D I S T R I C T', size: 15, color: '#6f9497' },
  { at: [40.7585, -73.9935], value: "H E L L ' S   K I T C H E N", size: 15, color: '#6f9497' },
  { at: [40.7085, -74.0090], value: 'F I N A N C I A L   D I S T R I C T', size: 15, color: '#6f9497' },
  { at: [40.7115, -74.0158], value: 'B A T T E R Y   P A R K   C I T Y', size: 15, color: '#6f9497' },
  { at: [40.7410, -73.9895], value: 'F L A T I R O N', size: 15, color: '#6f9497' },
  { at: [40.7450, -73.9880], value: 'N O M A D', size: 15, color: '#6f9497' },
  { at: [40.7030, -73.9880], value: 'D U M B O', size: 15, color: '#6f9497' },
  { at: [40.7030, -73.9820], value: 'V I N E G A R   H I L L', size: 15, color: '#6f9497' },
  { at: [40.6985, -73.9915], value: 'B R O O K L Y N   H E I G H T S', size: 15, color: '#6f9497' },
  { at: [40.7455, -74.0020], value: 'C H E L S E A', size: 15, color: '#6f9497' },
  { at: [40.7450, -74.0055], value: 'H I G H   L I N E', size: 15, color: '#6f9497' },
  { at: [40.7412, -74.0070], value: 'M E A T P A C K I N G', size: 15, color: '#6f9497' },
  { at: [40.7270, -73.9930], value: 'N O H O', size: 15, color: '#6f9497' },
  { at: [40.7225, -73.9955], value: 'N O L I T A', size: 15, color: '#6f9497' },
  { at: [40.7270, -73.9880], value: 'E A S T   V I L L A G E', size: 15, color: '#6f9497' },
  { at: [40.7278, -73.9990], value: 'G R E E N W I C H   V I L L A G E', size: 15, color: '#6f9497' },
].map(label => ({ ...label, point: project(...label.at) }))

// 0 at the overview, 1 at street level.
const detailOf = view => clamp(Math.log(OVERVIEW.mpp / view.mpp) / Math.log(OVERVIEW.mpp / STREET_MPP))

function drawMap(ctx, view) {
  const map = mapLayers()
  const detail = detailOf(view)
  const px = view.mpp
  box(ctx, 0, 0, W, H, WATER)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(1 / px, 1 / px)
  ctx.translate(-view.x, -view.y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.fillStyle = LAND
  ctx.fill(map.land)
  ctx.fillStyle = PARK
  ctx.fill(map.parks)
  // Roads glow as fine lines from afar and widen into plain streets up close.
  const street = detail ** 1.5
  for (const { layer, far, near } of ROADS) {
    ctx.strokeStyle = mix(far.color, near.color, street)
    ctx.lineWidth = lerp(far.width, near.width, street) * px
    ctx.stroke(map[layer])
  }
  // Footprints exist only around venues, so they fade in late in the zoom.
  const buildings = clamp((1.8 - px) / 0.6)
  if (buildings > 0) {
    ctx.globalAlpha = buildings
    ctx.fillStyle = BUILDING
    ctx.fill(map.buildings)
    ctx.strokeStyle = BUILDING_EDGE
    ctx.lineWidth = px
    ctx.stroke(map.buildings)
    ctx.globalAlpha = 1
  }
  // Glowing shoreline.
  ctx.strokeStyle = '#6fe7e714'
  ctx.lineWidth = 7 * px
  ctx.stroke(map.land)
  ctx.strokeStyle = '#6fe7e780'
  ctx.lineWidth = 1.1 * px
  ctx.stroke(map.land)
  ctx.restore()
  drawGrid(ctx, view)
  for (const label of LABELS) {
    const alpha = label.far ? clamp((px - 5) / 4) : clamp((2.4 - px) / 0.8)
    if (alpha <= 0) continue
    const [x, y] = toStage(view, label.point)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x, y)
    ctx.rotate((label.angle ?? 0) * Math.PI / 180)
    text(ctx, label.value, 0, -label.size / 2, label.size, label.color, 'center')
    ctx.restore()
  }
}

// A faint survey grid: kilometres at the overview, 100 m blocks up close.
function drawGrid(ctx, view) {
  for (const [spacing, alpha] of [[1000, clamp((view.mpp - 3) / 4)], [100, clamp((2.2 - view.mpp) / 1)]]) {
    if (alpha <= 0) continue
    const color = `rgba(111, 231, 231, ${0.05 * alpha})`
    const [left, top] = [view.x - W / 2 * view.mpp, view.y - H / 2 * view.mpp]
    for (let x = Math.ceil(left / spacing) * spacing; x < left + W * view.mpp; x += spacing) {
      const sx = Math.round(toStage(view, [x, 0])[0]) + 0.5
      line(ctx, sx, 0, sx, H, color)
    }
    for (let y = Math.ceil(top / spacing) * spacing; y < top + H * view.mpp; y += spacing) {
      const sy = Math.round(toStage(view, [0, y])[1]) + 0.5
      line(ctx, 0, sy, W, sy, color)
    }
  }
}

// Flights keep the start of each transition, keyed by the slide object EventShow hands us.
const flights = new WeakMap()
let lastView = OVERVIEW
const FLIGHT = 4.5
const REVEAL = 1.6

function drawMapSlide(ctx, slide, time) {
  const current = SLIDES[slide.index]
  const previous = SLIDES[slide.from]
  // A photo card opens over its venue as the venue slide left it: no flight, no reveal.
  const still = Boolean(current.photos)
  // From another map slide, fly from wherever the camera was; otherwise the map boots in on the spot.
  if (!flights.has(slide)) flights.set(slide, !still && previous?.view ? lastView : null)
  const start = flights.get(slide)
  const view = start ? fly(start, current.view, time / FLIGHT) : current.view
  lastView = view
  const revealTime = start || still ? Infinity : time - (previous ? OUTRO * 0.6 : 0)
  ctx.save()
  if (revealTime < REVEAL) {
    // A radar ring expands from the centre of the map, uncovering it.
    const radius = ease(revealTime / REVEAL) * 900
    if (radius <= 0) { ctx.restore(); return }
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2)
    ctx.clip()
  }
  drawMap(ctx, view)
  // Venues already visited stay on the map as small markers.
  if (current.venue) drawVisited(ctx, view, VENUES.slice(0, VENUES.indexOf(current.venue)))
  ctx.restore()
  if (revealTime < REVEAL) {
    const radius = ease(revealTime / REVEAL) * 900
    ctx.strokeStyle = `rgba(111, 231, 231, ${0.9 * (1 - revealTime / REVEAL)})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  // A photo slide's venue is long since locked and labelled.
  const settled = still ? time + 10 : time
  const arrived = still ? settled : start ? time - FLIGHT : revealTime - REVEAL
  if (current.venue) drawVenue(ctx, view, current.venue, settled, arrived)
  if (current.finale) drawFinale(ctx, view, arrived)
  // Leaving a photo card, it folds back into its pin as the camera sets off.
  const closing = previous?.photos && !still ? 1 - time / CARD_CLOSE : 0
  if (still || closing > 0) box(ctx, 0, 0, W, H, `rgba(0, 0, 0, ${0.72 * (still ? ease(time / 0.5) : closing)})`)
  drawHud(ctx, view, slide.index, clamp(start || still ? 1 : revealTime / REVEAL))
  if (still) drawPhotoCard(ctx, toStage(view, current.venue.point), current.venue, current.photos, time)
  else if (closing > 0) drawPhotoCard(ctx, toStage(view, previous.venue.point), previous.venue, previous.photos, slide.fromTime + time, ease(closing))
}

// Van Wijk and Nuij's smooth zoom and pan (the path d3.interpolateZoom takes): it pulls back as far as
// the distance calls for, so a hop between venues rises over the city and dives in again. A RHO of 2
// (d3 uses 1.4) pulls back to twice the hop distance, keeping both venues in view at the top.
const RHO = 2
function fly(from, to, progress) {
  const k = ease(progress)
  const [w0, w1] = [W * from.mpp, W * to.mpp]
  const [dx, dy] = [to.x - from.x, to.y - from.y]
  const distance = Math.hypot(dx, dy)
  if (distance < 1e-6) return { x: from.x + dx * k, y: from.y + dy * k, mpp: from.mpp * (to.mpp / from.mpp) ** k }
  const b0 = (w1 * w1 - w0 * w0 + RHO ** 4 * distance ** 2) / (2 * w0 * RHO ** 2 * distance)
  const b1 = (w1 * w1 - w0 * w0 - RHO ** 4 * distance ** 2) / (2 * w1 * RHO ** 2 * distance)
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0)
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1)
  const r = r0 + k * (r1 - r0)
  const u = w0 / (RHO ** 2 * distance) * (Math.cosh(r0) * Math.tanh(r) - Math.sinh(r0))
  return { x: from.x + u * dx, y: from.y + u * dy, mpp: from.mpp * Math.cosh(r0) / Math.cosh(r) }
}

function drawVisited(ctx, view, venues) {
  for (const { id, point, color } of venues) {
    const [x, y] = toStage(view, point)
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue
    marker(ctx, x, y, color)
    text(ctx, id, x + 12, y - 9, 16, color)
  }
}

function marker(ctx, x, y, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.PI / 4)
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  box(ctx, -5, -5, 10, 10, color)
  ctx.restore()
}

// The finale: once the camera has pulled back, a route traces the venues in event order. Each venue
// pulses as the route reaches it and its host's name types out; then the route keeps marching.
const ROUTE_START = 0.3
const ROUTE_TIME = 4
// Each leg bows into an arc, like a flight path, so crossing legs read as separate trips.
const ROUTE_BOW = 0.18
const ROUTE_STEPS = 24
function drawFinale(ctx, view, arrived) {
  const points = VENUES.map(venue => toStage(view, venue.point))
  const reached = drawRoute(ctx, points, clamp((arrived - ROUTE_START) / ROUTE_TIME), arrived)
  VENUES.forEach((venue, i) => {
    const [x, y] = points[i]
    // Seconds since the route reached this venue.
    const since = arrived - ROUTE_START - reached[i] * ROUTE_TIME
    if (since > 0 && since < 0.9) {
      ctx.strokeStyle = rgba(venue.color, 1 - since / 0.9)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, 8 + since / 0.9 * 50, 0, Math.PI * 2)
      ctx.stroke()
    }
    marker(ctx, x, y, venue.color)
    drawTag(ctx, x, y, venue, venue.host.slice(0, Math.max(0, Math.floor(since * 30))), venue.side)
  })
}

// Draws the route through points in event order, progress (0 to 1) of the way along, and returns how far
// along the route each point sits. Once it's complete, the route marches as a dashed line, timed by clock.
function drawRoute(ctx, points, progress, clock, bow = ROUTE_BOW) {
  // Sample the route: along[j] is the distance to path[j], and reach[i] the distance at venue i.
  const path = [points[0]]
  const along = [0]
  const reach = [0]
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const [[ax, ay], [bx, by]] = [points[i - 1], points[i]]
    const [cx, cy] = [(ax + bx) / 2 + (ay - by) * bow, (ay + by) / 2 + (bx - ax) * bow]
    for (let step = 1; step <= ROUTE_STEPS; step++) {
      const k = step / ROUTE_STEPS
      const next = [(1 - k) ** 2 * ax + 2 * (1 - k) * k * cx + k * k * bx, (1 - k) ** 2 * ay + 2 * (1 - k) * k * cy + k * k * by]
      const [px, py] = path.at(-1)
      total += Math.hypot(next[0] - px, next[1] - py)
      path.push(next)
      along.push(total)
    }
    reach.push(total)
  }
  const drawn = progress * total
  if (progress > 0) {
    ctx.save()
    routeStyle(ctx, progress >= 1 ? clock : null)
    ctx.beginPath()
    ctx.moveTo(...path[0])
    let head = path[0]
    for (let i = 1; i < path.length; i++) {
      const point = path[i]
      if (along[i] <= drawn) {
        ctx.lineTo(...point)
        head = point
        continue
      }
      const before = path[i - 1]
      const k = (drawn - along[i - 1]) / (along[i] - along[i - 1])
      head = [lerp(before[0], point[0], k), lerp(before[1], point[1], k)]
      ctx.lineTo(...head)
      break
    }
    ctx.stroke()
    ctx.restore()
    if (progress < 1) {
      ctx.save()
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 14
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(head[0], head[1], 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  return reach.map(distance => distance / total)
}

// Solid while the route is being drawn; given a clock, the marching dashes of a finished route.
function routeStyle(ctx, clock) {
  ctx.strokeStyle = FUCHSIA
  ctx.lineWidth = 2
  ctx.shadowColor = FUCHSIA
  ctx.shadowBlur = 8
  if (clock !== null) {
    ctx.setLineDash([10, 8])
    ctx.lineDashOffset = -clock * 24
  }
}

// A venue's id and name on a dark plate, so the route never hides them. side puts the plate right (1), left
// (-1) or centred (0) on the marker; lift raises it above the marker, on a short leader. The id always sits
// nearest the marker. Unifont is 9 px a character at 18 px.
function drawTag(ctx, x, y, { id, color }, named, side, lift = 0) {
  const top = y + lift
  const width = (id.length + (named ? named.length + 1 : 0)) * 9 + 12
  const left = side > 0 ? x + 8 : side < 0 ? x - 8 - width : x - width / 2
  if (lift) line(ctx, x, y - 6, x + 12 * side, top + 13, color)
  box(ctx, left, top - 13, width, 26, '#050a0dcc')
  let cursor = left + 6
  for (const [value, fill] of side < 0 ? [[named, '#e0efec'], [id, color]] : [[id, color], [named, '#e0efec']]) {
    if (!value) continue
    text(ctx, value, cursor, top - 10, 18, fill)
    cursor += (value.length + 1) * 9
  }
}

// ---- Constellation -------------------------------------------------------------------------------

// The finished route, with the map fading out from under it.
const ROUTE_DONE = ROUTE_START + ROUTE_TIME
const MAP_FADE = 1.5
const finalePoints = () => VENUES.map(venue => toStage(FINALE_VIEW, venue.point))

function route(ctx, t) {
  if (t < MAP_FADE) {
    drawMap(ctx, FINALE_VIEW)
    box(ctx, 0, 0, W, H, `rgba(0, 0, 0, ${ease(t / MAP_FADE)})`)
  }
  drawConstellation(ctx, finalePoints(), ROUTE_DONE + t, ROUTE_BOW, VENUES.map(venue => [venue.side, 0]), 1)
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === route), 1)
}

// The pentagram, inverted, one point down, inside a circle. Its five points are taken in star order, every
// other point, by 0x2 to 0x6, starting from the lower right-hand point, which keeps each dot near where the
// map put it (and Brooklyn at the bottom). The route's last leg runs along the line from 0x6 back to 0x2,
// so 0x7 and 0x1 sit where that line crosses the others; the stretch between them is the one the route
// doesn't cover, and it closes last.
const STAR_CENTER = [720, 470]
const STAR_RADIUS = 320
const PHI = (1 + Math.sqrt(5)) / 2
// Point k of the star, counted clockwise from the bottom in fifths of a turn.
const starPoint = k => [STAR_CENTER[0] - STAR_RADIUS * Math.sin(k * Math.PI * 2 / 5), STAR_CENTER[1] + STAR_RADIUS * Math.cos(k * Math.PI * 2 / 5)]
const STAR_ORDER = [4, 6, 8, 10, 12]
const STAR = (() => {
  const points = STAR_ORDER.map(starPoint)
  // The crossings divide each line of a pentagram in the golden ratio.
  const crossing = PHI / (2 * PHI + 1)
  const between = k => [lerp(points[4][0], points[0][0], k), lerp(points[4][1], points[0][1], k)]
  return [between(1 - crossing), ...points, between(crossing)]
})()
// Tags go outside the star: [side, lift] for 0x1 to 0x7. 0x1 sits up in the gap between two arms, and
// 0x7 centred in the notch between the two top arms.
const STAR_TAGS = [[1, -36], [1, 0], [-1, 0], [1, 0], [1, 0], [-1, 0], [0, -88]]
const GATHER = 2.5
const CLOSE_AT = GATHER + 0.2
const CLOSE = 0.6
// Then the circle sweeps round from the bottom point.
const CIRCLE_AT = CLOSE_AT + CLOSE
const CIRCLE = 1.2
const FLARE_AT = CIRCLE_AT + CIRCLE

function pentagram(ctx, t) {
  drawPentagram(ctx, t)
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === pentagram), 1)
}

function drawPentagram(ctx, t) {
  // The dots glide from their places on the map to the star, the arcs straightening as they go. The tags
  // step aside while the dots move and return at their new places.
  const k = ease(t / GATHER)
  const from = finalePoints()
  const points = from.map(([x, y], i) => [lerp(x, STAR[i][0], k), lerp(y, STAR[i][1], k)])
  const tags = t < GATHER / 2 ? 1 - clamp(t / 0.4) : clamp((t - GATHER) / 0.4)
  // The circle sweeps round from the bottom point once the star has closed, under the dots and tags.
  const circle = ease((t - CIRCLE_AT) / CIRCLE)
  if (circle > 0) {
    ctx.save()
    ctx.strokeStyle = FUCHSIA
    ctx.lineWidth = 2
    ctx.shadowColor = FUCHSIA
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(...STAR_CENTER, STAR_RADIUS, Math.PI / 2, Math.PI / 2 + circle * Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  drawConstellation(ctx, points, ROUTE_DONE + t, ROUTE_BOW * (1 - k), t < GATHER / 2 ? VENUES.map(venue => [venue.side, 0]) : STAR_TAGS, tags)
  // The stretch of the last line the route skipped draws in, from 0x7 to 0x1, and closes the star.
  const close = ease((t - CLOSE_AT) / CLOSE)
  if (close > 0) {
    const [[ax, ay], [bx, by]] = [STAR[6], STAR[0]]
    ctx.save()
    routeStyle(ctx, close >= 1 ? ROUTE_DONE + t : null)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(lerp(ax, bx, close), lerp(ay, by, close))
    ctx.stroke()
    ctx.restore()
  }
  // Once the circle closes, star and circle flare together and fade back to the marching route.
  const flare = clamp(1 - (t - FLARE_AT) / 1.2)
  if (t > FLARE_AT && flare > 0) {
    ctx.save()
    ctx.globalAlpha = flare
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.shadowColor = FUCHSIA
    ctx.shadowBlur = 30
    ctx.beginPath()
    ;[...STAR_ORDER, STAR_ORDER[0]].map(starPoint).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.moveTo(STAR_CENTER[0] + STAR_RADIUS, STAR_CENTER[1])
    ctx.arc(...STAR_CENTER, STAR_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// The coin: the pentagram, settled, fades away but for its circle, which is drawn at the size of the coin's
// inner fuchsia ring. Then the coin grows out from that ring and the live show's coin animation runs:
// Liberty decodes onto its face, then glitches every few seconds.
const PENTAGRAM_SETTLED = FLARE_AT + 2
const COIN_SCALE = STAR_RADIUS / (FACE_R + 3)
const COIN_AT = 0.9
const COIN_GROW = 0.8

function coin(ctx, t) {
  const fade = 1 - ease(t / 1)
  if (fade > 0) {
    ctx.save()
    ctx.globalAlpha = fade
    drawPentagram(ctx, PENTAGRAM_SETTLED + t)
    ctx.restore()
  }
  const coinTime = t - COIN_AT
  if (coinTime < COIN_GROW) {
    // The ring holds while the star goes.
    ctx.save()
    ctx.strokeStyle = FUCHSIA
    ctx.lineWidth = 2
    ctx.shadowColor = FUCHSIA
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(...STAR_CENTER, STAR_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  if (coinTime > 0) {
    // The coin is uncovered from its ring outwards, rim, inscriptions and all.
    ctx.save()
    ctx.beginPath()
    ctx.arc(...STAR_CENTER, lerp(STAR_RADIUS, (COIN_R + 40) * COIN_SCALE, ease(coinTime / COIN_GROW)), 0, Math.PI * 2)
    ctx.clip()
    ctx.translate(...STAR_CENTER)
    ctx.scale(COIN_SCALE, COIN_SCALE)
    ctx.translate(-COIN_X, -COIN_Y)
    drawCoin(ctx, coinTime)
    ctx.restore()
  }
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === coin), 1)
}

// ---- UwU-Underground and 2027 -----------------------------------------------------------------------

// ANSI Shadow lettering, the font of the live show's SPRAWL banner. It has no lowercase, so the w of UwU
// and the con of SPRAWLcon are hand-drawn to match, using only the lower four rows.
const UWU_ART = [
  '██╗   ██╗          ██╗   ██╗      ██╗   ██╗███╗   ██╗██████╗ ███████╗██████╗  ██████╗ ██████╗  ██████╗ ██╗   ██╗███╗   ██╗██████╗ ',
  '██║   ██║          ██║   ██║      ██║   ██║████╗  ██║██╔══██╗██╔════╝██╔══██╗██╔════╝ ██╔══██╗██╔═══██╗██║   ██║████╗  ██║██╔══██╗',
  '██║   ██║██╗    ██╗██║   ██║█████╗██║   ██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝██║  ███╗██████╔╝██║   ██║██║   ██║██╔██╗ ██║██║  ██║',
  '██║   ██║██║ █╗ ██║██║   ██║╚════╝██║   ██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗██║   ██║██╔══██╗██║   ██║██║   ██║██║╚██╗██║██║  ██║',
  '╚██████╔╝╚███╔███╔╝╚██████╔╝      ╚██████╔╝██║ ╚████║██████╔╝███████╗██║  ██║╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝██║ ╚████║██████╔╝',
  ' ╚═════╝  ╚══╝╚══╝  ╚═════╝        ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ',
]
const YEAR_ART = [
  '██████╗  ██████╗ ██████╗ ███████╗',
  '╚════██╗██╔═████╗╚════██╗╚════██║',
  ' █████╔╝██║██╔██║ █████╔╝    ██╔╝',
  '██╔═══╝ ████╔╝██║██╔═══╝    ██╔╝ ',
  '███████╗╚██████╔╝███████╗   ██║  ',
  '╚══════╝ ╚═════╝ ╚══════╝   ╚═╝  ',
]
const SPRAWLCON_ART = [
  '███████╗██████╗ ██████╗  █████╗ ██╗    ██╗██╗                               ',
  '██╔════╝██╔══██╗██╔══██╗██╔══██╗██║    ██║██║                               ',
  '███████╗██████╔╝██████╔╝███████║██║ █╗ ██║██║      ██████╗ ██████╗ ███████╗ ',
  '╚════██║██╔═══╝ ██╔══██╗██╔══██║██║███╗██║██║     ██╔════╝██╔═══██╗██╔═══██╗',
  '███████║██║     ██║  ██║██║  ██║╚███╔███╔╝███████╗╚██████╗╚██████╔╝██║   ██║',
  '╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝   ╚═╝',
]
const columns = art => [...art[0]].length

// Paints lettering with its solid blocks in a vertical gradient, glowing, and its shadow strokes dim.
// Unifont's block and box-drawing glyphs are all half-width, so each row is one run of text.
function paintArt(ctx, art, x, y, size, top, bottom) {
  ctx.font = `${size}px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  art.forEach((row, r) => {
    const color = mix(top, bottom, r / (art.length - 1))
    ctx.save()
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = size * 0.4
    ctx.fillText(row.replace(/[^█]/g, ' '), x, y + r * size)
    ctx.restore()
    ctx.fillStyle = bottom === top ? top : '#3f5560'
    ctx.fillText(row.replace(/█/g, ' '), x, y + r * size)
  })
}

// Lettering is painted once per screen scale into an offscreen bitmap, padded for its glow; the glitches
// then cut and shift that bitmap rather than redrawing hundreds of glyphs. Until the font has loaded,
// there's no bitmap and the art is painted directly.
const artLayers = new Map()
function artLayer(ctx, art, size, top, bottom) {
  if (!document.fonts.check(`16px ${FONT}`)) return null
  const scale = ctx.getTransform().a
  const id = `${art[0]}|${size}|${top}|${bottom}@${scale}`
  if (!artLayers.has(id)) {
    const pad = size
    const [width, height] = [columns(art) * size / 2 + pad * 2, art.length * size + pad * 2]
    const canvas = new OffscreenCanvas(Math.ceil(width * scale), Math.ceil(height * scale))
    const context = canvas.getContext('2d')
    context.scale(scale, scale)
    paintArt(context, art, pad, pad, size, top, bottom)
    artLayers.set(id, { canvas, scale, pad, width, height })
  }
  return artLayers.get(id)
}

// Draws lettering with its top-left corner at (x, y), glitched by strength (0 calm, 1 wild): colour-split
// ghosts, torn horizontal slices and a few corrupted glyphs. seed varies the damage from frame to frame.
function drawArt(ctx, art, x, y, size, top, bottom, strength = 0, seed = 0) {
  const layer = artLayer(ctx, art, size, top, bottom)
  if (!layer) {
    paintArt(ctx, art, x, y, size, top, bottom)
    return
  }
  const { canvas, scale, pad, width, height } = layer
  const at = (image, dx) => ctx.drawImage(image, x - pad + dx, y - pad, width, height)
  if (strength > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= 0.6 * Math.min(1, strength * 2)
    at(artLayer(ctx, art, size, '#00e5ff', '#00e5ff')?.canvas ?? canvas, -(4 + 22 * strength) * noise(seed + 1))
    at(artLayer(ctx, art, size, '#ff2b6e', '#ff2b6e')?.canvas ?? canvas, (4 + 22 * strength) * noise(seed + 2))
    ctx.restore()
  }
  at(canvas, 0)
  if (strength <= 0) return
  const [tall, wide] = [art.length * size, columns(art) * size / 2]
  // Torn slices: a band of the art jumps sideways.
  for (let i = 0; i < 1 + Math.floor(strength * 4); i++) {
    const bandY = noise(seed * 3 + i) * tall
    const bandH = size * (0.2 + noise(seed * 5 + i) * 0.9)
    const shift = (noise(seed * 7 + i) - 0.5) * 120 * strength
    box(ctx, x - 4, y + bandY, wide + 8, bandH, '#000')
    ctx.drawImage(canvas, 0, (pad + bandY) * scale, canvas.width, bandH * scale, x - pad + shift, y + bandY, width, bandH)
  }
  // Corrupted glyphs.
  for (let i = 0; i < Math.floor(strength * 10); i++) {
    const col = Math.floor(noise(seed * 11 + i) * columns(art))
    const row = Math.floor(noise(seed * 13 + i) * art.length)
    if (art[row][col] === ' ') continue
    box(ctx, x + col * size / 2, y + row * size, size / 2, size, '#000')
    text(ctx, scramble(seed + i), x + col * size / 2, y + row * size, size, i % 2 ? FUCHSIA : CYAN)
  }
}

// Glitch strength over time: a burst every `every` seconds (offset by `phase`), quiet in between.
const burst = (t, every, phase = 0) => {
  const at = (t + phase) % every
  return at < 0.35 ? 0.8 * (1 - at / 0.35) : 0
}

// UwU-Underground: the title decodes in left to right, then the two portraits decode below it.
const UWU_SIZE = 20
const UWU_TOP = 108
const UWU_PHOTOS = ['uwu-1', 'uwu-2']
const UWU_PHOTO_TOP = 278
const UWU_PHOTO_HEIGHT = 500

function underground(ctx, t) {
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === underground), ease(t / 0.5))
  const wide = columns(UWU_ART) * UWU_SIZE / 2
  const left = (W - wide) / 2
  const decoded = ease(t / 1.3) * wide
  if (decoded > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(left - UWU_SIZE, UWU_TOP - UWU_SIZE, decoded + UWU_SIZE, UWU_ART.length * UWU_SIZE + UWU_SIZE * 2)
    ctx.clip()
    const frame = Math.floor(t * 20)
    drawArt(ctx, UWU_ART, left, UWU_TOP, UWU_SIZE, '#ffb3e6', FUCHSIA, t > 1.3 ? burst(t, 3.6, 1) : 0, frame)
    ctx.restore()
    // A scrambling edge leads the decode.
    if (decoded < wide) {
      for (let r = 0; r < UWU_ART.length; r++) {
        text(ctx, scramble(r * 7 + Math.floor(t * 30)), left + decoded, UWU_TOP + r * UWU_SIZE, UWU_SIZE, '#ffffff')
      }
    }
  }
  const photos = UWU_PHOTOS.map(name => NAMED_PHOTOS[name]).filter(Boolean)
  const scale = Math.min(1, (W - 160 - 24 * (photos.length - 1)) / photos.reduce((sum, { aspect }) => sum + aspect * UWU_PHOTO_HEIGHT, 0))
  const height = UWU_PHOTO_HEIGHT * scale
  let x = (W - photos.reduce((sum, { aspect }) => sum + aspect * height, 0) - 24 * (photos.length - 1)) / 2
  photos.forEach((photo, i) => {
    const w = photo.aspect * height
    drawPhoto(ctx, photo, x, UWU_PHOTO_TOP, w, height, ease((t - 1.2 - i * 0.25) / 0.6), FUCHSIA, t)
    x += w + 24
  })
}

// 2027: huge, glitching in out of noise, then glitching in bursts. On the next slide it rises to make room
// and SPRAWLcon strobes in beneath it.
const YEAR_SIZE = 66
const YEAR_TOP = (H - YEAR_ART.length * YEAR_SIZE) / 2
const YEAR_RAISED = 150
const CON_SIZE = 24
const CON_TOP = 620

function drawYear(ctx, t, top) {
  const settle = 1 - ease(t / 1.4)
  ctx.save()
  // It flickers in over the first moments.
  ctx.globalAlpha = t < 0.6 ? (noise(Math.floor(t * 30)) > 0.35 ? 1 : 0.2) * clamp(t / 0.3) : 1
  drawArt(ctx, YEAR_ART, (W - columns(YEAR_ART) * YEAR_SIZE / 2) / 2, top, YEAR_SIZE, CYAN, FUCHSIA,
    Math.max(settle, burst(t, 2.6, 0.8), 0.04), Math.floor(t * 24))
  ctx.restore()
}

function year(ctx, t) {
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === year), ease(t / 0.5))
  drawYear(ctx, t, YEAR_TOP)
}

const YEAR_HELD = 10
function sprawlcon(ctx, t) {
  drawChrome(ctx, SLIDES.findIndex(slide => slide.draw === sprawlcon), 1)
  drawYear(ctx, YEAR_HELD + t, lerp(YEAR_TOP, YEAR_RAISED, ease(t / 0.45)))
  // SPRAWLcon strobes in under a single flash of light, then holds, glitching now and then.
  const shown = t < 0.7 ? Math.floor(t * 7) % 2 === 0 : true
  if (shown) {
    drawArt(ctx, SPRAWLCON_ART, (W - columns(SPRAWLCON_ART) * CON_SIZE / 2) / 2, CON_TOP, CON_SIZE, GREEN, CYAN,
      Math.max(1 - ease(t / 0.9), burst(t, 3.1, 1.7)), Math.floor(t * 24) + 500)
  }
  if (t < 0.3) box(ctx, 0, 0, W, H, `rgba(255, 255, 255, ${0.35 * (1 - t / 0.3)})`)
}

// The route, its dots and their tags, with no map under them. tags holds [side, lift] for each venue.
function drawConstellation(ctx, points, clock, bow, tags, tagAlpha) {
  drawRoute(ctx, points, 1, clock, bow)
  VENUES.forEach((venue, i) => {
    const [x, y] = points[i]
    marker(ctx, x, y, venue.color)
    if (tagAlpha <= 0) return
    ctx.save()
    ctx.globalAlpha = tagAlpha
    drawTag(ctx, x, y, venue, venue.host, ...tags[i])
    ctx.restore()
  })
}

// ---- Photo cards ---------------------------------------------------------------------------------

// Decoded photos, ready to draw, keyed by src. A photo still loading draws as a placeholder.
const bitmaps = new Map()
function loadPhoto({ src }) {
  if (bitmaps.has(src)) return
  bitmaps.set(src, null)
  const image = new Image()
  image.src = src
  image.decode().then(() => createImageBitmap(image)).then(bitmap => bitmaps.set(src, bitmap)).catch(() => bitmaps.delete(src))
}

// A photo decoding top to bottom behind a bright scan line, reveal (0 to 1) of the way. Returns reveal.
function drawPhoto(ctx, photo, x, y, w, h, reveal, color, t) {
  if (reveal <= 0) return reveal
  const bitmap = bitmaps.get(photo.src)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h * reveal)
  ctx.clip()
  if (bitmap) ctx.drawImage(bitmap, x, y, w, h)
  else {
    box(ctx, x, y, w, h, '#0a161b')
    text(ctx, `DECRYPTING ${scramble(Math.floor(t * 20) + x)}`, x + w / 2, y + h / 2 - 8, 14, MUTED, 'center')
  }
  ctx.restore()
  ctx.strokeStyle = '#ffffff1f'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h * reveal - 1)
  if (reveal < 1) {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    box(ctx, x, y + h * reveal - 2, w, 2, color)
    ctx.restore()
  }
  return reveal
}

// The card fits inside this box, sized to its photos, and centred on it.
const CARD = { x: 100, y: 112, w: 1240, h: 690 }
const CARD_CLOSE = 0.35
const CARD_HEADER = 50
const CARD_PAD = 16
const PHOTO_GAP = 10
const layouts = new WeakMap()

// Lays photos out in order, at their own aspect ratios, as rows that each span the width or columns that
// each span the height. Every way of splitting them into rows or columns is tried (2^(n-1) splits, so up
// to a few thousand for a dozen photos). The winner covers the most of the box, discounted by how uneven
// the photos' sizes are: without that, eleven photos come out as one huge one and ten thumbnails.
const EVENNESS = 0.25
function arrange(photos, width, height) {
  let best = null
  for (let mask = 0; mask < 1 << (photos.length - 1); mask++) {
    // Bit i set: a new row or column starts after photo i.
    const groups = [[photos[0]]]
    photos.slice(1).forEach((photo, i) => mask & 1 << i ? groups.push([photo]) : groups.at(-1).push(photo))
    for (const columns of [false, true]) {
      const span = columns ? height : width
      // Each group's thickness (a row's height, a column's width) when it fills the span.
      const thickness = groups.map(group => (span - PHOTO_GAP * (group.length - 1)) / group.reduce((sum, { aspect }) => sum + (columns ? 1 / aspect : aspect), 0))
      const depth = thickness.reduce((sum, value) => sum + value, 0) + PHOTO_GAP * (groups.length - 1)
      const scale = Math.min(1, (columns ? width : height) / depth)
      const rects = []
      let across = 0
      groups.forEach((group, g) => {
        let along = 0
        for (const photo of group) {
          const size = thickness[g] * (columns ? 1 / photo.aspect : photo.aspect)
          rects.push(columns
            ? { photo, x: across, y: along, w: thickness[g] * scale, h: size * scale }
            : { photo, x: along, y: across, w: size * scale, h: thickness[g] * scale })
          along += (size + PHOTO_GAP) * scale
        }
        across += (thickness[g] + PHOTO_GAP) * scale
      })
      const areas = rects.map(({ w, h }) => w * h)
      const score = areas.reduce((sum, area) => sum + area, 0) * (Math.min(...areas) / Math.max(...areas)) ** EVENNESS
      if (!best || score > best.score) best = { score, rects, w: columns ? depth * scale : span * scale, h: columns ? span * scale : depth * scale }
    }
  }
  return best
}

// The card expands out of the venue's pin, its header types in, and the photos decode one after another.
// Passing open overrides how far the card has opened, to fold it away again.
function drawPhotoCard(ctx, [pinX, pinY], venue, photos, t, open = 1 - (1 - clamp(t / 0.55)) ** 3) {
  if (!layouts.has(photos)) layouts.set(photos, arrange(photos, CARD.w - CARD_PAD * 2, CARD.h - CARD_HEADER - CARD_PAD))
  const layout = layouts.get(photos)
  const { color } = venue
  const width = layout.w + CARD_PAD * 2
  const height = layout.h + CARD_HEADER + CARD_PAD
  const [left, top] = [CARD.x + (CARD.w - width) / 2, CARD.y + (CARD.h - height) / 2]
  const frame = {
    x: lerp(pinX, left, open),
    y: lerp(pinY, top, open),
    w: width * open,
    h: height * open,
  }
  box(ctx, frame.x, frame.y, frame.w, frame.h, '#050a0df2')
  ctx.strokeStyle = rgba(color, 0.7)
  ctx.lineWidth = 1.5
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h)
  // Heavier brackets on the corners, shrinking with the card.
  const arm = Math.min(22, frame.w / 3, frame.h / 3)
  for (const [x, y, dx, dy] of [[frame.x, frame.y, 1, 1], [frame.x + frame.w, frame.y, -1, 1], [frame.x, frame.y + frame.h, 1, -1], [frame.x + frame.w, frame.y + frame.h, -1, -1]]) {
    line(ctx, x, y, x + arm * dx, y, color, 3)
    line(ctx, x, y, x, y + arm * dy, color, 3)
  }
  if (open < 1) return

  const typed = Math.floor((t - 0.5) * 40)
  if (typed > 0) {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    text(ctx, venue.label.slice(0, typed), left + CARD_PAD, top + 13, 26, color)
    ctx.restore()
    const detail = `${venue.detail}  /  ${photos.length} PHOTOS`
    text(ctx, detail.slice(0, typed), left + width - CARD_PAD, top + 19, 16, '#c3d9d5', 'right')
  }
  line(ctx, left + CARD_PAD, top + CARD_HEADER - 6, left + CARD_PAD + (width - CARD_PAD * 2) * ease((t - 0.5) / 0.5), top + CARD_HEADER - 6, rgba(color, 0.4))

  layout.rects.forEach(({ photo, x, y, w, h }, i) => {
    const [px, py] = [left + CARD_PAD + x, top + CARD_HEADER + y]
    const reveal = ease((t - 0.6 - i * 0.1) / 0.45)
    if (drawPhoto(ctx, photo, px, py, w, h, reveal, color, t) < 1) return
    // Who's speaking, trimmed to fit the photo. Unifont is 8 px a character at 16 px.
    const fits = Math.floor((w - 32) / 8)
    const name = photo.speaker.length > fits ? `${photo.speaker.slice(0, fits - 1)}…` : photo.speaker
    box(ctx, px + 6, py + h - 28, name.length * 8 + 17, 22, '#050a0dd9')
    box(ctx, px + 6, py + h - 28, 3, 22, color)
    text(ctx, name, px + 15, py + h - 25, 16, '#e0efec')
  })
  // Now and then a faint scan band drifts down the card.
  const sweep = ((t - 2) % 6) / 1.5
  if (t > 2 && sweep < 1) {
    const y = top + sweep * height
    const band = ctx.createLinearGradient(0, y - 60, 0, y)
    band.addColorStop(0, rgba(color, 0))
    band.addColorStop(1, rgba(color, 0.08))
    box(ctx, left, Math.max(top, y - 60), width, Math.min(60, y - top), band)
  }
}

// t: seconds on the slide, which drives the target lock that rides along with the zoom.
// arrived: seconds since the camera landed (negative while it's still flying), which drives the full reveal.
function drawVenue(ctx, view, venue, t, arrived) {
  const [x, y] = toStage(view, venue.point)
  const { color } = venue
  // Badged venues flash their pin once the target has locked.
  const flash = venue.badge && t > 0.9 && Math.floor(t * 3) % 2 ? 0.3 : 1
  const appear = ease(t / 0.6)
  const landed = ease(arrived / 0.6)
  // Light up the building itself.
  const outline = footprint(venue.point)
  if (outline && landed > 0) {
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(1 / view.mpp, 1 / view.mpp)
    ctx.translate(-view.x, -view.y)
    ctx.globalAlpha = landed
    ctx.fillStyle = rgba(color, 0.2)
    ctx.fill(outline)
    ctx.strokeStyle = color
    ctx.lineWidth = 2 * view.mpp
    ctx.stroke(outline)
    ctx.restore()
  }
  // Tracking hairlines shoot out from the target while the camera closes in, and clear on landing.
  const hairline = 0.35 * (1 - clamp(arrived / 0.6))
  if (hairline > 0) {
    const reach = ease(t / 0.6) * 1600
    ctx.strokeStyle = rgba(color, hairline)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(x + dx * 40, y + dy * 40)
      ctx.lineTo(x + dx * Math.max(40, reach), y + dy * Math.max(40, reach))
    }
    ctx.stroke()
  }
  // Sonar pulses.
  for (let k = 0; k < 3; k++) {
    const phase = (t * 0.55 + k / 3) % 1
    ctx.strokeStyle = rgba(color, 0.6 * (1 - phase) * appear)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 12 + phase * 90, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Target brackets spin down onto the pin and lock, jittering until they do.
  const lock = ease(t / 0.9)
  const radius = lerp(120, 26, lock)
  const jitter = lock < 1 ? (noise(t * 37) - 0.5) * 6 : 0
  ctx.save()
  ctx.translate(x + jitter, y - jitter)
  ctx.rotate((1 - lock) * Math.PI / 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.globalAlpha = appear * flash
  for (let corner = 0; corner < 4; corner++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(radius, radius - 10)
    ctx.lineTo(radius, radius)
    ctx.lineTo(radius - 10, radius)
    ctx.stroke()
  }
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = flash
  ctx.shadowColor = color
  ctx.shadowBlur = 16
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 5 * appear, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // In flight: a compact tag with the event number and date. It hands over to the full label on landing.
  const tag = 1 - clamp(arrived / 0.4)
  const tagged = Math.floor((t - 0.3) * 30)
  if (tag > 0 && tagged > 0) {
    const [tagX, tagY] = [x + 44, y - 23]
    const width = venue.tag.length * 10 + 24
    ctx.save()
    ctx.globalAlpha = tag
    line(ctx, x + 26, y - 10, tagX, y - 10, color)
    box(ctx, tagX, tagY, width, 50, '#050a0dd9', color)
    text(ctx, venue.tag.slice(0, tagged), tagX + 12, tagY + 6, 20, color)
    const locked = t >= 0.9
    if (locked || Math.floor(t * 6) % 2) text(ctx, locked ? 'TARGET LOCKED' : 'ACQUIRING', tagX + 12, tagY + 31, 12, locked ? GREEN : MUTED)
    ctx.restore()
  }

  // Landed: leader line, then the full label types out.
  const leader = ease((arrived - 0.5) / 0.4)
  if (leader <= 0) return
  const [elbowX, elbowY] = [x + 60, y - 90]
  const labelX = elbowX + 24
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 20, y - 30)
  const first = clamp(leader * 2)
  ctx.lineTo(lerp(x + 20, elbowX, first), lerp(y - 30, elbowY, first))
  if (leader > 0.5) ctx.lineTo(lerp(elbowX, labelX + venue.label.length * 20, (leader - 0.5) * 2), elbowY)
  ctx.stroke()
  const typed = Math.floor((arrived - 0.9) * 26)
  if (typed > 0) {
    let value = venue.label.slice(0, typed)
    if (typed < venue.label.length) value += scramble(Math.floor(t * 40))
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 20
    text(ctx, value, labelX, elbowY - 52, 40, color)
    ctx.restore()
  }
  const detail = clamp((arrived - 2) / 0.5)
  if (detail > 0) {
    ctx.globalAlpha = detail
    text(ctx, venue.detail, labelX, elbowY + 12, 18, '#c3d9d5')
    ctx.globalAlpha = 1
  }
  // The badge flashes under the details.
  const badge = venue.badge && clamp((arrived - 2.4) / 0.3)
  if (badge > 0 && Math.floor(arrived * 3) % 2 === 0) {
    const width = venue.badge.length * 16 + 40
    ctx.save()
    ctx.globalAlpha = badge
    ctx.shadowColor = color
    ctx.shadowBlur = 24
    box(ctx, labelX, elbowY + 52, width, 56, rgba(color, 0.12), color)
    text(ctx, venue.badge, labelX + 20, elbowY + 64, 32, color)
    ctx.restore()
  }
}

// Corner brackets, the masthead and the slide counter, shared by every slide after the title.
function drawChrome(ctx, index, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  for (const [x, y, dx, dy] of [[32, 32, 1, 1], [W - 32, 32, -1, 1], [32, H - 32, 1, -1], [W - 32, H - 32, -1, -1]]) {
    line(ctx, x, y, x + 28 * dx, y, '#3b8d93', 2)
    line(ctx, x, y, x, y + 28 * dy, '#3b8d93', 2)
  }
  text(ctx, 'S P R A W L', 64, 52, 24, GREEN)
  text(ctx, '1-YEAR RECAP', 278, 56, 16, MUTED)
  text(ctx, `${String(index + 1).padStart(2, '0')} / ${String(SLIDES.length).padStart(2, '0')}   ${SLIDES[index].name}`, 64, H - 70, 16, MUTED)
  ctx.restore()
}

function drawHud(ctx, view, index, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  // Vignette keeps the edges of the data out of sight and the HUD readable.
  const vignette = ctx.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 900)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.85)')
  box(ctx, 0, 0, W, H, vignette)
  ctx.restore()
  drawChrome(ctx, index, alpha)
  ctx.save()
  ctx.globalAlpha = alpha
  const [lat, lon] = unproject(view.x, view.y)
  text(ctx, `${lat.toFixed(4)}° N   ${Math.abs(lon).toFixed(4)}° W`, W - 64, 52, 18, CYAN, 'right')
  text(ctx, `RES ${view.mpp.toFixed(2)} M/PX`, W - 64, 76, 14, MUTED, 'right')
  // Scale bar: the longest round distance that fits in 160 px.
  const metres = [20, 50, 100, 200, 500, 1000, 2000, 5000].filter(m => m / view.mpp <= 160).at(-1)
  const length = metres / view.mpp
  const barX = W - 64 - length
  line(ctx, barX, H - 66, W - 64, H - 66, '#c3d9d5', 2)
  line(ctx, barX, H - 72, barX, H - 60, '#c3d9d5', 2)
  line(ctx, W - 64, H - 72, W - 64, H - 60, '#c3d9d5', 2)
  text(ctx, metres >= 1000 ? `${metres / 1000} KM` : `${metres} M`, barX - 12, H - 74, 14, '#c3d9d5', 'right')
  text(ctx, 'MAP DATA © OPENSTREETMAP CONTRIBUTORS', W - 64, H - 50, 12, '#3f5d61', 'right')
  ctx.restore()
}
