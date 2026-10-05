import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { drawShow, sceneAt, SCENES } from './eventShowRenderer.js'
import './EventShow.css'

// Seconds to fade the live visuals to black before the slides, and back in afterwards.
const FADE_TO_SLIDES = 1.5
const FADE_FROM_SLIDES = 0.8
const NOTICE_TIME = 3000

// A page can restyle the launcher by passing its own class and label as children.
export default function EventShow({ launcherVisible = true, launcherClassName, children }) {
  const [open, setOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  // Typing / opens a command line: the text typed so far, or null while it's closed.
  const [command, setCommand] = useState(null)
  const [notice, setNotice] = useState(null)
  const [presenting, setPresenting] = useState(false)
  const screen = useRef(null)
  const canvas = useRef(null)
  const launch = useRef(null)
  const lock = useRef(null)
  const exit = useRef(null)
  // The animation loop reads the lock through a ref; the state only drives the button.
  const lockedRef = useRef(false)
  // The ESC button ends the slides first; the effect that owns them fills this in.
  const endSlides = useRef(null)

  const setSceneLock = useCallback(value => {
    lockedRef.current = value
    setLocked(value)
  }, [])

  const close = useCallback(() => {
    if (document.fullscreenElement === screen.current) {
      document.exitFullscreen().catch(() => {})
    }
    setSceneLock(false)
    setCommand(null)
    setNotice(null)
    setPresenting(false)
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
    // Visible running time in seconds; the slides and their fades run on it while the loop stays paused.
    let clock = 0
    let typed = null
    let noticeTimer
    // While presenting: { slides, slide, started } with slide = { index, from, fromTime, start }.
    // slides is the lazily loaded recap module, null until it arrives.
    let deck = null
    let fadeIn = -Infinity
    // Fetch the recap slides as soon as the visuals open, and build their map while the loop idles, so
    // /slides needs neither the network nor a pause when it's typed.
    const recap = import('./recapSlides.js')
    recap.then(module => {
      if (!disposed) (window.requestIdleCallback ?? setTimeout)(() => module.prepare())
    }).catch(() => {})

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
    function say(message) {
      clearTimeout(noticeTimer)
      setNotice(message)
      noticeTimer = setTimeout(() => setNotice(null), NOTICE_TIME)
    }
    function type(value) {
      typed = value
      setCommand(value)
    }
    function startSlides() {
      if (deck) {
        // Already presenting: back to the title card.
        if (deck.slides) deck.slide = { index: 0, from: null, fromTime: 0, start: clock }
        return
      }
      setSceneLock(false)
      setPresenting(true)
      const current = deck = { slides: null, slide: { index: 0, from: null, fromTime: 0, start: clock + FADE_TO_SLIDES }, started: clock }
      recap.then(module => {
        if (deck !== current) return
        current.slides = module
        // If the module was slow, start the title card once it's here rather than part way in.
        current.slide.start = Math.max(current.slide.start, clock)
      }).catch(() => {
        if (deck !== current) return
        stopSlides()
        say('slides failed to load')
      })
    }
    function stopSlides() {
      deck = null
      fadeIn = clock
      setPresenting(false)
      lastDraw = -Infinity
    }
    endSlides.current = stopSlides
    function goToSlide(step) {
      if (!deck?.slides || clock < deck.slide.start) return
      const index = deck.slide.index + step
      if (index < 0 || index >= deck.slides.SLIDES.length) return
      deck.slide = { index, from: deck.slide.index, fromTime: clock - deck.slide.start, start: clock }
    }
    const COMMANDS = { slides: startSlides }
    function run(line) {
      const name = line.slice(1).trim().toLowerCase()
      if (COMMANDS[name]) COMMANDS[name]()
      else if (name) say(`unknown command: /${name}   try /${Object.keys(COMMANDS).join(' /')}`)
    }
    function commandKey(event) {
      if (event.key === 'Escape') type(null)
      else if (event.key === 'Enter') {
        const line = typed
        type(null)
        run(line)
      } else if (event.key === 'Backspace') type(typed.length > 1 ? typed.slice(0, -1) : null)
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (typed.length < 40) type(typed + event.key)
      } else if (event.key === 'Tab') return false
      event.preventDefault()
      return true
    }
    function keydown(event) {
      if (typed !== null && commandKey(event)) return
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        clearTimeout(noticeTimer)
        setNotice(null)
        type('/')
      } else if (event.key === 'Escape') {
        event.preventDefault()
        if (deck) stopSlides()
        else close()
      } else if (deck) {
        // Arrows, space and presentation clickers (PageUp/PageDown) step through the slides.
        if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
          event.preventDefault()
          goToSlide(1)
        } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
          event.preventDefault()
          goToSlide(-1)
        } else if (event.key === 'Tab') {
          event.preventDefault()
          exit.current?.focus()
        }
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
        const delta = now - previousTime
        clock += delta / 1000
        // The loop keeps running through the fade to black, then holds until the slides end.
        if (!deck || clock - deck.started < FADE_TO_SLIDES) elapsed += delta
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
        const { width, height } = canvas.current
        if (deck?.slides && clock >= deck.slide.start) {
          deck.slides.drawRecap(context, width, height, deck.slide, clock - deck.slide.start)
        } else {
          drawShow(context, width, height, elapsed / 1000, { fades: !lockedRef.current })
          const black = deck ? (clock - deck.started) / FADE_TO_SLIDES : 1 - (clock - fadeIn) / FADE_FROM_SLIDES
          if (black > 0) {
            context.setTransform(1, 0, 0, 1, 0, 0)
            context.fillStyle = `rgba(0, 0, 0, ${Math.min(1, black)})`
            context.fillRect(0, 0, width, height)
          }
        }
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
      clearTimeout(noticeTimer)
      endSlides.current = null
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
      className={launcherClassName ?? `event-show-launch${launcherVisible ? '' : ' is-hidden'}`}
      onClick={start}
      aria-label="Launch event visuals (fullscreen, Escape to exit)"
    >
      {children ?? <>
        <span aria-hidden="true">▶</span> <span className="event-show-launch-verb">Launch </span>event visuals
        <span className="event-show-launch-detail">FULLSCREEN / ESC TO EXIT</span>
      </>}
    </button>
    {open && createPortal(
      <div ref={screen} className="event-show" role="dialog" aria-modal="true" aria-label="SPRAWL event visuals" tabIndex={-1}>
        <canvas ref={canvas} aria-label={presenting ? 'SPRAWL 0x7 one-year recap slides: a title card, then a dark map of New York City that flies to each venue. Arrow keys step through the slides.' : "Looping NYC cyberpunk visuals: the SPRAWL challenge coin's circuit-traced Statue of Liberty rebuilt in glitching ASCII, rotating SPRAWL ASCII art, an ASCII New York skyline with the Brooklyn Bridge, neon signs and radio signals, simulated Turbo Vision desktop, subway signal-tracking board, hacker terminal with SSH session telemetry and a scrolling auth log, a Neuromancer-inspired wireframe city with a scrolling William Gibson passage, a radio spectrum waterfall, a btop-style system monitor with live graphs and a meetup-themed process list, a circuit board booting over a UART debug port, and Conway's Game of Life with a glider gun."} role="img" />
        {(command !== null || notice) && (
          <div className="event-show-command" role="status">
            {command !== null ? <>{command}<span className="event-show-cursor" aria-hidden="true" /></> : notice}
          </div>
        )}
        <div className="event-show-controls">
          <button
            ref={lock}
            hidden={presenting}
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
          <button
            ref={exit}
            className="event-show-control"
            onClick={event => {
              if (!presenting) return close()
              endSlides.current?.()
              if (event.detail) screen.current.focus()
            }}
          >
            ESC <span>/ {presenting ? 'END SLIDES' : 'EXIT'}</span>
          </button>
        </div>
      </div>, document.body,
    )}
  </>
}
