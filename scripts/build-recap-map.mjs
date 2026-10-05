// Builds src/recapMap.json, the offline NYC map behind the /slides recap, from OpenStreetMap data.
//
//   node scripts/build-recap-map.mjs [cache-dir]
//
// Raw Overpass responses are cached in cache-dir (default: .osm-cache) so reruns don't hit the API.
// Map data © OpenStreetMap contributors, ODbL; the map slide credits it on screen.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CACHE = process.argv[2] ?? '.osm-cache'
const OUT = new URL('../src/recapMap.json', import.meta.url)
// south, west, north, east
const BBOX = [40.62, -74.12, 40.90, -73.84]
// Building footprints only around venues: all of NYC's buildings would be megabytes.
// The radius covers a venue slide's street-level view; keep these in step with recapSlides.js.
const VENUES = [
  { id: '0x1', lat: 40.72318, lon: -74.00688 }, // 75 Varick St
  { id: '0x2', lat: 40.75589, lon: -73.98967 }, // 620 8th Ave
  { id: '0x3', lat: 40.71029, lon: -74.01199 }, // 4 World Trade Center
  { id: '0x4', lat: 40.74213, lon: -73.99059 }, // 27 W 23rd St
  { id: '0x5', lat: 40.70051, lon: -73.98822 }, // 117 Adams St, Brooklyn
  { id: '0x6', lat: 40.74311, lon: -74.00784 }, // 85 10th Ave
  { id: '0x7', lat: 40.72466, lon: -73.99586 }, // 300 Lafayette St
].map(venue => ({ radius: 1100, ...venue }))
const ORIGIN = { lat: 40.76, lon: -73.98 }

const ROAD_CLASSES = {
  major: ['motorway', 'motorway_link', 'trunk', 'trunk_link'],
  mid: ['primary', 'primary_link', 'secondary', 'secondary_link'],
  minor: ['tertiary', 'residential', 'unclassified', 'living_street', 'pedestrian'],
}
const bbox = BBOX.join(',')
const QUERIES = {
  coast: `way["natural"="coastline"](${bbox});out geom;`,
  roads: `way["highway"~"^(${Object.values(ROAD_CLASSES).flat().join('|')})$"](${bbox});out geom;`,
  parks: `(way["leisure"="park"](${bbox});relation["leisure"="park"](${bbox}););out geom;`,
  ...Object.fromEntries(VENUES.map(({ id, lat, lon, radius }) => [`buildings-${id}-${radius}`,
    `(way["building"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom;`])),
}

