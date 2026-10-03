import { useEffect, useState } from 'react'
import EventShow from './EventShow.jsx'
import Waterfall from './Waterfall.jsx'
import { AuthLog, LinkPanel } from './Telemetry.jsx'
import { hasAbstract, abstractParagraphs } from './events.js'
import './SignalView.css'

// Operator-console page for the second theme, after the fullscreen event visuals.
const NYC_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const NYC_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })

// Whole days from today in New York to an ISO date.
function daysUntil(date, now) {
  const toDay = iso => Date.UTC(...iso.split('-').map((part, i) => Number(part) - (i === 1 ? 1 : 0))) / 86400000
  return toDay(date) - toDay(NYC_DATE.format(now))
}

function countdown(days) {
  if (days > 1) return `T-${days} DAYS`
  if (days === 1) return 'TOMORROW'
  if (days === 0) return 'TONIGHT'
  return 'LOGGED'
}

function Abstract({ talk }) {
  return (
    <div className="signal-abstract">
      {abstractParagraphs(talk).map(({ text, slides }, index) => slides
        ? <p key={index}>slides: <a href={slides} target="_blank" rel="noopener noreferrer">{slides}</a></p>
        : <p key={index}>{text}</p>)}
    </div>
  )
}

// One talk line. With an abstract the whole line is a toggle; without one it shows "-".
function Talk({ talk, expanded, onToggle, className, children }) {
  const open = hasAbstract(talk) && expanded
  const content = <>
    {children}
    <span className="signal-state" aria-hidden="true">{hasAbstract(talk) ? (open ? '[-]' : '[+]') : '-'}</span>
  </>
  return (
    <li className={`${className}${open ? ' is-open' : ''}`}>
      {hasAbstract(talk) ? (
        <button type="button" className="signal-talk-line" onClick={onToggle} aria-expanded={open} aria-label={`${talk.title}, ${talk.speaker}. ${open ? 'Hide' : 'Show'} abstract`}>
          {content}
        </button>
      ) : (
        <div className="signal-talk-line">{content}</div>
      )}
      {open && <Abstract talk={talk} />}
    </li>
  )
}

export default function SignalView({ currentEvent, pastEvents, registerUrl, expandedTalks, toggleTalk }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const days = daysUntil(currentEvent.date, now)
  const talkCount = pastEvents.reduce((total, event) => total + event.talks.length, 0)

  return (
    <div className="signal">
      <header className="signal-bar signal-top">
        <span className="signal-session">[sprawl]</span>
        <nav className="signal-tabs" aria-label="Sections">
          <a href="#next">0:{currentEvent.id}*</a>
          <a href="#archive">1:archive</a>
        </nav>
        <EventShow launcherClassName="signal-play">
          <span aria-hidden="true">▶</span> <span className="signal-play-verb">play </span>visuals
        </EventShow>
        <span className="signal-clock"><span className="signal-live" aria-hidden="true">●</span> <span className="signal-clock-city">NYC </span>{NYC_TIME.format(now)}</span>
      </header>

      <main className="signal-main">
        <section className="signal-panel signal-spectrum" aria-label="Spectrum waterfall">
          <h2 className="signal-title">spectrum <span>433.92 MHz</span></h2>
          <Waterfall />
          <div className="signal-axis" aria-hidden="true">
            <span>433.12</span>
            <span className="signal-marker">▲ 433.92 MHz</span>
            <span>434.72</span>
          </div>
        </section>

        <div className="signal-grid">
          <section className="signal-panel">
            <h2 className="signal-title">readme.nfo</h2>
            <h1 className="signal-name">THE SPRAWL</h1>
            <p className="signal-tagline">nyc · cybersecurity · 2026</p>
            <ul className="signal-readme">
              <li>A non-corporate technical meetup run by a NYC hacker community.</li>
              <li>20-min talks by smart people we all like.</li>
              <li>Hosted every two months.<span className="signal-cursor" aria-hidden="true" /></li>
            </ul>
          </section>

          <section className="signal-panel signal-next" id="next">
            <h2 className="signal-title"><span className="signal-live" aria-hidden="true">●</span> next run</h2>
            <p className="signal-event-name">{currentEvent.name.toUpperCase()}</p>
            <dl className="signal-facts">
              <dt>date</dt><dd><time dateTime={currentEvent.date}>{currentEvent.date}</time></dd>
              <dt>host</dt><dd>{currentEvent.venue}</dd>
              <dt>eta</dt><dd className="signal-eta">{countdown(days)}</dd>
            </dl>
            <a className="signal-register" href={registerUrl} target="_blank" rel="noopener noreferrer">&gt;&gt; REGISTER &lt;&lt;</a>
          </section>
        </div>

        <section className="signal-panel" aria-labelledby="talks-title">
          <h2 className="signal-title" id="talks-title">talks <span>{currentEvent.name.toLowerCase()}</span></h2>
          <div className="signal-table-head" aria-hidden="true">
            <span>PID</span><span>TALK</span><span>SPEAKER</span><span>ABS</span>
          </div>
          <ul className="signal-table">
            {currentEvent.talks.map(talk => {
              const key = `${currentEvent.id}-${talk.id}`
              return (
                <Talk key={key} talk={talk} className="signal-row" expanded={expandedTalks[key]} onToggle={() => toggleTalk(key)}>
                  <span className="signal-pid">{currentEvent.id}.{talk.id}</span>
                  <span className="signal-talk-title">{talk.title}</span>
                  <span className="signal-speaker">{talk.speaker}</span>
                </Talk>
              )
            })}
          </ul>
        </section>

        <section className="signal-panel" aria-label="Link telemetry">
          <h2 className="signal-title">link <span>ServerAliveInterval 15</span><span className="signal-beat" aria-hidden="true" /></h2>
          <LinkPanel />
        </section>

        <section className="signal-panel" id="archive" aria-labelledby="archive-title">
          <h2 className="signal-title" id="archive-title">archive <span>{pastEvents.length} events · {talkCount} talks</span></h2>
          <p className="signal-prompt"><span>$</span> tree ~/sprawl/archive</p>
          <ul className="signal-tree">
            {pastEvents.map(event => (
              <li key={event.id}>
                <div className="signal-tree-event">
                  <span className="signal-pid">{event.id}</span>
                  <time dateTime={event.date}>{event.date}</time>
                  <span>{event.venue}</span>
                </div>
                <ul>
                  {event.talks.map(talk => {
                    const key = `${event.id}-${talk.id}`
                    return (
                      <Talk key={key} talk={talk} className="signal-tree-talk" expanded={expandedTalks[key]} onToggle={() => toggleTalk(key)}>
                        <span className="signal-talk-title">{talk.title}</span>
                        <span className="signal-speaker">{talk.speaker}</span>
                      </Talk>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="signal-panel" aria-label="Auth log">
          <h2 className="signal-title">tail -f /var/log/auth.log <span>sshd[4242]</span></h2>
          <AuthLog />
        </section>
      </main>

      <footer className="signal-bar signal-bottom">
        <span>EOF</span>
        <span>40.7128°N 74.0060°W</span>
      </footer>
    </div>
  )
}
