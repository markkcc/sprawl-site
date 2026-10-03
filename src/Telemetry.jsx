import { useEffect, useRef, useState } from 'react'
import { AUTH_LOG, LINK_RATE, linkRtt, noise } from './eventShowRenderer.js'

// The link and auth-log panels from the fullscreen terminal scene, as live page panels.
const STEP = 5 // CSS pixels per sample
const GREEN = '#ccff8b'
const CYAN = '#6fe7e7'
const FUCHSIA = '#ff4fd8'
const AMBER = '#ffc145'
const RULE = '#35574a'

// The scene's traffic follows its terminal; here it comes in bursts, receive and transmit apart.
function traffic(sample) {
  const burst = (seed, length) => {
    const window = Math.floor(sample / 12)
    return noise(window * seed + 1.3) > 0.55 && sample - window * 12 < length ? 1 : 0
  }
  return {
    down: 0.08 + 0.12 * noise(sample * 1.7) + burst(3.3, 7) * (0.5 + 0.4 * noise(sample * 3.1)),
    up: 0.05 + 0.08 * noise(sample * 2.3) + burst(5.9, 4) * (0.35 + 0.35 * noise(sample * 4.7)),
  }
}

function fit(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(canvas.clientWidth * ratio)
  canvas.height = Math.round(canvas.clientHeight * ratio)
  return ratio
}

export function LinkPanel() {
  const rttCanvas = useRef(null)
  const trafficCanvas = useRef(null)
  const rttText = useRef(null)
  const trafficText = useRef(null)

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const started = performance.now()
    let ratio = 1
    let onScreen = true

    function draw() {
      const t = (performance.now() - started) / 1000
      const now = Math.floor(t * LINK_RATE) + 600 // start mid-history, so the graphs open full

      // Round-trip time: a filled trace, with congestion spikes marked in amber.
      const rtt = rttCanvas.current
      const context = rtt.getContext('2d')
      const step = STEP * ratio
      const count = Math.floor(rtt.width / step) + 1
      const rtts = Array.from({ length: count }, (_, i) => linkRtt(now - count + 1 + i))
      const y = ms => rtt.height - ratio - Math.min(1, ms / 70) * (rtt.height - 6 * ratio)
      context.clearRect(0, 0, rtt.width, rtt.height)
      context.beginPath()
      context.moveTo(0, rtt.height)
      rtts.forEach((ms, i) => context.lineTo(i * step, y(ms)))
      context.lineTo((count - 1) * step, rtt.height)
      context.closePath()
      context.fillStyle = '#ccff8b1f'
      context.fill()
      context.beginPath()
      rtts.forEach((ms, i) => i ? context.lineTo(i * step, y(ms)) : context.moveTo(0, y(ms)))
      context.strokeStyle = GREEN
      context.lineWidth = 1.5 * ratio
      context.stroke()
      context.fillStyle = AMBER
      rtts.forEach((ms, i) => {
        if (ms <= 30) return
        context.beginPath()
        context.arc(i * step, y(ms), 2 * ratio, 0, Math.PI * 2)
        context.fill()
      })
      context.fillStyle = RULE
      context.fillRect(0, rtt.height - ratio, rtt.width, ratio)
      const p95 = [...rtts].sort((a, b) => a - b)[Math.floor(rtts.length * 0.95)]
      rttText.current.textContent = `RTT ${rtts.at(-1).toFixed(1)} ms   p95 ${Math.round(p95)} ms`
      rttText.current.classList.toggle('is-spike', rtts.at(-1) > 30)

      // Traffic: receive above the line in cyan, transmit below in fuchsia.
      const bars = trafficCanvas.current
      const barContext = bars.getContext('2d')
      const middle = Math.round(bars.height / 2)
      const reach = middle - 2 * ratio
      const columns = Math.floor(bars.width / step)
      barContext.clearRect(0, 0, bars.width, bars.height)
      barContext.fillStyle = RULE
      barContext.fillRect(0, middle - ratio, bars.width, ratio)
      for (let i = 0; i < columns; i++) {
        const { down, up } = traffic(now - columns + 1 + i)
        barContext.fillStyle = CYAN
        barContext.fillRect(i * step, middle - ratio - down * reach, 3 * ratio, down * reach)
        barContext.fillStyle = FUCHSIA
        barContext.fillRect(i * step, middle, 3 * ratio, up * reach)
      }
      trafficText.current.textContent = `▲ RX ${(1.21 + t * 0.013).toFixed(2)} MiB   ▼ TX ${Math.round(286 + t * 3.1)} KiB`
    }

    function resize() {
      ratio = fit(rttCanvas.current)
      fit(trafficCanvas.current)
      draw()
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(rttCanvas.current)
    resizeObserver.observe(trafficCanvas.current)
    const visibility = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting })
    visibility.observe(rttCanvas.current)
    const timer = still ? null : setInterval(() => { if (onScreen) draw() }, 1000 / LINK_RATE)

    return () => {
      clearInterval(timer)
      resizeObserver.disconnect()
      visibility.disconnect()
    }
  }, [])

  return (
    <div className="signal-link">
      <div>
        <p className="signal-link-label">round trip</p>
        <canvas ref={rttCanvas} className="signal-graph" aria-hidden="true" />
        <p className="signal-link-stat" ref={rttText} />
      </div>
      <div>
        <p className="signal-link-label">traffic</p>
        <canvas ref={trafficCanvas} className="signal-graph" aria-hidden="true" />
        <p className="signal-link-stat" ref={trafficText} />
      </div>
    </div>
  )
}

const LOG_LINES = 6
const LOG_EVERY = 1600 // ms between log lines
const LOG_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const logEntry = (index, time) => {
  const [message, color] = AUTH_LOG[index % AUTH_LOG.length]
  return { index, message, color, stamp: LOG_TIME.format(time) }
}

export function AuthLog() {
  // Open with a screenful of history, stamped as if it had been arriving all along.
  const [entries, setEntries] = useState(() => {
    const now = Date.now()
    return Array.from({ length: LOG_LINES }, (_, i) => logEntry(i, now - (LOG_LINES - 1 - i) * LOG_EVERY))
  })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      setEntries(previous => [...previous.slice(1), logEntry(previous.at(-1).index + 1, Date.now())])
    }, LOG_EVERY)
    return () => clearInterval(timer)
  }, [])

  // Re-keying the list on each new line replays the slide-up, so older lines move up one row.
  return (
    <div className="signal-log-window" aria-hidden="true">
      <ol className="signal-log" key={entries.at(-1).index}>
        {entries.map(entry => (
          <li key={entry.index}>
            <span className="signal-log-time">{entry.stamp}</span>
            <span style={{ color: entry.color }}>{entry.message}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
