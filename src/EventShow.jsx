import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { drawShow, sceneAt, SCENES } from './eventShowRenderer.js'
import './EventShow.css'

export default function EventShow({ launcherVisible = true }) {
  const [open, setOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const screen = useRef(null)
  const canvas = useRef(null)
  const launch = useRef(null)
  const lock = useRef(null)
  const exit = useRef(null)
  // The animation loop reads the lock through a ref; the state only drives the button.
  const lockedRef = useRef(false)

  const setSceneLock = useCallback(value => {
    lockedRef.current = value
    setLocked(value)
  }, [])

  const close = useCallback(() => {
    if (document.fullscreenElement === screen.current) {
      document.exitFullscreen().catch(() => {})
    }
    setSceneLock(false)
    setOpen(false)
    launch.current?.focus()
  }, [setSceneLock])

  function start() {
    // Keep the fullscreen request inside the original user gesture.
    flushSync(() => setOpen(true))
    screen.current.requestFullscreen?.().catch(() => {
      // The fixed overlay also works when fullscreen is unavailable or denied.
    })
  }

  useEffect(() => {
    if (!open) return
    const element = screen.current
    const launchButton = launch.current
    const context = canvas.current.getContext('2d', { alpha: false })
    const previousOverflow = document.body.style.overflow
    const page = document.getElementById('root')
    const previousInert = page.inert
    page.inert = true
    document.body.style.overflow = 'hidden'
    // Focus the dialog itself: keys work from there, and the controls stay dim until someone tabs to them.
    element.focus()
    let enteredFullscreen = false
    let frame
    let lastDraw = -Infinity
    let elapsed = 0
    let previousTime = null
    let lockSpan = null
    let wakeLock
    let disposed = false

    async function keepAwake() {
      if (document.visibilityState !== 'visible' || !navigator.wakeLock) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (disposed) await lock.release()
        else wakeLock = lock
      } catch { /* Screen wake lock is an optional enhancement. */ }
    }
    function visibility() {
      previousTime = null
      if (document.visibilityState === 'visible') keepAwake()
    }
    function fullscreenChange() {
      if (document.fullscreenElement === element) enteredFullscreen = true
      else if (enteredFullscreen) close()
    }
    function keydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      } else if (event.key === 'Tab') {
        event.preventDefault()
        ;(document.activeElement === lock.current ? exit : lock).current?.focus()
      } else if (event.key === 'l' || event.key === 'L') {
        event.preventDefault()
        setSceneLock(!lockedRef.current)
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        // Arrows release the lock, then jump to the start of the next or previous scene;
        // 1ms past the boundary avoids float rounding.
        event.preventDefault()
        setSceneLock(false)
        const { index, time } = sceneAt(elapsed / 1000)
        const previous = SCENES[(index + SCENES.length - 1) % SCENES.length]
        const step = event.key === 'ArrowRight' ? SCENES[index].duration - time : -time - previous.duration
        elapsed += (step + 0.001) * 1000
        lastDraw = -Infinity
      }
    }
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.current.width = Math.round(element.clientWidth * ratio)
      canvas.current.height = Math.round(element.clientHeight * ratio)
    }
    function animate(now) {
      if (previousTime !== null && document.visibilityState === 'visible') {
        elapsed += now - previousTime
      }
      previousTime = now
      if (lockedRef.current) {
        // Hold the current scene by looping its own timeline.
        if (!lockSpan) {
          const { time, scene } = sceneAt(elapsed / 1000)
          lockSpan = { start: elapsed - time * 1000, length: scene.duration * 1000 }
        }
        if (elapsed >= lockSpan.start + lockSpan.length) {
          elapsed = lockSpan.start + 1 + (elapsed - lockSpan.start) % lockSpan.length
        }
      } else {
        lockSpan = null
      }
      // Cap drawing at 30 fps; scene timing stays independent of frame rate.
      if (now - lastDraw >= 1000 / 30) {
        drawShow(context, canvas.current.width, canvas.current.height, elapsed / 1000, { fades: !lockedRef.current })
        lastDraw = now
      }
      frame = requestAnimationFrame(animate)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    document.addEventListener('keydown', keydown)
    document.addEventListener('fullscreenchange', fullscreenChange)
    document.addEventListener('visibilitychange', visibility)
    keepAwake()
    frame = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('fullscreenchange', fullscreenChange)
      document.removeEventListener('visibilitychange', visibility)
      wakeLock?.release().catch(() => {})
      document.body.style.overflow = previousOverflow
      page.inert = previousInert
      launchButton?.focus()
    }
  }, [open, close, setSceneLock])

  return <>
    <button
      ref={launch}
      id="event-show-launch"
      className={`event-show-launch${launcherVisible ? '' : ' is-hidden'}`}
      onClick={start}
      aria-label="Launch event visuals (fullscreen, Escape to exit)"
    >
      <span aria-hidden="true">▶</span> <span className="event-show-launch-verb">Launch </span>event visuals
      <span className="event-show-launch-detail">FULLSCREEN / ESC TO EXIT</span>
    </button>
    {open && createPortal(
      <div ref={screen} className="event-show" role="dialog" aria-modal="true" aria-label="SPRAWL event visuals" tabIndex={-1}>
        <canvas ref={canvas} aria-label="Looping NYC cyberpunk visuals: the SPRAWL challenge coin's circuit-traced Statue of Liberty rebuilt in glitching ASCII, rotating SPRAWL ASCII art, an ASCII New York skyline with the Brooklyn Bridge, neon signs and radio signals, simulated Turbo Vision desktop, subway signal-tracking board, hacker terminal, a Neuromancer-inspired wireframe city with a scrolling William Gibson passage, a radio spectrum waterfall, a neon ASCII pin tumbler lock being picked until it glitches and explodes open, a circuit board booting over a UART debug port, and Conway's Game of Life with a glider gun." role="img" />
        <div className="event-show-controls">
          <button
            ref={lock}
            className="event-show-control"
            aria-pressed={locked}
            onClick={event => {
              setSceneLock(!locked)
              // After a mouse click, hand focus back to the dialog so later key presses don't light the button up.
              if (event.detail) screen.current.focus()
            }}
          >
            {locked ? 'LOCKED' : 'LOCK'} <span>/ L</span>
          </button>
          <button ref={exit} className="event-show-control" onClick={close}>ESC <span>/ EXIT</span></button>
        </div>
      </div>, document.body,
    )}
  </>
}
