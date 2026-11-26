"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The app itself lives at `/` on the same deployment, so every primary call to action goes straight there.
const APP_URL = "/";

const HIGHLIGHTS = [
  { img: "/launch/memo.webp", title: "Hum it once.", body: "One tap records your voice over the beat." },
  { img: "/launch/lyrics.webp", title: "It writes it down.", body: "Every take is transcribed and timed to the line.", note: 1 },
  { img: "/launch/editor.webp", title: "Then it finds the song.", body: "Drop in a beat and LYRIQ maps the intro, the verses and the hook." },
  { img: "/launch/loop.webp", title: "Loop the hook. Fix the line.", body: "Keep the music playing while you rewrite." },
];

const CLOSER_LOOK = [
  {
    id: "record",
    label: "Record over the beat",
    body: "Tap once and sing. Your take records on top of the instrumental, already lined up with it.",
    img: "/launch/memo.webp",
  },
  {
    id: "timed",
    label: "Timed lyrics",
    body: "Tap a take to watch your words light up line by line, like a lyrics view for a song that does not exist yet.",
    img: "/launch/lyrics.webp",
  },
  {
    id: "sections",
    label: "Beat sections",
    body: "The instrumental splits into 8 and 16 bar blocks named Intro, Verse, Hook, Bridge and Outro, so you always know where you are.",
    img: "/launch/editor.webp",
  },
  {
    id: "takes",
    label: "Takes by section",
    body: "Takes are named after the part they belong to. C2 is your second chorus take. Step through them on one vocal lane.",
    img: "/launch/loop.webp",
  },
  {
    id: "rhymes",
    label: "Rhymes and undo",
    body: "Rhymes underline as you type, with no network needed. Undo covers every word and every edit to the structure.",
    img: "/launch/editor.webp",
  },
];

const TILES = [
  { stat: "1 tap", body: "From idea to recording. No menus in the way." },
  { stat: "Line by line", body: "Timing for every lyric in a take.", note: 1 },
  { stat: "8 · 16 bars", body: "Sections snap to the bar grid of your beat." },
  { stat: "0 accounts", body: "No sign-up, no download. Open it and write." },
  { stat: "On device", body: "Songs, takes and beats are saved in your browser.", note: 2 },
  { stat: "Free", body: "While LYRIQ is in beta." },
];

const COMPARE: { row: string; memos: boolean; lyriq: boolean }[] = [
  { row: "Record an idea", memos: true, lyriq: true },
  { row: "Record over your beat", memos: false, lyriq: true },
  { row: "Lyrics and takes in one place", memos: false, lyriq: true },
  { row: "Takes turned into timed lyrics", memos: false, lyriq: true },
  { row: "Beat split into sections", memos: false, lyriq: true },
  { row: "Loop one section while you write", memos: false, lyriq: true },
];

// A made-up but plausible song map for the sectioning visual. Colors are the LYRIQ section "finishes"
// from the design system (/mnt/project-files/design-system/lyriq-apple-style.md).
const SONG_MAP = [
  { name: "Intro", bars: 4, color: "#fb7185" },
  { name: "Verse", bars: 16, color: "#f59e0b" },
  { name: "Hook", bars: 8, color: "#38bdf8" },
  { name: "Verse", bars: 16, color: "#f59e0b" },
  { name: "Hook", bars: 8, color: "#38bdf8" },
  { name: "Bridge", bars: 8, color: "#a855f7" },
  { name: "Hook", bars: 8, color: "#38bdf8" },
  { name: "Outro", bars: 4, color: "#818cf8" },
];

