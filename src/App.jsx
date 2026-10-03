import { Fragment, useState, useEffect } from 'react'
import './App.css'
import EventShow from './EventShow.jsx'
import CoinIntro from './CoinIntro.jsx'
import ReaderView from './ReaderView.jsx'
import SignalView from './SignalView.jsx'
import { REGISTER_URL, currentEvent, pastEvents, hasAbstract, abstractParagraphs, eventDetails } from './events.js'

function App() {
  const [memoryAddresses, setMemoryAddresses] = useState([])
  const [expandedTalks, setExpandedTalks] = useState({})
  const [currentTheme, setCurrentTheme] = useState('signal')
  const [olderEventsExpanded, setOlderEventsExpanded] = useState(false)
  const [launcherVisible, setLauncherVisible] = useState(false)
  const [stars, setStars] = useState([])
  const [matrixColumns, setMatrixColumns] = useState([])
  const [effectIntensity, setEffectIntensity] = useState(8) // Start at 8x intensity
  const [hoveredTalk, setHoveredTalk] = useState(null)

  const generateHexAddress = () => {
    return '0x' + Math.random().toString(16).substring(2, 10).toUpperCase()
  }

  // Gradually decrease effect intensity over 4 seconds
  useEffect(() => {
    const steps = [8, 7, 6, 5, 4, 3, 2, 1] // 8 steps over 4 seconds
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      if (currentStep < steps.length) {
        setEffectIntensity(steps[currentStep])
      } else {
        clearInterval(interval)
      }
    }, 500) // Every 500ms

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const newAddress = {
        id: Date.now(),
        text: generateHexAddress(),
        x: Math.random() * 100,
        y: Math.random() * 100
      }

      setMemoryAddresses(prev => [...prev, newAddress])

      // Remove address after 1 second
      setTimeout(() => {
        setMemoryAddresses(prev => prev.filter(addr => addr.id !== newAddress.id))
      }, 1000)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Star animation for Talk 1
  useEffect(() => {
    const starChars = ['*', '+', '.', '·', '✷', '✶', '✵', '✸', '✧', '✦']
    const baseInterval = 333 // Normal rate: 3 per second
    const currentIntensity = (hoveredTalk === `${currentEvent.id}-1` && !expandedTalks[`${currentEvent.id}-1`]) ? 8 : effectIntensity
    const interval = setInterval(() => {
      const newStar = {
        id: Date.now() + Math.random(),
        text: starChars[Math.floor(Math.random() * starChars.length)],
        x: Math.random() * 100,
        y: Math.random() * 100
      }

      setStars(prev => [...prev, newStar])

      // Remove star after 2 seconds (duration of fade animation)
      setTimeout(() => {
        setStars(prev => prev.filter(star => star.id !== newStar.id))
      }, 2000)
    }, baseInterval / currentIntensity)

    return () => clearInterval(interval)
  }, [effectIntensity, hoveredTalk, expandedTalks])

  // Matrix animation for Talk 2
  useEffect(() => {
    const matrixChars = ['ﾊ', 'ﾐ', 'ﾋ', 'ｰ', 'ｳ', 'ｼ', 'ﾅ', 'ﾓ', 'ﾆ', 'ｻ', 'ﾜ', 'ﾂ', 'ｵ', 'ﾘ', 'ｱ', 'ﾎ', 'ﾃ', 'ﾏ', 'ｹ', 'ﾒ', 'ｴ', 'ｶ', 'ｷ', 'ﾑ', 'ﾕ', 'ﾗ', 'ｾ', 'ﾈ', 'ｽ', 'ﾀ', 'ﾇ', 'ﾍ', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Z', ':' , '.', '"', '=', '*', '+', '-', '<', '>', '¦', '|', '╌']
    const baseInterval = 200 // Normal rate: 5 per second
    const currentIntensity = (hoveredTalk === `${currentEvent.id}-2` && !expandedTalks[`${currentEvent.id}-2`]) ? 8 : effectIntensity
    const interval = setInterval(() => {
      const columnLength = Math.floor(Math.random() * 3) + 3 // 3-5 characters
      const characters = []
      for (let i = 0; i < columnLength; i++) {
        characters.push(matrixChars[Math.floor(Math.random() * matrixChars.length)])
      }

      const newColumn = {
        id: Date.now() + Math.random(),
        characters: characters,
        x: Math.random() * 100
      }

      setMatrixColumns(prev => [...prev, newColumn])

      // Remove column after animation completes (10 seconds)
      setTimeout(() => {
        setMatrixColumns(prev => prev.filter(col => col.id !== newColumn.id))
      }, 10000)
    }, baseInterval / currentIntensity)

    return () => clearInterval(interval)
  }, [effectIntensity, hoveredTalk, expandedTalks])

  const toggleTalk = (talkId) => {
    setExpandedTalks(prev => ({
      ...prev,
      [talkId]: !prev[talkId]
    }))
  }

  const handleRegisterClick = (e) => {
    e.preventDefault()
    window.open(REGISTER_URL, '_blank', 'noopener,noreferrer')
  }

  // Header and expandable abstract shared by every talk box.
  const renderTalk = (event, talk) => {
    const key = `${event.id}-${talk.id}`
    return (
      <>
        <div
          className="talk-header"
          onClick={() => toggleTalk(key)}
        >
          <span className="toggle-icon">
            [ {expandedTalks[key] ? '-' : '+'} ]
          </span>
          <div className="talk-info">
            <div className="talk-title">{event.talks.length > 1 && `Talk ${talk.id}: `}{talk.title}</div>
            <div className="talk-speaker">{talk.speaker}</div>
          </div>
        </div>
        {expandedTalks[key] && (
          <div className="talk-description">
            {hasAbstract(talk) ? abstractParagraphs(talk).map(({ text, slides }, index) => slides ? (
              <p key={index} style={{ marginBottom: '1em', color: 'fuchsia' }}>
                Slides: <a href={slides} target="_blank" rel="noopener noreferrer" style={{ color: 'fuchsia' }}>{slides}</a>
              </p>
            ) : (
              <p key={index} style={{ marginBottom: '1em' }}>
                {text}
              </p>
            )) : <p>-</p>}
          </div>
        )}
      </>
    )
  }

  const asciiText = `
                              _
 ___ _ __  _ __ __ ___      _| |
/ __| '_ \\| '__/ _\` \\ \\ /\\ / / |
\\__ \\ |_) | | | (_| |\\ V  V /| |
|___/ .__/|_|  \\__,_| \\_/\\_/ |_|
    |_|
`

  return (
    <div className={`app theme-${currentTheme}`}>
      {/* Theme switcher buttons */}
      <div className="theme-switcher">
        <button
          className={`theme-btn ${currentTheme === 'default' ? 'active' : ''}`}
          onClick={() => setCurrentTheme('default')}
          aria-label="Default theme"
        >
          𓁿
        </button>
        <button
          className={`theme-btn ${currentTheme === 'signal' ? 'active' : ''}`}
          onClick={() => setCurrentTheme('signal')}
          aria-label="Signal theme"
        >
          𓆣
        </button>
        <button
          className={`theme-btn ${currentTheme === 'purple' ? 'active' : ''}`}
          onClick={() => setCurrentTheme('purple')}
          aria-label="Reader mode theme"
        >
          𓃠
        </button>
      </div>

      {currentTheme === 'purple' ? (
        <ReaderView
          currentEvent={currentEvent}
          pastEvents={pastEvents}
          registerUrl={REGISTER_URL}
          expandedTalks={expandedTalks}
          toggleTalk={toggleTalk}
        />
      ) : currentTheme === 'signal' ? (
        <SignalView
          currentEvent={currentEvent}
          pastEvents={pastEvents}
          registerUrl={REGISTER_URL}
          expandedTalks={expandedTalks}
          toggleTalk={toggleTalk}
        />
      ) : (<>
      {/* Background memory addresses */}
      {memoryAddresses.map(address => (
        <div
          key={address.id}
          className="memory-address"
          data-text={address.text}
          style={{
            left: `${address.x}%`,
            top: `${address.y}%`
          }}
        >
          {address.text}
        </div>
      ))}

      <div className="ascii-art-container">
        <CoinIntro expanded={launcherVisible} onToggle={() => setLauncherVisible(visible => !visible)} />
        <EventShow launcherVisible={launcherVisible} />
        <pre className="ascii-art" data-text={asciiText}>
{asciiText}
        </pre>
        <div className="text-line">
          nyc - cybersecurity - 2026
        </div>

        {/* New content from README */}
        <div className="sprawl-info">
          <div className="info-header">
            <div>A non-corporate technical meetup run by a NYC hacker community.</div>
            <div>20-min talks by smart people we all like.</div>
            <div>Hosted every two months.</div>
          </div>

          {/* Upcoming event */}
          <div className="event-details">
            <h2>-- {currentEvent.name} --</h2>
            <div>{eventDetails(currentEvent)}</div>
            <a href="#" className="register-button" onClick={handleRegisterClick}>
              Register
            </a>
          </div>

          <div className="talks-container">
            {currentEvent.talks.map(talk => {
              const key = `${currentEvent.id}-${talk.id}`
              const effectOpacity = (hoveredTalk === key && !expandedTalks[key]) ? 1.0 : Math.min(1.0, 0.5 + (effectIntensity - 1) * 0.071)
              return (
                <div
                  key={key}
                  className={`talk-box ${talk.id === 1 ? 'talk-box-with-stars' : ''} ${talk.id === 2 ? 'talk-box-with-matrix' : ''}`}
                  onMouseEnter={() => setHoveredTalk(key)}
                  onMouseLeave={() => setHoveredTalk(null)}
                >
                  {/* Stars animation for Talk 1 only - when collapsed */}
                  {talk.id === 1 && !expandedTalks[key] && (
                    <div className="stars-container" style={{ '--effect-opacity': effectOpacity }}>
                      {stars.map(star => (
                        <div
                          key={star.id}
                          className="talk-star"
                          style={{
                            left: `${star.x}%`,
                            top: `${star.y}%`
                          }}
                        >
                          {star.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Matrix animation for Talk 2 only - when collapsed */}
                  {talk.id === 2 && !expandedTalks[key] && (
                    <div className="matrix-container" style={{ '--effect-opacity': effectOpacity }}>
                      {matrixColumns.map(column => (
                        <div
                          key={column.id}
                          className="matrix-column"
                          style={{
                            left: `${column.x}%`
                          }}
                        >
                          {column.characters.map((char, index) => (
                            <div key={index} className="matrix-char">
                              {char}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {renderTalk(currentEvent, talk)}
                </div>
              )
            })}
          </div>

          {/* Older Events Section */}
          <div className="older-events-section">
            <div
              className="older-events-header"
              onClick={() => setOlderEventsExpanded(!olderEventsExpanded)}
            >
              <span className="toggle-icon">
                [ {olderEventsExpanded ? '-' : '+'} ]
              </span>
              <h3>Older Events</h3>
            </div>

            {olderEventsExpanded && (
              <div className="older-events-content">
                {pastEvents.map(event => (
                  <Fragment key={event.id}>
                    <div className="event-details">
                      <h2>-- {event.name} --</h2>
                      <div>{eventDetails(event)}</div>
                    </div>

                    <div className="talks-container">
                      {event.talks.map(talk => (
                        <div key={`${event.id}-${talk.id}`} className="talk-box">
                          {renderTalk(event, talk)}
                        </div>
                      ))}
                    </div>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </>)}
    </div>
  )
}

export default App

