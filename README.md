# The Sprawl 

[SPRAWL.NYC](https://sprawl.nyc/)

A non-corporate technical meetup run by a NYC hacker community.

3x 20-min talks by smart people we all like. 

Hosted every couple of months.

## Event visuals

The homepage opens with the SPRAWL challenge coin decoding at the top (a still frame for visitors who prefer reduced motion). Click the coin to reveal the **Launch event visuals** button, then click it for a fullscreen, silent preshow. Eleven scenes loop every 5 minutes: the SPRAWL challenge coin's circuit-traced Statue of Liberty rebuilt in glitching ASCII (generated into `src/libertyAscii.js`), rotating SPRAWL ASCII art, an ASCII New York skyline (Empire State, Chrysler, One World Trade and the Brooklyn Bridge) with neon signs and radio signals, a simulated Turbo Vision desktop, a subway network styled as a retro signal-tracking board, a terminal session, a Neuromancer-inspired wireframe city, a software-defined radio waterfall that paints the SPRAWL logo as spectrogram art, a neon ASCII pin tumbler lock that glitches with every set pin and explodes open, a circuit board whose UART boot log is decoded by a logic analyzer, and Conway's Game of Life with a Gosper glider gun beside the hacker emblem. The top banner shows today's date. Use the **left and right arrow keys** to jump between scenes. The top-right **Lock** button (or the **L** key) holds the current scene, looping it until you unlock it or press an arrow key. Press **Escape** or use the top-right exit button to return to the site.

The desktop runs its scripted menus and dialogs without a mouse pointer or click indicators. The seventh scene slowly scrolls an attributed, abridged passage from William Gibson's *Neuromancer* about BAMA, the Sprawl, with *Sprawl* and *Manhattan* highlighted.

The show uses local canvas graphics and the bundled font, and falls back to a full-window overlay if browser fullscreen is unavailable. Scene artwork and durations live in `src/eventShowRenderer.js`; fullscreen controls live in `src/EventShow.jsx`.

## Sprawl 0x1

**Date: October 2nd, 2025**

**Invite Link:** https://luma.com/zxlmzqg3 

### Talk 1: A Secret Talk about macOS Detection Engineering

Speaker: Olivia Gallucci

Description: This talk examines macOS telemetry sources (Unified Logging System, Endpoint Security, and TCC.db) and methods for extracting signals. It analyzes abuse of automation utilities in infostealers, highlighting common methods of persistence and credential-theft. Detection strategies focus on behavioral correlations, and how they can be visualized through open-source tooling.

### Talk 2: Your Apes May Be Gone, But the Hackers Made $9 Billion and They’re Still Here

Speaker: Andrew MacPherson

Description: Last year, crypto thefts hit $9.32 billion—more than half of all cybercrime losses. North Korea just pulled off a $1.5 billion heist from a single exchange. Meanwhile, most security professionals still think crypto is just magic internet money for buying NFT monkeys.

This talk is for the crypto-skeptical security professional who’s tired of hearing about “blockchain”. I’ll show you why crypto security is 90% the same Web2 skills you already have—phishing, social engineering, API abuse—just with irreversible consequences and way better attacker ROI.

We’ll start with a practical crypto primer covering the essentials: how blockchains work, what wallets actually do, and why stablecoins matter. Then we’ll dive into the current threat landscape: who’s stealing what, how OFAC sanctions work in a pseudonymous world, and why traditional threat intel is failing miserably at tracking crypto crime.

Most importantly, I’ll show you what makes crypto security uniquely interesting. You’re dealing with immutable code, irreversible transactions, and attackers monetary wins that can’t just be rolled or clawed back. The threat actors range from nation-states to teenage hackers, the attack surface spans everything from smart contract logic to social engineering, and the defensive tooling is still being invented.

Come for the massive heist stories, stay because you realize this is an unexplored frontier with its own unique problems. By the end, you’ll understand why crypto security attracts both sophisticated attackers and curious defenders—not for the hype, but because it’s a different kind of security challenge worth understanding.

Key Takeaways:

- Why crypto crimes now dominate cybercrime statistics
- How your existing security skills translate directly to Web3
- What makes crypto security different from traditional infosec
- Practical resources to explore this space without the hype

### Talk 3: Confidential To Compromised: A Deep Dive Into Private LLMs

Speaker: Aman Ali

Description: Private LLMs are emerging across the tech landscape, starting with Apple's PCC, then GCP/Azure's Confidential AI Cloud offerings, and Whatsapps Private Processing products. These systems promise a secure LLM you can verifiably send your most sensitive information to, and often draw parallels to e2ee messaging systems like Signal or WhatsApp. However, one end of this connection is always decrypted in a server somewhere and is subject to undetectable law enforcement, hackers and curious insiders. How far do the technologies underpinning these systems actually go, and what does it take to turn your upcoming AI confidant into a backdoor into your phone's data?

This talk will test the promise of privacy provided by these systems -- covering confidentiality, non-targetability, and verifiable transparency offered through TEEs, OHTTP and binary transparency logs.

