import { useState, useEffect } from 'react'
import './App.css'
import { decodeLumaCode } from './encodeUtils'

function App() {
  const [memoryAddresses, setMemoryAddresses] = useState([])
  const [expandedTalks, setExpandedTalks] = useState({})
  const [currentTheme, setCurrentTheme] = useState('default')
  const [olderEventsExpanded, setOlderEventsExpanded] = useState(false)
  const [stars, setStars] = useState([])
  const [matrixColumns, setMatrixColumns] = useState([])
  const [effectIntensity, setEffectIntensity] = useState(8) // Start at 8x intensity
  const [hoveredTalk, setHoveredTalk] = useState(null)
  const [registrationUnlockTime] = useState(new Date('2026-05-15T18:00:00-04:00'))
  const [timeUntilUnlock, setTimeUntilUnlock] = useState(null)
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)

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

  // Registration countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const timeDiff = registrationUnlockTime - now

      if (timeDiff <= 0) {
        setIsRegistrationOpen(true)
        setTimeUntilUnlock(null)
      } else {
        setIsRegistrationOpen(false)
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)

        setTimeUntilUnlock({ days, hours, minutes, seconds })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [registrationUnlockTime])

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
    const currentIntensity = (hoveredTalk === '0x4-1' && !expandedTalks['0x4-1']) ? 8 : effectIntensity
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
    const currentIntensity = (hoveredTalk === '0x4-2' && !expandedTalks['0x4-2']) ? 8 : effectIntensity
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
    window.open('https://luma.com/x8bqsmr4', '_blank', 'noopener,noreferrer')
  }

  const asciiText = `
                              _
 ___ _ __  _ __ __ ___      _| |
/ __| '_ \\| '__/ _\` \\ \\ /\\ / / |
\\__ \\ |_) | | | (_| |\\ V  V /| |
|___/ .__/|_|  \\__,_| \\_/\\_/ |_|
    |_|
`

  const talks0x5 = [
    {
      id: 1,
      title: "TBD",
      speaker: "TBD",
      description: "TBD"
    },
    {
      id: 2,
      title: "5-min Lightning Talks!",
      speaker: "You!",
      description: "Many smart people attend Sprawl, and we want to hear more from them. So we are hosting a round of lightning talks. Limited to 5 minutes per talk (which is challenging! you only have time for two and a half sentences!)"
    }
  ]

  const talks0x4 = [
    {
      id: 1,
      title: "DE&TH's Game: How AI is Evolving Detections as Code",
      speaker: "Christina Parry, Huntress",
      description: "TBD"
    },
    {
      id: 2,
      title: "Design for Security",
      speaker: "Serena Chen, Google",
      description: `__SLIDES__https://docs.google.com/presentation/d/1zU1-nhfJxh2fd2ggrGLNCkf8K27FDCxmOZAAAj2PsL0/

There's a misconception that security is a niche for masterminds. In the real world, most security breaches don't come from 0days or neat hacks. In fact, most errors are human—simple scams that have worked since society began.

This is where UX design fills a missed opportunity. Good user experience design is necessary for good security. We can craft paths of least resistance that match paths of most security. We can educate our users on what is good practice and what is security theater. We can build secure flows that are usable, not obstructive or annoying. A better world is possible!!!`
    }
  ]

  const talks0x3 = [
    {
      id: 1,
      title: "Dill With It: Pickle Exploitation Techniques And Their Detection Using SaferPickle",
      speaker: "Andrew Johnston and George Litvinov, Google",
      description: `Python's pickle format is a security minefield, yet it remains a cornerstone of modern AI/ML and data science workflows. While its dangers are well-known, the effectiveness of existing open-source scanners against sophisticated attacks has remained largely unexamined.

In this talk we introduce five novel bypass techniques to defeat popular open-source scanners like Fickling, Modelscan and Picklescan. We will demonstrate how these tools can be tricked into classifying overtly malicious pickles as safe.

To combat these threats, we propose SaferPickle, a new open-source library. This library enhances the pickle format's security at runtime through transparent hardening. We will present its robust, multi-layered scanning engine, which integrates behavioral analysis, direct opcode inspection, and an intelligent module resolution system capable of securely reconstructing malicious calls from fragmented code.

Finally, we'll share our journey of deploying SaferPickle to protect ML workloads at Google and integrating it as the first-ever pickle scanner in VirusTotal. Attendees will leave with knowledge of bypass techniques, a new open-source tool and experience of how to harden the ML supply chain against one of its most persistent threats.`
    },
    {
      id: 2,
      title: "Negative Space: a JTW continuation project",
      speaker: "Alice Bibaud",
      description: "TBD"
    }
  ]

  const talks0x2 = [
    {
      id: 1,
      title: "Forcing attackers to pay to play: iOS spoofing detections across the app store",
      speaker: "Kent Ma, Uber",
      description: "This talk focuses on ways of breaking economic incentives of large-scale mobile app fraud by verifying mobile client authenticity and forcing attackers to own and rotate more physical hardware.\n\nIt describes lessons learned on a large mobile app from operating hardware attestation, App Attest framework, jailbreak detection, and device banning."
    },
    {
      id: 2,
      title: "To build or to buy, that is the question",
      speaker: "Antoinette Stevens, Ramp",
      description: "To build the SIEM or buy the SIEM? Should we deploy an open source product or buy an enterprise plan? Every team faces the build or buy question. This talk examines the approach I've taken when deciding when to build vs buy and how to know what might be best for your team."
    }
  ]

  const talks0x1 = [
    {
      id: 1,
      title: "A Secret Talk about macOS Detection Engineering",
      speaker: "Olivia Gallucci, DataDog",
      description: "This talk examines macOS telemetry sources (Unified Logging System, Endpoint Security, and TCC.db) and methods for extracting signals. It analyzes abuse of automation utilities in infostealers, highlighting common methods of persistence and credential-theft. Detection strategies focus on behavioral correlations, and how they can be visualized through open-source tooling."
    },
    {
      id: 2,
      title: "Your Apes May Be Gone, But the Hackers Made $9 Billion and They're Still Here",
      speaker: "Andrew MacPherson, Privy",
      description: `Last year, crypto thefts hit $9.32 billion—more than half of all cybercrime losses. North Korea just pulled off a $1.5 billion heist from a single exchange. Meanwhile, most security professionals still think crypto is just magic internet money for buying NFT monkeys.

This talk is for the crypto-skeptical security professional who's tired of hearing about "blockchain". I'll show you why crypto security is 90% the same Web2 skills you already have—phishing, social engineering, API abuse—just with irreversible consequences and way better attacker ROI.

We'll start with a practical crypto primer covering the essentials: how blockchains work, what wallets actually do, and why stablecoins matter. Then we'll dive into the current threat landscape: who's stealing what, how OFAC sanctions work in a pseudonymous world, and why traditional threat intel is failing miserably at tracking crypto crime.

Most importantly, I'll show you what makes crypto security uniquely interesting. You're dealing with immutable code, irreversible transactions, and attackers monetary wins that can't just be rolled or clawed back. The threat actors range from nation-states to teenage hackers, the attack surface spans everything from smart contract logic to social engineering, and the defensive tooling is still being invented.

Come for the massive heist stories, stay because you realize this is an unexplored frontier with its own unique problems. By the end, you'll understand why crypto security attracts both sophisticated attackers and curious defenders—not for the hype, but because it's a different kind of security challenge worth understanding.

Key Takeaways:

- Why crypto crimes now dominate cybercrime statistics
- How your existing security skills translate directly to Web3
- What makes crypto security different from traditional infosec
- Practical resources to explore this space without the hype`
    },
    {
      id: 3,
      title: "Confidential To Compromised: A Deep Dive Into Private LLMs",
      speaker: "Aman Ali, Meta",
      description: `Private LLMs are emerging across the tech landscape, starting with Apple's PCC, then GCP/Azure's Confidential AI Cloud offerings, and Whatsapps Private Processing products. These systems promise a secure LLM you can verifiably send your most sensitive information to, and often draw parallels to e2ee messaging systems like Signal or WhatsApp. However, one end of this connection is always decrypted in a server somewhere and is subject to undetectable law enforcement, hackers and curious insiders. How far do the technologies underpinning these systems actually go, and what does it take to turn your upcoming AI confidant into a backdoor into your phone's data?

This talk will test the promise of privacy provided by these systems -- covering confidentiality, non-targetability, and verifiable transparency offered through TEEs, OHTTP and binary transparency logs.`
    }
  ]

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
          className={`theme-btn ${currentTheme === 'green' ? 'active' : ''}`}
          onClick={() => setCurrentTheme('green')}
          aria-label="Unifont green theme"
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
        {currentTheme === 'purple' ? (
          <h1 className="fancy-title">The Sprawl</h1>
        ) : (
          <pre className="ascii-art" data-text={asciiText}>
{asciiText}
          </pre>
        )}
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

          {/* Sprawl 0x5 Section */}
          <div className="event-details">
            <h2>-- Sprawl 0x5 --</h2>
            <div>June, 2026</div>
            {isRegistrationOpen ? (
              <a href="#" className="register-button" onClick={handleRegisterClick}>
                Register
              </a>
            ) : (
              <div className="register-countdown">
                {timeUntilUnlock && (
                  <div>
                    Registration opens in: {' '}
                    {timeUntilUnlock.days > 0 && `${timeUntilUnlock.days}d `}
                    {timeUntilUnlock.hours > 0 && `${timeUntilUnlock.hours}h `}
                    {timeUntilUnlock.minutes > 0 && `${timeUntilUnlock.minutes}m `}
                    {timeUntilUnlock.seconds}s
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="talks-container">
            {talks0x5.map(talk => (
              <div
                key={`0x5-${talk.id}`}
                className={`talk-box ${talk.id === 1 ? 'talk-box-with-stars' : ''} ${talk.id === 2 ? 'talk-box-with-matrix' : ''}`}
                onMouseEnter={() => setHoveredTalk(`0x5-${talk.id}`)}
                onMouseLeave={() => setHoveredTalk(null)}
              >
                {/* Stars animation for Talk 1 only - when collapsed */}
                {talk.id === 1 && !expandedTalks[`0x5-${talk.id}`] && (
                  <div className="stars-container" style={{ '--effect-opacity': (hoveredTalk === `0x5-${talk.id}` && !expandedTalks[`0x5-${talk.id}`]) ? 1.0 : Math.min(1.0, 0.5 + (effectIntensity - 1) * 0.071) }}>
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
                {talk.id === 2 && !expandedTalks[`0x5-${talk.id}`] && (
                  <div className="matrix-container" style={{ '--effect-opacity': (hoveredTalk === `0x5-${talk.id}` && !expandedTalks[`0x5-${talk.id}`]) ? 1.0 : Math.min(1.0, 0.5 + (effectIntensity - 1) * 0.071) }}>
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
                <div
                  className="talk-header"
                  onClick={() => toggleTalk(`0x5-${talk.id}`)}
                >
                  <span className="toggle-icon">
                    [ {expandedTalks[`0x5-${talk.id}`] ? '-' : '+'} ]
                  </span>
                  <div className="talk-info">
                    <div className="talk-title">Talk {talk.id}: {talk.title}</div>
                    <div className="talk-speaker">{talk.speaker}</div>
                  </div>
                </div>
                {expandedTalks[`0x5-${talk.id}`] && (
                  <div className="talk-description">
                    {talk.description.split('\n\n').map((paragraph, index) => (
                      <p key={index} style={{ marginBottom: '1em' }}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
                {/* Sprawl 0x4 */}
                <div className="event-details">
                  <h2>-- Sprawl 0x4 --</h2>
                  <div>April 2nd, 2026 @ Figma</div>
                </div>

                <div className="talks-container">
                  {talks0x4.map(talk => (
                    <div key={`0x4-${talk.id}`} className="talk-box">
                      <div
                        className="talk-header"
                        onClick={() => toggleTalk(`0x4-${talk.id}`)}
                      >
                        <span className="toggle-icon">
                          [ {expandedTalks[`0x4-${talk.id}`] ? '-' : '+'} ]
                        </span>
                        <div className="talk-info">
                          <div className="talk-title">Talk {talk.id}: {talk.title}</div>
                          <div className="talk-speaker">{talk.speaker}</div>
                        </div>
                      </div>
                      {expandedTalks[`0x4-${talk.id}`] && (
                        <div className="talk-description">
                          {talk.description.split('\n\n').map((paragraph, index) => {
                            if (paragraph.startsWith('__SLIDES__')) {
                              const url = paragraph.replace('__SLIDES__', '')
                              return (
                                <p key={index} style={{ marginBottom: '1em', color: 'fuchsia' }}>
                                  Link to Slides: <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'fuchsia' }}>{url}</a>
                                </p>
                              )
                            }
                            return (
                              <p key={index} style={{ marginBottom: '1em' }}>
                                {paragraph}
                              </p>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sprawl 0x3 */}
                <div className="event-details">
                  <h2>-- Sprawl 0x3 --</h2>
                  <div>February 5th, 2026 @ Spotify</div>
                </div>

                <div className="talks-container">
                  {talks0x3.map(talk => (
                    <div key={`0x3-${talk.id}`} className="talk-box">
                      <div
                        className="talk-header"
                        onClick={() => toggleTalk(`0x3-${talk.id}`)}
                      >
                        <span className="toggle-icon">
                          [ {expandedTalks[`0x3-${talk.id}`] ? '-' : '+'} ]
                        </span>
                        <div className="talk-info">
                          <div className="talk-title">Talk {talk.id}: {talk.title}</div>
                          <div className="talk-speaker">{talk.speaker}</div>
                        </div>
                      </div>
                      {expandedTalks[`0x3-${talk.id}`] && (
                        <div className="talk-description">
                          {talk.description.split('\n\n').map((paragraph, index) => (
                            <p key={index} style={{ marginBottom: '1em' }}>
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sprawl 0x2 */}
                <div className="event-details">
                  <h2>-- Sprawl 0x2 --</h2>
                  <div>December 2nd, 2025 @ DataDog</div>
                </div>

                <div className="talks-container">
                  {talks0x2.map(talk => (
                    <div key={`0x2-${talk.id}`} className="talk-box">
                      <div
                        className="talk-header"
                        onClick={() => toggleTalk(`0x2-${talk.id}`)}
                      >
                        <span className="toggle-icon">
                          [ {expandedTalks[`0x2-${talk.id}`] ? '-' : '+'} ]
                        </span>
                        <div className="talk-info">
                          <div className="talk-title">Talk {talk.id}: {talk.title}</div>
                          <div className="talk-speaker">{talk.speaker}</div>
                        </div>
                      </div>
                      {expandedTalks[`0x2-${talk.id}`] && (
                        <div className="talk-description">
                          {talk.description.split('\n\n').map((paragraph, index) => (
                            <p key={index} style={{ marginBottom: '1em' }}>
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sprawl 0x1 */}
                <div className="event-details">
                  <h2>-- Sprawl 0x1 --</h2>
                  <div>October 2nd, 2025 @ Oscar Health</div>
                </div>

                <div className="talks-container">
                  {talks0x1.map(talk => (
                    <div key={`0x1-${talk.id}`} className="talk-box">
                      <div
                        className="talk-header"
                        onClick={() => toggleTalk(`0x1-${talk.id}`)}
                      >
                        <span className="toggle-icon">
                          [ {expandedTalks[`0x1-${talk.id}`] ? '-' : '+'} ]
                        </span>
                        <div className="talk-info">
                          <div className="talk-title">Talk {talk.id}: {talk.title}</div>
                          <div className="talk-speaker">{talk.speaker}</div>
                        </div>
                      </div>
                      {expandedTalks[`0x1-${talk.id}`] && (
                        <div className="talk-description">
                          {talk.description.split('\n\n').map((paragraph, index) => (
                            <p key={index} style={{ marginBottom: '1em' }}>
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App