function Note({ n }: { n: number }) {
  return (
    <sup className="lx-note">
      <a href={`#footnote-${n}`} aria-label={`Footnote ${n}`}>
        {n}
      </a>
    </sup>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    </svg>
  );
}
function Check({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-label="Yes" role="img">
      <circle cx="12" cy="12" r="11" fill="#1d1d1f" />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-label="No" role="img">
      <path d="M7 12h10" stroke="#86868b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Highlights() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const DURATION = 5000;

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[i] as HTMLElement | undefined;
    if (!slide) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft - (track.clientWidth - slide.clientWidth) / 2, behavior: "smooth" });
  }, []);

  // Which slide is centered, read from the scroll position so swiping and buttons agree.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      Array.from(track.children).forEach((c, i) => {
        const el = c as HTMLElement;
        const mid = el.offsetLeft - track.offsetLeft + el.clientWidth / 2;
        const d = Math.abs(mid - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setIndex(best);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // No auto-advance for people who asked for reduced motion; the dots still work.
    if (!playing || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => goTo((index + 1) % HIGHLIGHTS.length), DURATION);
    return () => window.clearTimeout(t);
  }, [playing, inView, index, goTo]);

  return (
    <section className="lx-highlights" id="highlights" aria-label="Highlights">
      <div className="lx-wrap">
        <h2 className="lx-section-head rv">Get the highlights.</h2>
      </div>
      <div className="lx-track" ref={trackRef}>
        {HIGHLIGHTS.map((h, i) => (
          <figure className={`lx-slide${i === index ? " is-active" : ""}`} key={h.title} aria-hidden={i !== index}>
            <figcaption className="lx-slide-caption">
              <strong>{h.title}</strong> {h.body}
              {h.note ? <Note n={h.note} /> : null}
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.img} alt="" className="lx-slide-phone" loading="lazy" />
          </figure>
        ))}
      </div>
      <div className="lx-controls">
        <div className="lx-dots" role="tablist" aria-label="Choose a highlight">
          {HIGHLIGHTS.map((h, i) => (
            <button
              key={h.title}
              role="tab"
              aria-selected={i === index}
              aria-label={h.title}
              className={`lx-dot${i === index ? " is-active" : ""}${i === index && playing && inView ? " is-running" : ""}`}
              style={{ ["--lx-dur" as string]: `${DURATION}ms` }}
              onClick={() => goTo(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <button className="lx-round" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause highlights" : "Play highlights"}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </section>
  );
}

function Film({ filmRef }: { filmRef: React.RefObject<HTMLVideoElement | null> }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Plays muted while on screen, like Apple's ambient product films. Sound is one tap away.
  useEffect(() => {
    const v = filmRef.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.5 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [filmRef]);

  return (
    <section className="lx-film" id="film" aria-label="The film">
      <div className="lx-wrap lx-center">
        <p className="lx-eyebrow rv">The film</p>
        <h2 className="lx-headline rv">
          Fifteen seconds.
          <br />
          <span className="lx-dim">One song.</span>
        </h2>
      </div>
      <div className="lx-film-frame rv">
        <video
          ref={filmRef}
          src="/launch/lyriq-film.mp4"
          poster="/launch/film-poster.jpg"
          playsInline
          muted={muted}
          loop
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          aria-label="LYRIQ launch film: hum an idea, watch it become timed lyrics, drop the beat, loop the hook."
        />
        <div className="lx-film-ui">
          <button
            className="lx-glass-pill"
            onClick={() => {
              const v = filmRef.current;
              if (!v) return;
              if (v.paused) v.play().catch(() => undefined);
              else v.pause();
            }}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
          <button className="lx-glass-pill" onClick={() => setMuted((m) => !m)}>
            <span>{muted ? "Sound on" : "Sound off"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function CloserLook() {
  const [active, setActive] = useState(0);
  return (
    <section className="lx-closer" id="features" aria-label="Take a closer look">
      <div className="lx-wrap">
        <h2 className="lx-section-head rv">Take a closer look.</h2>
        <div className="lx-closer-panel rv">
          <ul className="lx-closer-list">
            {CLOSER_LOOK.map((f, i) => (
              <li key={f.id}>
                <button
                  className={`lx-closer-pill${i === active ? " is-open" : ""}`}
                  aria-expanded={i === active}
                  onClick={() => setActive(i)}
                >
                  <span className="lx-plus" aria-hidden="true" />
                  <span className="lx-closer-text">
                    <strong>{f.label}</strong>
                    {i === active ? <span className="lx-closer-body"> {f.body}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="lx-closer-stage">
            {CLOSER_LOOK.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.id} src={f.img} alt="" className={i === active ? "is-on" : ""} loading="lazy" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SongMap() {
  const total = SONG_MAP.reduce((s, x) => s + x.bars, 0);
  // Deterministic "waveform" so the server and browser render the same bars.
  const bars = Array.from({ length: 96 }, (_, i) => {
    const pos = (i / 96) * total;
    let acc = 0;
    let sec = SONG_MAP[0];
    for (const s of SONG_MAP) {
      if (pos < acc + s.bars) {
        sec = s;
        break;
      }
      acc += s.bars;
    }
    const loud = sec.name === "Hook" ? 0.95 : sec.name === "Verse" ? 0.7 : sec.name === "Bridge" ? 0.55 : 0.35;
    const h = 0.25 + loud * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.61)));
    return { h: Math.min(1, h), color: sec.color };
  });
  return (
    <div className="lx-songmap rv" aria-hidden="true">
      <div className="lx-wave">
        {bars.map((b, i) => (
          <span key={i} style={{ height: `${Math.round(b.h * 100)}%`, background: b.color }} />
        ))}
        <i className="lx-playhead" />
      </div>
      <div className="lx-sections">
        {SONG_MAP.map((s, i) => (
          <div key={i} style={{ flex: s.bars }}>
            <b style={{ background: s.color }} />
            <span>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LaunchPage() {
  useReveal();
  const heroRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const [showLocalNav, setShowLocalNav] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const h = heroRef.current?.offsetHeight ?? 600;
      setShowLocalNav(window.scrollY > h * 0.55);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const watchFilm = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("film")?.scrollIntoView({ behavior: "smooth", block: "center" });
    const v = filmRef.current;
    if (v) {
      v.muted = false;
      v.currentTime = 0;
      v.play().catch(() => undefined);
    }
  };

  return (
    <>
      <a className="lx-skip" href="#main">
        Skip to content
      </a>

      {/* Global utility navigation */}
      <header className="lx-gnav">
        <div className="lx-gnav-inner">
          <a href="#top" className="lx-logo" aria-label="LYRIQ home">
            LYRIQ
          </a>
          <nav aria-label="Global">
            <a href="#highlights">Highlights</a>
            <a href="#film" onClick={watchFilm}>
              Film
            </a>
            <a href="#features">Features</a>
            <a href="#sections">Beat sections</a>
            <a href="#compare">Compare</a>
          </nav>
          <a href={APP_URL} className="lx-gnav-open">
            Open app
          </a>
        </div>
      </header>

      {/* Announcement strip */}
      <div className="lx-strip">
        LYRIQ is live as a free beta.<span className="lx-strip-extra"> No sign-up, nothing to install.</span>{" "}
        <a href={APP_URL}>Try it on your phone&nbsp;›</a>
      </div>

      {/* Sticky local product navigation */}
      <div className={`lx-lnav${showLocalNav ? " is-shown" : ""}`} aria-hidden={!showLocalNav}>
        <div className="lx-lnav-bar">
          <span className="lx-lnav-name">LYRIQ</span>
          <nav aria-label="Page sections">
            <a href="#highlights" tabIndex={showLocalNav ? 0 : -1}>Overview</a>
            <a href="#features" tabIndex={showLocalNav ? 0 : -1}>Features</a>
            <a href="#compare" tabIndex={showLocalNav ? 0 : -1}>Compare</a>
          </nav>
          <div className="lx-lnav-actions">
            <a href="#film" className="lx-outline-pill" onClick={watchFilm} tabIndex={showLocalNav ? 0 : -1}>
              Watch the film
            </a>
            <a href={APP_URL} className="lx-blue-pill" tabIndex={showLocalNav ? 0 : -1}>
              Try it
            </a>
          </div>
        </div>
      </div>

      <main id="main">
        {/* Hero product stage */}
        <section className="lx-hero" id="top" ref={heroRef}>
          <div className="lx-hero-art">
            <h1 className="lx-wordmark" aria-label="LYRIQ">
              LYRIQ
            </h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/launch/editor.webp" alt="The LYRIQ editor on a phone: lyrics in Verse and Hook sections above a vocal take and the beat." className="lx-hero-phone" />
          </div>
          <div className="lx-hero-foot">
            <div className="lx-hero-copy">
              <p className="lx-hero-name">LYRIQ</p>
              <p className="lx-display">Write further.</p>
            </div>
            <div className="lx-buy">
              <p className="lx-capsule">
                Free in beta.
                <br />
                No account. No download.
              </p>
              <a href={APP_URL} className="lx-blue-pill lx-blue-pill--lg">
                Try LYRIQ free
              </a>
            </div>
          </div>
        </section>

        <Highlights />

        {/* Statement */}
        <section className="lx-statement">
          <div className="lx-wrap">
            <p className="lx-eyebrow rv">Why LYRIQ</p>
            <h2 className="lx-headline rv">
              Songs, not memos.
              <br />
              <span className="lx-dim">Songs, not notes.</span>
            </h2>
            <p className="lx-lede rv">
              Your best idea is sitting in <strong>New Recording 465</strong>, and the words are in a note called{" "}
              <strong>hook??</strong>. LYRIQ keeps <strong>the voice, the words and the beat</strong> in one place, so the idea
              becomes a song instead of another memo.
            </p>
          </div>
        </section>

        <Film filmRef={filmRef} />

        <CloserLook />

        {/* Beat sectioning spotlight */}
        <section className="lx-spotlight" id="sections">
          <div className="lx-wrap lx-center">
            <p className="lx-eyebrow rv">Beat sectioning</p>
            <h2 className="lx-headline rv">
              The beat knows
              <br />
              <span className="lx-dim">its own shape.</span>
            </h2>
          </div>
          <div className="lx-wrap">
            <SongMap />
            <div className="lx-twocol">
              <p className="lx-body rv">
                LYRIQ listens for <strong>the kick and the 808</strong> to find beat one, then lines every section up to the bar.
                Intro, Verse, Hook, Bridge and Outro are named from how full the arrangement gets.
              </p>
              <p className="lx-body rv">
                It all runs <strong>right in your browser</strong>, in the background, while you write. Tap a section to hear it,
                or loop it until the line lands.
              </p>
            </div>
          </div>
        </section>

        {/* Feature metric tiles */}
        <section className="lx-tiles-section">
          <div className="lx-wrap">
            <div className="lx-tiles-panel rv">
              <h2 className="lx-panel-head">
                Small details.
                <br />
                <span className="lx-dim">Big difference.</span>
              </h2>
              <div className="lx-tiles">
                {TILES.map((t) => (
                  <div className="lx-tile" key={t.stat}>
                    <p className="lx-stat">{t.stat}</p>
                    <p className="lx-tile-body">
                      {t.body}
                      {t.note ? <Note n={t.note} /> : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pale comparison surface */}
        <section className="lx-compare" id="compare">
          <div className="lx-wrap">
            <h2 className="lx-compare-head rv">
              Voice Memos and Notes
              <br />
              were never meant to write songs.
            </h2>
            <div className="lx-compare-card rv">
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="lx-sr">Feature</span>
                    </th>
                    <th scope="col">Voice Memos + Notes</th>
                    <th scope="col">LYRIQ</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.row}>
                      <th scope="row">{r.row}</th>
                      <td>
                        <Check on={r.memos} />
                      </td>
                      <td>
                        <Check on={r.lyriq} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <a href={APP_URL} className="lx-cobalt">
                Try LYRIQ free&nbsp;›
              </a>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="lx-final">
          <div className="lx-wrap lx-center">
            <p className="lx-new rv">New · Beta</p>
            <h2 className="lx-display lx-display--center rv">Songs, not notes.</h2>
            <p className="lx-lede lx-lede--center rv">Open it on your phone and write the first line tonight.</p>
            <div className="lx-final-actions rv">
              <a href={APP_URL} className="lx-blue-pill lx-blue-pill--lg">
                Try LYRIQ free
              </a>
              <a href="#film" className="lx-link" onClick={watchFilm}>
                Watch the film&nbsp;›
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lx-footer">
        <div className="lx-wrap">
          <ol className="lx-footnotes">
            <li id="footnote-1">
              To transcribe a take, LYRIQ sends that take&apos;s audio to our server, which uses Groq&apos;s Whisper model to turn it
              into timed lines. Takes longer than about two minutes cannot be transcribed yet.
            </li>
            <li id="footnote-2">
              Songs, takes and beats are stored in this browser on this device. Clearing your browser&apos;s site data removes them.
              There is no cloud sync yet.
            </li>
          </ol>
          <p>Built for phones. Use the latest Safari or Chrome. Your microphone is used only while you record.</p>
          <div className="lx-footer-bottom">
            <span>Copyright © 2026 LYRIQ. All rights reserved.</span>
            <a href={APP_URL}>Open the app</a>
          </div>
        </div>
      </footer>
    </>
  );
}
