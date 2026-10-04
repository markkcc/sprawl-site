// Every Sprawl event and its talks. All themes render from these.

// A talk's description is "TBD" until we have an abstract; the site shows "-" instead.
// A paragraph starting with __SLIDES__ becomes a link to the slides.
export const hasAbstract = talk => Boolean(talk.description) && talk.description !== 'TBD'
export const abstractParagraphs = talk => talk.description.split('\n\n').map(paragraph =>
  paragraph.startsWith('__SLIDES__') ? { slides: paragraph.replace('__SLIDES__', '') } : { text: paragraph })

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ordinal = day => day + (day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th')
// A date or venue that isn't set yet is written as '??', e.g. '2026-12-??'.
export const hasFullDate = event => /^\d{4}-\d{2}-\d{2}$/.test(event.date)
// "October 6th, 2026 @ Microsoft, co-sponsored by Crash Override", or "December ??, 2026 @ ??"
export function eventDetails({ date, venue }) {
  const [year, month, day] = date.split('-')
  const dayText = Number.isInteger(Number(day)) ? ordinal(Number(day)) : day
  return `${MONTHS[month - 1]} ${dayText}, ${year} @ ${venue}`
}

// Registration stays locked behind a countdown until registerOpens, and until there is a registerUrl to open.
export const isRegistrationOpen = (event, now) => Boolean(event.registerUrl) && now >= new Date(event.registerOpens)
// "29d 4h 12m 9s" until registration opens, or null once the countdown has run out.
export function registrationCountdown(event, now) {
  const seconds = Math.floor((new Date(event.registerOpens) - now) / 1000)
  if (seconds <= 0) return null
  const parts = [[Math.floor(seconds / 86400), 'd'], [Math.floor(seconds / 3600) % 24, 'h'], [Math.floor(seconds / 60) % 60, 'm']]
  return parts.filter(([value]) => value > 0).map(([value, unit]) => value + unit).concat(`${seconds % 60}s`).join(' ')
}

const talks0x7 = [
  {
    id: 1,
    title: "Stopping the Flood",
    speaker: "Alex Beaver",
    description: `Detection and Response teams are responsible for keeping the rest of the organization running during an incident. But what happens when the D&R infrastructure itself starts to fail?

In this talk, we will look at how alert floods can overwhelm SIEM, SOAR, enrichment, and case-management pipelines, and why queue saturation can turn a temporary spike in volume into a much longer outage. We will use queueing theory to understand what happens as arrival rates approach processing capacity, why operating near 100% utilization is dangerous, and how backlogs can continue to hurt response long after the original surge is over.

From there, we will look at practical ways to make D&R infrastructure more resilient: reducing unnecessary work, increasing and protecting processing capacity, isolating critical workloads, applying backpressure, shedding lower-value work, and degrading gracefully when dependencies fail. Finally, we will cover how to map your own D&R pipelines, identify weak links, and design them so that the alerts that matter most still get processed when the system is under pressure.`
  },
  {
    id: 2,
    title: "Facade - Google's last line of defense against insider threats",
    speaker: "Casper Neo",
    description: "Insider threat detection is a notoriously hard security problem. Our threat model assumes the attacker has employee credentials and is abusing their access to internal systems, using everyday tools. There is no malware or network intrusion to detect. This talk presents Facade, Google's last line of defense against insider threats. Facade considers employee access to document storage, data lake, and internal websites; and finds access events that were statically authorized, but unlikely to be business justified. In an espionage red team exercise, it ranked attackers in the top 10 most suspicious people of over 180,000 employees."
  }
]

const talks0x6 = [
  {
    id: 1,
    title: "Hunting in Your Pocket: AI-Augmented Mobile Threat Detection with PiRogue Tool Suite",
    speaker: "Tom Goodheart",
    description: "TBD"
  },
  {
    id: 2,
    title: "Agents in the Pressure Cooker: Agent Containment in the Face of Impossible Tasks",
    speaker: "Brendan Dolan-Gavitt",
    description: "__SLIDES__https://www.dropbox.com/scl/fi/dud5df6vtpo7gz827z2we/NYC_SPRAWL_AgentsTalk.pdf?rlkey=ln96q6lrlyo36fp62a14lahvq&st=baq2f2rp&dl=0"
  }
]

const talks0x5 = [
  {
    id: 1,
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

// The upcoming event; move it to the top of pastEvents once it has happened.
// eta is shown in place of a day countdown while the date is still '??'.
export const currentEvent = {
  id: '0x8',
  name: 'Sprawl 0x8',
  date: '2026-12-??',
  venue: '??',
  eta: '2 months',
  registerOpens: '2026-11-03T18:00:00-05:00',
  registerUrl: null,
  talks: []
}

// Newest first.
export const pastEvents = [
  { id: '0x7', name: 'Sprawl 0x7', date: '2026-10-06', venue: 'Microsoft, co-sponsored by Crash Override', talks: talks0x7 },
  { id: '0x6', name: 'Sprawl 0x6', date: '2026-08-18', venue: 'CLEAR', talks: talks0x6 },
  { id: '0x5', name: 'Sprawl 0x5', date: '2026-06-04', venue: 'Etsy', talks: talks0x5 },
  { id: '0x4', name: 'Sprawl 0x4', date: '2026-04-07', venue: 'Figma', talks: talks0x4 },
  { id: '0x3', name: 'Sprawl 0x3', date: '2026-02-05', venue: 'Spotify', talks: talks0x3 },
  { id: '0x2', name: 'Sprawl 0x2', date: '2025-12-02', venue: 'DataDog', talks: talks0x2 },
  { id: '0x1', name: 'Sprawl 0x1', date: '2025-10-02', venue: 'Oscar Health', talks: talks0x1 }
]
