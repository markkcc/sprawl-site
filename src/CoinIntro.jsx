import { useEffect, useRef } from 'react'
import { drawCoinIntro } from './eventShowRenderer.js'
import './CoinIntro.css'

// The time at which the coin has finished decoding and has not yet started glitching.
const SETTLED = 4.5

// The coin doubles as the switch that reveals the event visuals launcher.
export default function CoinIntro({ expanded, onToggle }) {
  const canvas = useRef(null)

  useEffect(() => {
    const element = canvas.current
    const context = element.getContext('2d')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame
    let elapsed = 0
    let previousTime = null
    let lastDraw = -Infinity
    let onScreen = true
    let disposed = false

    function draw() {
      drawCoinIntro(context, element.width, element.height, still ? SETTLED : elapsed / 1000)
    }
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.round(element.clientWidth * ratio)
      element.height = Math.round(element.clientHeight * ratio)
      draw()
    }
    function animate(now) {
      // Hold the clock while scrolled away or while the fullscreen show makes the page inert.
      if (!onScreen || element.closest('[inert]')) {
        previousTime = null
      } else {
        if (previousTime !== null) elapsed += now - previousTime
        previousTime = now
        // Cap drawing at 30 fps, like the show.
        if (now - lastDraw >= 1000 / 30) {
          draw()
          lastDraw = now
        }
      }
      frame = requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    const visibility = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting })
    visibility.observe(element)
    // Redraw once the bundled font is in, so a still frame never keeps the fallback font.
    document.fonts.ready.then(() => { if (!disposed) draw() })
    if (!still) frame = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibility.disconnect()
    }
  }, [])

  return <button
    type="button"
    className="coin-intro"
    onClick={onToggle}
    aria-expanded={expanded}
    aria-controls="event-show-launch"
    aria-label="The SPRAWL challenge coin: a circuit-traced Statue of Liberty in ASCII. Shows the event visuals launcher."
  >
    <canvas ref={canvas} aria-hidden="true" />
  </button>
}
