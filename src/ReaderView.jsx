import { Fragment } from 'react'
import { hasAbstract, abstractParagraphs, eventDetails } from './events.js'
import './ReaderView.css'

// Plain, table-based page for the reader theme.
export default function ReaderView({ currentEvent, pastEvents, registerUrl, expandedTalks, toggleTalk }) {
  function talkRows(event) {
    return event.talks.map(talk => {
      const key = `${event.id}-${talk.id}`
      const expanded = hasAbstract(talk) && expandedTalks[key]
      return (
        <Fragment key={key}>
          <tr>
            <td>{talk.title}</td>
            <td>{talk.speaker}</td>
            <td className="reader-abstract-cell">
              {hasAbstract(talk) ? (
                <button
                  type="button"
                  className="reader-toggle"
                  onClick={() => toggleTalk(key)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Hide' : 'Show'} abstract for ${talk.title}`}
                >
                  [{expanded ? '-' : '+'}]
                </button>
              ) : '-'}
            </td>
          </tr>
          {expanded && (
            <tr className="reader-abstract">
              <td colSpan={3}>
                {abstractParagraphs(talk).map(({ text, slides }, index) => slides
                  ? <p key={index}>Slides: <a href={slides} target="_blank" rel="noopener noreferrer">{slides}</a></p>
                  : <p key={index}>{text}</p>)}
              </td>
            </tr>
          )}
        </Fragment>
      )
    })
  }

  // Fixed column widths, so opening an abstract never reflows the table.
  const head = (<>
    <colgroup>
      <col />
      <col className="reader-col-speaker" />
      <col className="reader-col-abstract" />
    </colgroup>
    <thead>
      <tr>
        <th scope="col">Talk</th>
        <th scope="col">Speaker</th>
        <th scope="col">Abstract</th>
      </tr>
    </thead>
  </>)

  return (
    <main className="reader">
      <h1>The Sprawl</h1>
      <p>
        NYC &middot; cybersecurity &middot; 2026<br />
        A non-corporate technical meetup run by a NYC hacker community.
        20-min talks by smart people we all like. Hosted every two months.
      </p>

      <h2>{currentEvent.name}</h2>
      <p>
        {eventDetails(currentEvent)}.{' '}
        <a href={registerUrl} target="_blank" rel="noopener noreferrer">Register</a>
      </p>
      <table>
        {head}
        <tbody>{talkRows(currentEvent)}</tbody>
      </table>

      <h2>Older Events</h2>
      <table>
        {head}
        {pastEvents.map(event => (
          <tbody key={event.id}>
            <tr>
              <th scope="rowgroup" colSpan={3} className="reader-event">
                {event.name} &mdash; {eventDetails(event)}
              </th>
            </tr>
            {talkRows(event)}
          </tbody>
        ))}
      </table>
    </main>
  )
}