async function overpass(name) {
  const file = join(CACHE, `${name}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).elements
  for (let attempt = 1; ; attempt++) {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': 'sprawl-site recap map builder' },
      body: new URLSearchParams({ data: `[out:json][timeout:300];${QUERIES[name]}` }),
    })
    const body = await response.text()
    if (response.ok && body.startsWith('{')) {
      mkdirSync(CACHE, { recursive: true })
      writeFileSync(file, body)
      return JSON.parse(body).elements
    }
    // Overpass answers "too busy" often; back off and retry.
    if (attempt === 5) throw new Error(`Overpass ${name}: ${response.status} ${body.slice(0, 300)}`)
    console.warn(`Overpass ${name}: ${response.status}, retrying`)
    await new Promise(resolve => setTimeout(resolve, attempt * 10000))
  }
}

// Local equirectangular projection in metres, y pointing south (canvas orientation).
const METRES_PER_DEGREE = 111320
const COS = Math.cos(ORIGIN.lat * Math.PI / 180)
const project = ({ lat, lon }) => [(lon - ORIGIN.lon) * METRES_PER_DEGREE * COS, (ORIGIN.lat - lat) * METRES_PER_DEGREE]

function simplify(points, tolerance) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    const [ax, ay] = points[first]
    const [bx, by] = points[last]
    const length = Math.hypot(bx - ax, by - ay)
    let worst = 0
    let index = 0
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i]
      const distance = length ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length : Math.hypot(px - ax, py - ay)
      if (distance > worst) { worst = distance; index = i }
    }
    if (worst > tolerance) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

// Whole metres, delta-encoded: [x0, y0, dx1, dy1, ...]. Consecutive duplicates are dropped.
function encode(points) {
  const flat = []
  let px = 0
  let py = 0
  for (const [x, y] of points) {
    const [rx, ry] = [Math.round(x), Math.round(y)]
    if (flat.length && rx === px && ry === py) continue
    flat.push(rx - px, ry - py)
    px = rx
    py = ry
  }
  return flat
}

const area = ring => ring.reduce((sum, [x, y], i) => {
  const [nx, ny] = ring[(i + 1) % ring.length]
  return sum + x * ny - nx * y
}, 0) / 2

// Joins ways that share end nodes into longer chains. With `directed`, ways are only joined head to tail
// (coastline direction carries meaning); otherwise they may be reversed to fit.
function joinWays(ways, directed) {
  // Open chains indexed by their first and last node.
  const starts = new Map()
  const ends = new Map()
  const closed = []
  const add = (index, node, chain) => (index.get(node) ?? index.set(node, new Set()).get(node)).add(chain)
  const take = (index, node) => {
    const chain = index.get(node)?.values().next().value
    if (chain) {
      starts.get(chain.nodes[0]).delete(chain)
      ends.get(chain.nodes.at(-1)).delete(chain)
    }
    return chain
  }
  const join = (first, second) => ({ nodes: [...first.nodes, ...second.nodes.slice(1)], points: [...first.points, ...second.points.slice(1)] })
  for (const way of ways) {
    let chain = { nodes: way.nodes, points: way.points }
    for (;;) {
      if (chain.nodes[0] === chain.nodes.at(-1)) break
      let other
      if ((other = take(ends, chain.nodes[0]))) chain = join(other, chain)
      else if ((other = take(starts, chain.nodes.at(-1)))) chain = join(chain, other)
      else if (!directed && (other = take(starts, chain.nodes[0]))) chain = join(reverse(other), chain)
      else if (!directed && (other = take(ends, chain.nodes.at(-1)))) chain = join(chain, reverse(other))
      else break
    }
    if (chain.nodes[0] === chain.nodes.at(-1)) closed.push(chain)
    else {
      add(starts, chain.nodes[0], chain)
      add(ends, chain.nodes.at(-1), chain)
    }
  }
  return [...closed, ...new Set([...starts.values()].flatMap(set => [...set]))]
}
const reverse = chain => ({ nodes: [...chain.nodes].reverse(), points: [...chain.points].reverse() })

// Coastline ways have land on their left. Clip the joined chains to the box, then close each land
// polygon by walking the box edge counterclockwise (in map orientation) from where the coast leaves
// to where it next comes back in.
function landPolygons(ways) {
  const [south, west, north, east] = BBOX
  const [x0, y1] = project({ lat: south, lon: west })
  const [x1, y0] = project({ lat: north, lon: east })
  const inside = ([x, y]) => x > x0 && x < x1 && y > y0 && y < y1
  // Perimeter position, increasing counterclockwise on the map (y points south): along the bottom
  // edge eastward, up the east edge, west along the top, down the west edge.
  const width = x1 - x0
  const height = y1 - y0
  const perimeter = 2 * (width + height)
  const position = ([x, y]) => {
    if (Math.abs(y - y1) < 1e-6) return x - x0
    if (Math.abs(x - x1) < 1e-6) return width + (y1 - y)
    if (Math.abs(y - y0) < 1e-6) return width + height + (x1 - x)
    return 2 * width + height + (y - y0)
  }
  const corners = [[x1, y1], [x1, y0], [x0, y0], [x0, y1]].map(corner => ({ corner, at: position(corner) }))
  // Liang–Barsky: the part of segment a→b inside the box, as parameters [t0, t1], or null.
  function clip([ax, ay], [bx, by]) {
    let t0 = 0
    let t1 = 1
    const dx = bx - ax
    const dy = by - ay
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
      if (p === 0) { if (q < 0) return null; continue }
      const r = q / p
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r }
      else { if (r < t0) return null; if (r < t1) t1 = r }
    }
    return [t0, t1]
  }
  const at = ([ax, ay], [bx, by], t) => [ax + (bx - ax) * t, ay + (by - ay) * t]

  const islands = []
  const pieces = []
  for (const chain of joinWays(ways, true)) {
    let points = chain.points.map(project)
    if (chain.nodes[0] === chain.nodes.at(-1)) {
      const outside = points.findIndex(point => !inside(point))
      if (outside < 0) { islands.push(points); continue }
      // Start a ring that crosses the box edge from outside, so it clips into whole pieces.
      points = [...points.slice(outside, -1), ...points.slice(0, outside + 1)]
    }
    let current = null
    for (let i = 1; i < points.length; i++) {
      const range = clip(points[i - 1], points[i])
      if (!range) continue
      const [t0, t1] = range
      const start = at(points[i - 1], points[i], t0)
      const end = at(points[i - 1], points[i], t1)
      if (t0 > 0 || !current) {
        if (current) pieces.push(current)
        current = [start]
      }
      current.push(end)
      if (t1 < 1) { pieces.push(current); current = null }
    }
    if (current) {
      // A chain that ends inside the box means the extract is incomplete; drop the fragment.
      console.warn(`coastline chain ends inside the box (${chain.nodes.length} nodes), skipped`)
    }
  }
  const open = pieces.filter(piece => !inside(piece[0]) && !inside(piece.at(-1)))
  const polygons = []
  const used = new Set()
  for (const first of open) {
    if (used.has(first)) continue
    const ring = []
    let piece = first
    while (!used.has(piece)) {
      used.add(piece)
      ring.push(...piece)
      const exit = position(piece.at(-1))
      const forward = target => (target - exit + perimeter) % perimeter
      const next = open.reduce((best, candidate) =>
        forward(position(candidate[0])) < forward(position(best[0])) ? candidate : best)
      const entry = forward(position(next[0]))
      for (const { corner, at: cornerAt } of [...corners].sort((a, b) => forward(a.at) - forward(b.at))) {
        if (forward(cornerAt) < entry) ring.push(corner)
      }
      piece = next
    }
    polygons.push(ring)
  }
  return [...polygons, ...islands]
}

function round(points) {
  return points.map(([x, y]) => [Math.round(x), Math.round(y)])
}

const toWay = element => ({ nodes: element.nodes, points: element.geometry })

const coast = await overpass('coast')
const land = landPolygons(coast.map(toWay)).map(ring => encode(simplify(round(ring), 3)))

const roads = Object.fromEntries(Object.keys(ROAD_CLASSES).map(name => [name, []]))
for (const element of await overpass('roads')) {
  // Tunnels would draw roads across the rivers.
  if (element.tags.tunnel && element.tags.tunnel !== 'no') continue
  const name = Object.keys(ROAD_CLASSES).find(key => ROAD_CLASSES[key].includes(element.tags.highway))
  roads[name].push(toWay(element))
}
for (const name of Object.keys(roads)) {
  roads[name] = joinWays(roads[name], false).map(chain => encode(simplify(chain.points.map(project), 2.5))).filter(flat => flat.length >= 4)
}

// Closed outer rings of a way or a multipolygon relation.
const outerRings = element => (element.type === 'way'
  ? [{ nodes: element.nodes, points: element.geometry }]
  : joinWays(element.members.filter(m => m.type === 'way' && m.role === 'outer' && m.geometry)
    .map(m => ({ nodes: m.geometry.map(({ lat, lon }) => `${lat},${lon}`), points: m.geometry })), false))
  .filter(ring => ring.points && ring.nodes[0] === ring.nodes.at(-1))

const parks = []
for (const element of await overpass('parks')) {
  for (const ring of outerRings(element)) {
    const points = ring.points.map(project)
    if (Math.abs(area(points)) < 4000) continue
    parks.push(encode(simplify(points, 3)))
  }
}

const buildings = []
// Venue areas overlap downtown; keep each building once.
const seen = new Set()
for (const venue of VENUES) {
  for (const element of await overpass(`buildings-${venue.id}-${venue.radius}`)) {
    const key = `${element.type}/${element.id}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const ring of outerRings(element)) buildings.push(encode(simplify(ring.points.map(project), 0.8)))
  }
}

const data = { origin: ORIGIN, land, parks, roads, buildings }
writeFileSync(OUT, JSON.stringify(data))
const points = value => Array.isArray(value[0]) ? value.reduce((n, v) => n + v.length / 2, 0) : 0
console.log(`land ${land.length} rings / ${points(land)} pts, parks ${parks.length} / ${points(parks)}, ` +
  Object.entries(roads).map(([k, v]) => `${k} ${v.length} / ${points(v)}`).join(', ') +
  `, buildings ${buildings.length} / ${points(buildings)}; ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`)
