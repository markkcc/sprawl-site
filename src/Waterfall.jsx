import { useEffect, useRef } from 'react'
import { LOGO, WATERFALL } from './eventShowRenderer.js'

// A live spectrum analyzer over a waterfall: band noise, a few drifting carriers, and the SPRAWL
// bitmap transmitted as spectrogram art every so often. New rows enter at the top and scroll down;
// the analyzer traces the newest row, with a dim peak hold over the last PEAK_ROWS.
const CELL = 4 // CSS pixels per frequency bin and per row
const ROWS_PER_SECOND = 10
const PEAK_ROWS = 12
const CARRIERS = [[0.08, 0.6], [0.27, 0.45], [0.86, 0.7], [0.93, 0.4]] // [position, strength]

export default function Waterfall() {
  const canvas = useRef(null)
  const analyzerCanvas = useRef(null)

  useEffect(() => {
    const element = canvas.current
    const context = element.getContext('2d')
    const analyzer = analyzerCanvas.current
    const analyzerContext = analyzer.getContext('2d')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ratio, cell, bins, rows, scale, logoLeft, logoRows, logoEvery
    let sample = 0
    // Levels for the row about to be emitted, and for the rows already on screen, newest first.
    let upcoming = []
    let history = []
    let frame
    let previousTime = null
    let pending = 0
    let onScreen = true

    function level(bin, s) {
      const phase = ((s % logoEvery) + logoEvery) % logoEvery
      if (phase < logoRows) {
        // The bottom row goes out first, so the logo reads upright once it scrolls into view.
        const row = LOGO.length - 1 - Math.floor(phase / scale)
        const col = Math.floor((bin - logoLeft) / scale)
        if (bin >= logoLeft && col < LOGO[0].length && LOGO[row][col] === '1') return 0.9 + Math.random() * 0.1
      }
      let value = 0.08 + Math.random() * 0.2 + 0.08 * (1 - ((bin / bins) * 2 - 1) ** 2)
      for (const [position, strength] of CARRIERS) {
        const center = position * bins + Math.sin(s * 0.05 + position * 9) * 1.5
        const distance = Math.abs(bin - center)
        if (distance < 2) value = Math.max(value, strength * (1 - distance / 2) + Math.random() * 0.15)
      }
      return Math.min(1, value)
    }

    const rowLevels = s => Array.from({ length: bins }, (_, bin) => level(bin, s))

    function emitRow() {
      context.drawImage(element, 0, 0, element.width, element.height - cell, 0, cell, element.width, element.height - cell)
      upcoming.forEach((value, bin) => {
        context.fillStyle = WATERFALL[Math.floor(value * (WATERFALL.length - 1))]
        context.fillRect(bin * cell, 0, cell, cell)
      })
      history = [upcoming, ...history.slice(0, PEAK_ROWS - 1)]
      sample++
      upcoming = rowLevels(sample)
    }

    // The trace eases from the newest row toward the next one, so it moves smoothly between rows.
    function drawAnalyzer(fraction) {
      const { width, height } = analyzer
      const y = value => height - ratio - value * (height - 4 * ratio)
      const x = bin => (bin + 0.5) * cell
      analyzerContext.fillStyle = '#060e12'
      analyzerContext.fillRect(0, 0, width, height)
      analyzerContext.fillStyle = '#132a2e'
      for (let i = 1; i < 4; i++) analyzerContext.fillRect(0, Math.round(i * height / 4), width, ratio)

      const live = history[0].map((value, bin) => value * (1 - fraction) + upcoming[bin] * fraction)
      const fill = analyzerContext.createLinearGradient(0, 0, 0, height)
      fill.addColorStop(0, '#6fe7e766')
      fill.addColorStop(1, '#6fe7e705')
      analyzerContext.beginPath()
      analyzerContext.moveTo(0, height)
      live.forEach((value, bin) => analyzerContext.lineTo(x(bin), y(value)))
      analyzerContext.lineTo(width, height)
      analyzerContext.closePath()
      analyzerContext.fillStyle = fill
      analyzerContext.fill()
      analyzerContext.strokeStyle = '#6fe7e7'
      analyzerContext.lineWidth = 1.5 * ratio
      analyzerContext.stroke()

      analyzerContext.fillStyle = '#ccff8b4d'
      live.forEach((value, bin) => {
        const peak = history.reduce((held, row) => Math.max(held, row[bin]), value)
        analyzerContext.fillRect(bin * cell + ratio, Math.round(y(peak)), cell - 2 * ratio, ratio)
      })

      const center = Math.round(width / 2)
      analyzerContext.fillStyle = '#ee89ba'
      analyzerContext.fillRect(center, 0, ratio, height)
      analyzerContext.font = `${16 * ratio}px Unifont, monospace`
      analyzerContext.textBaseline = 'top'
      analyzerContext.fillText('▼ 433.920', center + 6 * ratio, 2 * ratio)
    }

    function reset() {
      ratio = Math.min(window.devicePixelRatio || 1, 2)
      analyzer.width = Math.round(analyzer.clientWidth * ratio)
      analyzer.height = Math.round(analyzer.clientHeight * ratio)
      element.width = Math.round(element.clientWidth * ratio)
      element.height = Math.round(element.clientHeight * ratio)
      cell = Math.max(1, Math.round(CELL * ratio))
      bins = Math.ceil(element.width / cell)
      rows = Math.ceil(element.height / cell)
      scale = Math.max(1, Math.min(4, Math.floor((bins * 0.7) / LOGO[0].length)))
      logoLeft = Math.floor((bins - LOGO[0].length * scale) / 2)
      logoRows = LOGO.length * scale
      // The next transmission starts a short gap after the last one has scrolled out of view.
      logoEvery = Math.max(rows, logoRows) + 16
      // Pre-fill a full screen of history, timed so the logo has just arrived at the top on first paint.
      sample = logoRows + 2 - rows
      upcoming = rowLevels(sample)
      history = []
      for (let row = 0; row < rows; row++) emitRow()
      drawAnalyzer(0)
    }

    function animate(now) {
      if (!onScreen) {
        previousTime = null
      } else {
        if (previousTime !== null) pending += (now - previousTime) * ROWS_PER_SECOND / 1000
        previousTime = now
        // Cap catch-up after a stall, so a long pause doesn't flush the whole panel at once.
        pending = Math.min(pending, 4)
        while (pending >= 1) {
          emitRow()
          pending--
        }
        drawAnalyzer(pending)
      }
      frame = requestAnimationFrame(animate)
    }

    reset()
    const resizeObserver = new ResizeObserver(reset)
    resizeObserver.observe(element)
    const visibility = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting })
    visibility.observe(element)
    if (!still) frame = requestAnimationFrame(animate)

    // Repaint once the bundled font is in, so the marker label never keeps the fallback font.
    document.fonts.ready.then(() => { if (history.length) drawAnalyzer(0) })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibility.disconnect()
    }
  }, [])

  return (
    <div className="spectrum-display" aria-hidden="true">
      <canvas ref={analyzerCanvas} className="analyzer" />
      <canvas ref={canvas} className="waterfall" />
    </div>
  )
}
