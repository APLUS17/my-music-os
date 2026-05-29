"use client";

import { useState, useEffect } from "react";
import {
  BarChart2, Users, Zap, MessageSquare, Rocket, DollarSign,
  Map, Calendar, FileText, Heart, TrendingUp, RefreshCw,
  Link2, Target, StickyNote, Package, LayoutGrid,
  GitBranch, Clock, Plus, Eye, EyeOff, ArrowLeft, ChevronRight,
  Database, Info, Check, Play, Pause, Trash2
} from "lucide-react";

const CC: Record<string, string> = { Strategy: "#818cf8", Growth: "#f472b6", Product: "#34d399", Business: "#fb923c" };
const CATS = ["Strategy", "Growth", "Product", "Business"];

const WS = [
  {
    id: "mkt", icon: BarChart2, label: "Market Validation", cat: "Strategy", phase: "Foundation", desc: "Confirm real demand exists before committing any resources.",
    items: [
      { id: "mv1", hi: true, text: "Interview 20+ aspiring songwriters on their #1 unfinished-song pain" },
      { id: "mv2", hi: true, text: "Run a fake paywall or pre-order page to validate willingness-to-pay" },
      { id: "mv3", hi: false, text: "Mine App Store reviews of competitors for unmet needs" },
      { id: "mv4", hi: false, text: "Size the TAM: songwriting app market and CAGR from a credible source" },
      { id: "mv5", hi: true, text: "Collect 5+ verbatim quotes from users describing their exact pain" }
    ]
  },
  {
    id: "icp", icon: Users, label: "Ideal Customer Profile", cat: "Strategy", phase: "Foundation", desc: "Build a laser-focused picture of exactly who you are building for.",
    items: [
      { id: "ic1", hi: true, text: "Write a 1-paragraph narrative persona for your primary ICP" },
      { id: "ic2", hi: true, text: "Map the exact trigger moment they reach for LYRIQ" },
      { id: "ic3", hi: false, text: "List 5 communities and platforms where this person hangs out" },
      { id: "ic4", hi: false, text: "Identify their current workaround and its hidden cost" },
      { id: "ic5", hi: true, text: "Determine the upgrade trigger: the moment they agree to pay" }
    ]
  },
  {
    id: "psf", icon: Zap, label: "Problem / Solution Fit", cat: "Strategy", phase: "Foundation", desc: "Nail the core value exchange and prove it resonates.",
    items: [
      { id: "ps1", hi: true, text: "Write a single-sentence problem statement users confirm is true" },
      { id: "ps2", hi: true, text: "Define the one transformational outcome LYRIQ delivers" },
      { id: "ps3", hi: false, text: "Test 3 different value prop framings with 10 users each" },
      { id: "ps4", hi: true, text: "Identify the aha moment: earliest point users feel the value" },
      { id: "ps5", hi: false, text: "Document 3 biggest objections and a killer response to each" }
    ]
  },
  {
    id: "pos", icon: MessageSquare, label: "Positioning & Messaging", cat: "Strategy", phase: "Foundation", desc: "Own a clear, memorable narrative in a crowded market.",
    items: [
      { id: "po1", hi: true, text: "Write the positioning statement for LYRIQ" },
      { id: "po2", hi: false, text: "Choose 3 messaging pillars and 2 proof points per pillar" },
      { id: "po3", hi: true, text: "Draft 5 tagline candidates and test with 20 people" },
      { id: "po4", hi: false, text: "Rewrite homepage hero copy using the winning positioning" },
      { id: "po5", hi: false, text: "Create a messaging matrix: audience x channel x key message" }
    ]
  },
  {
    id: "gtm", icon: Rocket, label: "Go-To-Market Strategy", cat: "Growth", phase: "Launch", desc: "Plan the full launch attack: channels, timing, sequencing.",
    items: [
      { id: "gt1", hi: true, text: "Choose primary GTM motion: PLG vs community-led vs content-led" },
      { id: "gt2", hi: true, text: "Pick 2 owned launch channels and commit to them fully" },
      { id: "gt3", hi: false, text: "Map the 30/60/90-day GTM timeline with milestones per week" },
      { id: "gt4", hi: true, text: "Build a pre-launch waitlist with a hard target of 500 signups" },
      { id: "gt5", hi: false, text: "Identify 10 micro-influencers in the songwriter and producer niche" }
    ]
  },
  {
    id: "lseq", icon: Calendar, label: "Launch Sequence", cat: "Growth", phase: "Launch", desc: "Day-by-day playbook from T-30 to launch day and beyond.",
    items: [
      { id: "ls1", hi: true, text: "Write a T-30 to T-0 countdown with 1 concrete action per day" },
      { id: "ls2", hi: true, text: "Prepare 5 launch-day posts across TikTok, Twitter, Reddit, Instagram" },
      { id: "ls3", hi: false, text: "Line up 10 allies to upvote and share on ProductHunt launch day" },
      { id: "ls4", hi: true, text: "Draft the launch email: hook, demo GIF, single CTA" },
      { id: "ls5", hi: false, text: "Set up a war-room channel for real-time launch day feedback" }
    ]
  },
  {
    id: "seo", icon: FileText, label: "Content & SEO", cat: "Growth", phase: "Scale", desc: "Build an organic discovery engine that compounds over time.",
    items: [
      { id: "se1", hi: true, text: "Identify 10 high-intent keywords for songwriting and lyric writing" },
      { id: "se2", hi: true, text: "Publish 3 pillar articles targeting the top keywords" },
      { id: "se3", hi: false, text: "Build a TikTok content calendar: 30 posts over 30 days" },
      { id: "se4", hi: false, text: "Launch a YouTube Shorts series: 1 Song 1 Minute across 10 episodes" },
      { id: "se5", hi: false, text: "Start a weekly songwriter newsletter: 500 words, 1 actionable tip" }
    ]
  },
  {
    id: "com", icon: Heart, label: "Community Building", cat: "Growth", phase: "Launch", desc: "Build your tribe before you ship. Turn early users into evangelists.",
    items: [
      { id: "cb1", hi: false, text: "Join 5 active songwriter subreddits and add value before promoting" },
      { id: "cb2", hi: true, text: "Launch a LYRIQ Beta Writers Discord with structured onboarding" },
      { id: "cb3", hi: false, text: "Run a 30-day song challenge campaign on TikTok and Instagram" },
      { id: "cb4", hi: true, text: "Create a Founding 100 program with lifetime deal perks" },
      { id: "cb5", hi: false, text: "Feature 1 user song story per week across all channels" }
    ]
  },
  {
    id: "paid", icon: TrendingUp, label: "Paid Acquisition", cat: "Growth", phase: "Scale", desc: "Scale what is working with disciplined paid spend.",
    items: [
      { id: "pa1", hi: true, text: "Set a $500 test budget and define success as CPI under $3" },
      { id: "pa2", hi: true, text: "Create 5 TikTok Spark Ads from top-performing organic posts" },
      { id: "pa3", hi: false, text: "Run a Meta App Install campaign targeting songwriting interests" },
      { id: "pa4", hi: true, text: "A/B test 3 creative angles: problem hook vs demo vs testimonial" },
      { id: "pa5", hi: false, text: "Build a retargeting funnel for App Store visitors who did not install" }
    ]
  },
  {
    id: "road", icon: Map, label: "Product Roadmap", cat: "Product", phase: "Foundation", desc: "Sequence what you build. Ruthlessly prioritize signal over noise.",
    items: [
      { id: "pr1", hi: true, text: "Score every feature on User Value x Business Impact divided by Effort" },
      { id: "pr2", hi: true, text: "Define the MVP: smallest version that delivers the core value promise" },
      { id: "pr3", hi: false, text: "Create a 90-day roadmap using Now, Next, and Later buckets" },
      { id: "pr4", hi: true, text: "Identify 3 moat features that competitors cannot easily copy" },
      { id: "pr5", hi: false, text: "Set a feature freeze date 2 weeks before launch" }
    ]
  },
  {
    id: "onb", icon: Package, label: "Onboarding & UX", cat: "Product", phase: "Foundation", desc: "Get every user to their aha moment in under 5 minutes.",
    items: [
      { id: "ob1", hi: true, text: "Map the onboarding flow step-by-step and flag every friction point" },
      { id: "ob2", hi: true, text: "Redesign the flow to reach the aha moment in 3 taps or fewer" },
      { id: "ob3", hi: false, text: "Write microcopy for every empty state, error screen, and loading moment" },
      { id: "ob4", hi: true, text: "Run 5 usability tests with screen recording" },
      { id: "ob5", hi: false, text: "Build a first song in 5 minutes quick-start template for new users" }
    ]
  },
  {
    id: "ret", icon: RefreshCw, label: "Retention & Engagement", cat: "Product", phase: "Scale", desc: "Keep users coming back. Retention is the product.",
    items: [
      { id: "re1", hi: true, text: "Define Day 1, Day 7, and Day 30 retention rate targets" },
      { id: "re2", hi: true, text: "Build a push notification sequence for days 1 through 14 post-install" },
      { id: "re3", hi: false, text: "Design a streak mechanic rewarding consecutive days of writing" },
      { id: "re4", hi: false, text: "Build a song completion celebration moment" },
      { id: "re5", hi: true, text: "Set up a Day 7 win-back email for users who have not returned" }
    ]
  },
  {
    id: "prc", icon: DollarSign, label: "Pricing & Monetization", cat: "Business", phase: "Foundation", desc: "Build sustainable revenue logic that grows with your value.",
    items: [
      { id: "pm1", hi: true, text: "Test freemium vs free-trial model with 10 qualitative interviews" },
      { id: "pm2", hi: true, text: "Identify the in-app upgrade trigger: when are users most likely to pay" },
      { id: "pm3", hi: false, text: "Price-test 3 anchors: $6.99, $9.99, and $14.99 per month" },
      { id: "pm4", hi: false, text: "Design the annual plan discount targeting 40 to 50 percent savings" },
      { id: "pm5", hi: true, text: "Write paywall copy: headline, 3 benefit bullets, CTA, and guarantee" }
    ]
  },
  {
    id: "part", icon: Link2, label: "Partnerships & Distribution", cat: "Business", phase: "Scale", desc: "Leverage other audiences to grow faster than organic alone.",
    items: [
      { id: "pd1", hi: false, text: "List 10 producer tools that could integrate or co-promote with LYRIQ" },
      { id: "pd2", hi: true, text: "Reach out to 5 songwriting educators for affiliate deals" },
      { id: "pd3", hi: false, text: "Explore music school partnerships for student licensing" },
      { id: "pd4", hi: true, text: "Pitch Splice or BeatStars for a co-marketing collab" },
      { id: "pd5", hi: false, text: "Apply to Apple Apps We Love and Google Play editorial programs" }
    ]
  },
  {
    id: "kpi", icon: Target, label: "Success Metrics & KPIs", cat: "Business", phase: "Foundation", desc: "Define what winning looks like before you start the clock.",
    items: [
      { id: "km1", hi: true, text: "Set the North Star Metric for LYRIQ" },
      { id: "km2", hi: true, text: "Define 5 supporting KPIs for the first 90 days" },
      { id: "km3", hi: false, text: "Build a simple metrics dashboard in Mixpanel or Google Sheets" },
      { id: "km4", hi: false, text: "Schedule a weekly 30-minute metrics review every Monday" },
      { id: "km5", hi: true, text: "Write the kill switch criteria: when to pivot vs persist" }
    ]
  },
];

const RM_DATA = [
  {
    id: "mvp", label: "MVP", version: "v0.1", color: "#818cf8", status: "active", desc: "Smallest version that proves the core loop: voice idea to structured song.",
    items: [
      { id: "r1", text: "Voice memo recording with tap-to-capture" },
      { id: "r2", text: "Basic lyric editor with verse, chorus, and bridge sections" },
      { id: "r3", text: "5 core song structure templates" },
      { id: "r4", text: "Basic AI lyric completion" },
      { id: "r5", text: "Local project storage" },
      { id: "r6", text: "iOS app on TestFlight" }
    ]
  },
  {
    id: "beta", label: "Beta", version: "v0.5", color: "#f472b6", status: "upcoming", desc: "First 100 real users. Focus on retention and word-of-mouth.",
    items: [
      { id: "b1", text: "3-step onboarding quick-start flow" },
      { id: "b2", text: "Rhyme finder and thesaurus" },
      { id: "b3", text: "Cloud sync across devices" },
      { id: "b4", text: "Push notifications for writing streaks" },
      { id: "b5", text: "Android app on Play Store beta" }
    ]
  },
  {
    id: "v1", label: "V1.0 Launch", version: "v1.0", color: "#34d399", status: "upcoming", desc: "Public launch. Monetization live. App Store fully optimized.",
    items: [
      { id: "v1a", text: "Paywall and subscription billing via RevenueCat" },
      { id: "v1b", text: "App Store screenshots and preview video" },
      { id: "v1c", text: "Share song and export to PDF" },
      { id: "v1d", text: "Improved AI with better context awareness" },
      { id: "v1e", text: "Rating prompt at first song completion" }
    ]
  },
  {
    id: "v15", label: "V1.5 Growth", version: "v1.5", color: "#fb923c", status: "future", desc: "Post-launch growth features driven by real user feedback.",
    items: [
      { id: "g1", text: "Co-writer collaboration and song sharing" },
      { id: "g2", text: "Song history and version control" },
      { id: "g3", text: "Genre-specific templates: Pop, R&B, Country, Hip-Hop" },
      { id: "g4", text: "Community feed with opt-in song sharing" }
    ]
  },
];

const SEED_LOG = [
  { id: "c1", version: "v0.0.1", date: "Jan 2025", tag: "milestone", text: "Project kickoff. Core concept validated through 10 songwriter interviews." },
  { id: "c2", version: "v0.0.2", date: "Feb 2025", tag: "product", text: "Wireframes complete. User flow mapped from voice memo to finished song." },
  { id: "c3", version: "v0.0.3", date: "Mar 2025", tag: "strategy", text: "Positioning locked: LYRIQ for aspiring songwriters who never finish songs." },
];

const TAG_C: Record<string, string> = { milestone: "#818cf8", product: "#34d399", strategy: "#f472b6", growth: "#fb923c" };
const STATUS_C: Record<string, string> = { active: "#34d399", upcoming: "#818cf8", future: "#52525b" };

function initWs() {
  const s: Record<string, Record<string, { checked: boolean; note: string; open: boolean }>> = {};
  WS.forEach(ws => {
    s[ws.id] = {};
    ws.items.forEach(it => {
      s[ws.id][it.id] = { checked: false, note: "", open: false };
    });
  });
  return s;
}

function initRm() {
  const s: Record<string, Record<string, { checked: boolean }>> = {};
  RM_DATA.forEach(m => {
    s[m.id] = {};
    m.items.forEach(it => {
      s[m.id][it.id] = { checked: false };
    });
  });
  return s;
}

interface RingProps {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
}

function Ring({ pct, size = 40, stroke = 3, color = "#818cf8" }: RingProps) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }} />
    </svg>
  );
}

const inp = {
  background: "#0d0d0f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "#d4d4d8",
  fontSize: 14,
  padding: "9px 11px",
  outline: "none",
  fontFamily: "Inter,system-ui,sans-serif",
  width: "100%",
  boxSizing: "border-box" as const
};

export default function MissionControl() {
  const [wsState, setWsState] = useState(initWs);
  const [rmState, setRmState] = useState(initRm);
  const [log, setLog] = useState(SEED_LOG);
  const [view, setView] = useState("home");
  const [hideDone, setHideDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newLog, setNewLog] = useState({ version: "", date: "", tag: "product", text: "" });
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1024);

  // Notion Sync States
  const [notionData, setNotionData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "fallback" | "error">("fallback");
  const [syncMessage, setSyncMessage] = useState("");

  const fetchDashboardData = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/mission-control-sync');
      if (!response.ok) throw new Error('Failed to retrieve control center updates.');
      const data = await response.json();
      
      setNotionData(data);
      if (data.synced) {
        setSyncStatus("synced");
        setSyncMessage("Live sync with Notion active");
      } else {
        setSyncStatus("fallback");
        setSyncMessage(data.message || "Notion variables not configured in .env.local; using seed data.");
      }
    } catch (err: any) {
      setSyncStatus("error");
      setSyncMessage(err.message || "Failed to load telemetry.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const mob = w < 700;

  const twCheck = (wId: string, iId: string) => setWsState(p => ({ ...p, [wId]: { ...p[wId], [iId]: { ...p[wId][iId], checked: !p[wId][iId].checked } } }));
  const twNote = (wId: string, iId: string) => setWsState(p => ({ ...p, [wId]: { ...p[wId], [iId]: { ...p[wId][iId], open: !p[wId][iId].open } } }));
  const stNote = (wId: string, iId: string, v: string) => setWsState(p => ({ ...p, [wId]: { ...p[wId], [iId]: { ...p[wId][iId], note: v } } }));
  const trCheck = (mId: string, iId: string) => setRmState(p => ({ ...p, [mId]: { ...p[mId], [iId]: { checked: !p[mId][iId].checked } } }));

  // Helper functions that resolve to Notion data if present, else fallback to checked boxes
  const wsPct = (id: string) => {
    const ws = WS.find(w => w.id === id);
    if (!ws) return { done: 0, total: 0, pct: 0 };
    const done = ws.items.filter(it => wsState[id]?.[it.id]?.checked).length;
    const localPct = Math.round((done / ws.items.length) * 100);

    const notionWs = notionData?.workstreams?.find((w: any) => w.id === id);
    const pct = notionWs ? notionWs.progress : localPct;

    return { done, total: ws.items.length, pct };
  };

  const rmPct = (id: string) => {
    const m = RM_DATA.find(x => x.id === id);
    if (!m) return { done: 0, total: 0, pct: 0 };
    const done = m.items.filter(it => rmState[id]?.[it.id]?.checked).length;
    const localPct = Math.round((done / m.items.length) * 100);

    const notionRm = notionData?.roadmap?.find((r: any) => r.id === id);
    const pct = notionRm ? (notionRm.status === "released" || notionRm.status === "complete" ? 100 : localPct) : localPct;

    return { done, total: m.items.length, pct };
  };

  const totalItems = WS.reduce((a, ws) => a + ws.items.length, 0);
  const totalDone = WS.reduce((a, ws) => a + ws.items.filter(it => wsState[ws.id]?.[it.id]?.checked).length, 0);
  
  // Calculate global percentage based on either Notion values (if synced) or local checkmarks
  const globalPct = (() => {
    if (notionData?.synced && notionData?.workstreams) {
      const sum = notionData.workstreams.reduce((acc: number, item: any) => acc + (item.progress || 0), 0);
      return Math.round(sum / notionData.workstreams.length);
    }
    return Math.round((totalDone / totalItems) * 100);
  })();

  const rl = globalPct < 20 ? "Not Started" : globalPct < 50 ? "In Progress" : globalPct < 80 ? "Building" : globalPct < 100 ? "Almost Ready" : "LAUNCH READY";
  const rc = globalPct < 20 ? "#52525b" : globalPct < 50 ? "#818cf8" : globalPct < 80 ? "#f472b6" : globalPct < 100 ? "#fb923c" : "#34d399";

  const grouped = CATS.map(cat => ({ cat, color: CC[cat], items: WS.filter(w => w.cat === cat) }));
  const aw = WS.find(w => w.id === view);

  const addLog = () => {
    if (!newLog.text.trim()) return;
    setLog(p => [{ id: "c" + Date.now(), ...newLog, date: newLog.date || "Now" }, ...p]);
    setNewLog({ version: "", date: "", tag: "product", text: "" });
    setShowForm(false);
  };

  const displayLog = notionData?.changelog || log;

  // ── OVERVIEW ────────────────────────────────────────────────
  const Overview = () => (
    <div className="animate-in fade-in duration-300">
      <div style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: mob ? "16px" : "22px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: "#52525b", fontWeight: 600, marginBottom: 10 }}>Launch Readiness</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: mob ? 30 : 38, fontWeight: 700, letterSpacing: "-1.5px", color: rc, lineHeight: 1 }}>{globalPct}%</div>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 3 }}>{rl} &mdash; {totalDone}/{totalItems} tasks local</div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ height: 5, background: "#27272a", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${globalPct}%`, height: "100%", background: "linear-gradient(90deg,#818cf8,#f472b6,#fb923c)", borderRadius: 99, transition: "width 0.4s" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {CATS.map(cat => {
                const wc = WS.filter(w => w.cat === cat);
                const d = wc.reduce((acc, ws) => acc + ws.items.filter(it => wsState[ws.id]?.[it.id]?.checked).length, 0);
                const t = wc.reduce((acc, ws) => acc + ws.items.length, 0);
                
                // Notion Category Progress
                const notionWc = notionData?.workstreams?.filter((item: any) => item.category === cat);
                const p = notionWc && notionWc.length > 0 
                  ? Math.round(notionWc.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / notionWc.length)
                  : Math.round((d / t) * 100);

                return (
                  <div key={cat} style={{ flex: 1, background: "#111113", border: `1px solid ${CC[cat]}22`, borderRadius: 7, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: CC[cat] }}>{p}%</div>
                    <div style={{ height: 2, background: "#27272a", borderRadius: 99, margin: "4px 0 3px" }}><div style={{ width: `${p}%`, height: "100%", background: CC[cat], borderRadius: 99, opacity: 0.7 }} /></div>
                    <div style={{ fontSize: 9, color: "#52525b", letterSpacing: "0.3px" }}>{cat}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: "#52525b", fontWeight: 600, marginBottom: 8 }}>Workstreams</div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {WS.map(ws => {
          const { pct, done, total } = wsPct(ws.id); const WI = ws.icon; const c = CC[ws.cat];
          const notionWs = notionData?.workstreams?.find((w: any) => w.id === ws.id);
          const currentStatus = notionWs ? notionWs.status : ws.phase;
          return (
            <button key={ws.id} onClick={() => setView(ws.id)}
              style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px", cursor: pointerOption, textAlign: "left", display: "flex", flexDirection: "column", gap: 7, minHeight: mob ? 80 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyItems: "space-between", justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}><WI size={12} color={c} style={{ flexShrink: 0 }} /><span style={{ fontSize: 11.5, fontWeight: 500, color: "#d4d4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: mob ? 80 : 110 }}>{ws.label}</span></div>
                <Ring pct={pct} size={24} stroke={2.5} color={c} />
              </div>
              <div style={{ height: 2, background: "#27272a", borderRadius: 99 }}><div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 99, opacity: 0.65, transition: "width 0.3s" }} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#52525b" }}>{done}/{total}</span>
                <span style={{ fontSize: 9, color: c, background: `${c}14`, padding: "2px 6px", borderRadius: 99 }}>{currentStatus}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[{ id: "roadmap", label: "Roadmap", icon: <GitBranch size={14} />, color: "#818cf8" }, { id: "changelog", label: "Changelog", icon: <Clock size={14} />, color: "#f472b6" }].map(x => (
          <button key={x.id} onClick={() => setView(x.id)}
            style={{ background: "#18181b", border: `1px solid ${x.color}22`, borderRadius: 10, padding: "14px 16px", cursor: pointerOption, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: x.color }}>{x.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#d4d4d8" }}>{x.label}</span>
            <ChevronRight size={13} color="#52525b" style={{ marginLeft: "auto" }} />
          </button>
        ))}
      </div>
    </div>
  );

  const pointerOption = "pointer" as const;

  // ── WORKSTREAM ───────────────────────────────────────────────
  const Workstream = () => {
    if (!aw) return null;
    const Icon = aw.icon; const ac = CC[aw.cat]; const { pct, done, total } = wsPct(view);
    const items = hideDone ? aw.items.filter(it => !wsState[view]?.[it.id]?.checked) : aw.items;
    const notionWs = notionData?.workstreams?.find((w: any) => w.id === view);
    return (
      <div className="animate-in fade-in duration-300">
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyItems: "space-between", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, background: `${ac}14`, border: `1px solid ${ac}28`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} color={ac} /></div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: ac, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>{aw.cat}</span>
                  <span style={{ fontSize: 9, color: "#52525b", background: "#27272a", padding: "1px 6px", borderRadius: 99 }}>{notionWs ? notionWs.status : aw.phase}</span>
                </div>
                <h1 style={{ fontSize: mob ? 17 : 20, fontWeight: 600, letterSpacing: "-0.4px", margin: 0, color: "#fafafa" }}>{aw.label}</h1>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setHideDone(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, cursor: pointerOption, color: hideDone ? ac : "#52525b", fontSize: 11 }}>
                {hideDone ? <Eye size={11} /> : <EyeOff size={11} />}
                {hideDone ? "All" : "Hide done"}
              </button>
              <Ring pct={pct} size={38} stroke={3} color={ac} />
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 12px", lineHeight: 1.6 }}>{aw.desc}</p>
          <div style={{ height: 3, background: "#27272a", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${ac},${ac}88)`, borderRadius: 99, transition: "width 0.35s", boxShadow: `0 0 8px ${ac}44` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ fontSize: 11, color: "#3f3f46" }}>{done}/{total} items complete</span>
            {pct === 100 && <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>All done</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, idx) => {
            const it = wsState[view]?.[item.id] || { checked: false, note: "", open: false };
            return (
              <div key={item.id} style={{ background: "#18181b", border: `1px solid ${it.checked ? ac + "28" : "rgba(255,255,255,0.07)"}`, borderRadius: 9, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: mob ? "12px" : "11px 14px" }}>
                  <div style={{ width: 3, height: 3, borderRadius: 99, background: item.hi ? ac : "transparent", flexShrink: 0 }} />
                  <button onClick={() => twCheck(view, item.id)}
                    style={{ width: mob ? 20 : 17, height: mob ? 20 : 17, borderRadius: 4, border: `1.5px solid ${it.checked ? ac : "#3f3f46"}`, background: it.checked ? ac : "transparent", cursor: pointerOption, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {it.checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  {!mob && <span style={{ fontSize: 10, color: "#3f3f46", minWidth: 16 }}>{String(idx + 1).padStart(2, "0")}</span>}
                  <span style={{ flex: 1, fontSize: mob ? 14 : 13.5, color: it.checked ? "#52525b" : "#d4d4d8", textDecoration: it.checked ? "line-through" : "none", lineHeight: 1.5 }}>{item.text}</span>
                  <button onClick={() => twNote(view, item.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: mob ? "6px 10px" : "3px 8px", background: it.open || it.note ? `${ac}14` : "transparent", border: `1px solid ${it.note ? ac + "40" : "rgba(255,255,255,0.08)"}`, borderRadius: 5, cursor: pointerOption, color: it.note ? ac : "#52525b", fontSize: 11, flexShrink: 0 }}>
                    <StickyNote size={11} />{!mob && (it.note ? "Signal" : "Note")}
                  </button>
                </div>
                {it.open && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", background: "#111113" }}>
                    <textarea value={it.note} onChange={e => stNote(view, item.id, e.target.value)}
                      placeholder="Add research signals, links, or creative notes..."
                      style={{ width: "100%", minHeight: 60, background: "transparent", border: "none", color: "#a1a1aa", fontSize: 13, lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "Inter,system-ui,sans-serif", boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            );
          })}
          {hideDone && items.length === 0 && <div style={{ padding: "28px", textAlign: "center", color: "#52525b", fontSize: 13, background: "#18181b", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)" }}>All tasks complete</div>}
        </div>
      </div>
    );
  };

  // ── ROADMAP ──────────────────────────────────────────────────
  const Roadmap = () => (
    <div className="animate-in fade-in duration-300">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 38, height: 38, background: "#818cf814", border: "1px solid #818cf828", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><GitBranch size={16} color="#818cf8" /></div>
        <div><div style={{ fontSize: 10, color: "#818cf8", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Product</div><h1 style={{ fontSize: mob ? 17 : 20, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>Product Roadmap</h1></div>
      </div>
      <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 18px", lineHeight: 1.6 }}>Track milestones from MVP through launch to scale.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {RM_DATA.map(m => {
          const { pct, done, total } = rmPct(m.id); 
          const notionRm = notionData?.roadmap?.find((r: any) => r.id === m.id);
          const currentStatus = notionRm ? notionRm.status : m.status;
          const targetDate = notionRm?.targetDate ? new Date(notionRm.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD";
          const sc = STATUS_C[currentStatus] || "#52525b";

          return (
            <div key={m.id} style={{ background: "#18181b", border: `1px solid ${m.color}22`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyItems: "space-between", justifyContent: "space-between", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.color, background: `${m.color}14`, padding: "2px 9px", borderRadius: 99 }}>{m.version}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fafafa" }}>{m.label}</span>
                    <span style={{ fontSize: 9, color: sc, background: `${sc}14`, padding: "2px 7px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.5px" }}>{currentStatus}</span>
                    <span style={{ fontSize: 11, color: "#71717a" }}>Target: {targetDate}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 11, color: "#52525b" }}>{done}/{total}</span>
                    <Ring pct={pct} size={28} stroke={2.5} color={m.color} />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#71717a", margin: "0 0 8px", lineHeight: 1.5 }}>{m.desc}</p>
                <div style={{ height: 2, background: "#27272a", borderRadius: 99 }}><div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 99, transition: "width 0.3s" }} /></div>
              </div>
              <div style={{ padding: "6px 16px 10px" }}>
                {m.items.map(it => {
                  const checked = rmState[m.id]?.[it.id]?.checked || false;
                  return (
                    <div key={it.id} onClick={() => trCheck(m.id, it.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: pointerOption, minHeight: 40 }}>
                      <div style={{ width: mob ? 20 : 16, height: mob ? 20 : 16, borderRadius: 4, border: `1.5px solid ${checked ? m.color : "#3f3f46"}`, background: checked ? m.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                        {checked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <span style={{ fontSize: mob ? 14 : 13.5, color: checked ? "#52525b" : "#d4d4d8", textDecoration: checked ? "line-through" : "none", lineHeight: 1.5 }}>{it.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── CHANGELOG ────────────────────────────────────────────────
  const Changelog = () => (
    <div className="animate-in fade-in duration-300">
      <div style={{ display: "flex", alignItems: "center", justifyItems: "space-between", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "#f472b614", border: "1px solid #f472b628", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={16} color="#f472b6" /></div>
          <div><div style={{ fontSize: 10, color: "#f472b6", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Build Log</div><h1 style={{ fontSize: mob ? 17 : 20, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>Changelog</h1></div>
        </div>
        <button onClick={() => setShowForm(p => !p)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 13px", background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, cursor: pointerOption, color: "#d4d4d8", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
          <Plus size={13} /> Add
        </button>
      </div>
      {showForm && (
        <div style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input value={newLog.version} onChange={e => setNewLog(p => ({ ...p, version: e.target.value }))} placeholder="Version (v0.2)" style={inp} />
            <input value={newLog.date} onChange={e => setNewLog(p => ({ ...p, date: e.target.value }))} placeholder="Date (Jun 2025)" style={inp} />
            <select value={newLog.tag} onChange={e => setNewLog(p => ({ ...p, tag: e.target.value }))} style={{ ...inp, background: "#0d0d0f" }}>
              <option value="product">product</option><option value="strategy">strategy</option><option value="growth">growth</option><option value="milestone">milestone</option>
            </select>
          </div>
          <textarea value={newLog.text} onChange={e => setNewLog(p => ({ ...p, text: e.target.value }))} placeholder="What happened? What changed? What did you learn?"
            style={{ ...inp, minHeight: 64, resize: "vertical", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addLog} style={{ flex: 1, padding: "9px", background: "#818cf8", border: "none", borderRadius: 6, cursor: pointerOption, color: "white", fontSize: 13, fontWeight: 600 }}>Save Entry</button>
            <button onClick={() => setShowForm(false)} style={{ padding: "9px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: pointerOption, color: "#71717a", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
      {displayLog.map((entry: any, i: number) => {
        const tc = TAG_C[entry.tag] || "#52525b";
        return (
          <div key={entry.id || i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 8, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: tc, marginTop: 5, flexShrink: 0 }} />
              {i < displayLog.length - 1 && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)" }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>
                {entry.version && <span style={{ fontSize: 11, fontWeight: 600, color: "#fafafa", background: "#27272a", padding: "2px 8px", borderRadius: 99 }}>{entry.version}</span>}
                <span style={{ fontSize: 11, color: tc, background: `${tc}14`, padding: "2px 8px", borderRadius: 99 }}>{entry.tag}</span>
                <span style={{ fontSize: 11, color: "#52525b" }}>{entry.date}</span>
              </div>
              <p style={{ fontSize: mob ? 14 : 13.5, color: "#a1a1aa", margin: 0, lineHeight: 1.65 }}>{entry.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── SIDEBAR (desktop) ────────────────────────────────────────
  const Sidebar = () => (
    <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", background: "#09090b", paddingBottom: 20 }}>
      <div style={{ padding: "10px 10px 6px" }}>
        <NavBtn active={view === "home"} onClick={() => setView("home")} icon={<LayoutGrid size={13} />} label="Overview" color="#fafafa" />
      </div>
      {grouped.map(({ cat, color, items: wsItems }) => (
        <div key={cat}>
          <div style={{ padding: "8px 14px 3px", fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color, opacity: 0.65 }}>{cat}</div>
          {wsItems.map(ws => {
            const { pct } = wsPct(ws.id); const WI = ws.icon; const isA = view === ws.id;
            return (
              <button key={ws.id} onClick={() => setView(ws.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 14px", background: isA ? "rgba(255,255,255,0.05)" : "transparent", border: "none", borderLeft: `2px solid ${isA ? color : "transparent"}`, cursor: pointerOption, transition: "all 0.15s" }}>
                <WI size={12} color={isA ? color : "#52525b"} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: isA ? "#fafafa" : "#a1a1aa", fontWeight: isA ? 500 : 400, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ws.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 24, height: 2, background: "#27272a", borderRadius: 99 }}><div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, opacity: 0.55 }} /></div>
                  <span style={{ fontSize: 9, color: pct === 100 ? "#34d399" : "#3f3f46", minWidth: 18, textAlign: "right" }}>{pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ margin: "10px 10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
        <NavBtn active={view === "roadmap"} onClick={() => setView("roadmap")} icon={<GitBranch size={13} />} label="Roadmap" color="#818cf8" />
        <NavBtn active={view === "changelog"} onClick={() => setView("changelog")} icon={<Clock size={13} />} label="Changelog" color="#f472b6" />
      </div>
    </div>
  );

  const isSubView = view !== "home";
  const viewLabel = aw ? aw.label : view === "roadmap" ? "Roadmap" : view === "changelog" ? "Changelog" : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#09090b", color: "#fafafa", fontFamily: "Inter,system-ui,sans-serif" }}>

      {/* TOP BAR */}
      <div style={{ height: 50, display: "flex", alignItems: "center", justifyItems: "space-between", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, position: "sticky", top: 0, zIndex: 50, background: "#09090b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mob && isSubView ? (
            <button onClick={() => setView("home")} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: pointerOption, color: "#a1a1aa", padding: "4px 0" }}>
              <ArrowLeft size={16} /><span style={{ fontSize: 13, color: "#fafafa", fontWeight: 500 }}>{viewLabel}</span>
            </button>
          ) : (
            <>
              <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#818cf8,#f472b6)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🎵</div>
              <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: "-0.3px" }}>LYRIQ</span>
              {!mob && <><span style={{ color: "#3f3f46", fontSize: 13 }}/><span style={{ fontSize: 12, color: "#71717a" }}>Mission Control</span></>}
              <span style={{ fontSize: 9, color: "#3f3f46", background: "#18181b", border: "1px solid rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4 }}>v3</span>
            </>
          )}
        </div>

        {/* Sync Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button 
            onClick={fetchDashboardData}
            title={syncMessage}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              padding: "4px 8px", 
              borderRadius: 6, 
              background: syncStatus === "synced" ? "rgba(52,211,153,0.1)" : syncStatus === "error" ? "rgba(239,68,68,0.1)" : "rgba(251,146,60,0.1)",
              border: `1px solid ${syncStatus === "synced" ? "#34d39944" : syncStatus === "error" ? "#ef444444" : "#fb923c44"}`,
              fontSize: 11,
              color: syncStatus === "synced" ? "#34d399" : syncStatus === "error" ? "#f87171" : "#fb923c",
              cursor: pointerOption
            }}
          >
            <Database size={11} className={isSyncing ? "animate-spin" : ""} />
            <span style={{ display: mob ? "none" : "inline" }}>
              {syncStatus === "synced" ? "Synced" : syncStatus === "error" ? "Sync Failed" : "Local Mock Mode"}
            </span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: mob ? 90 : 130, height: 4, background: "#27272a", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${globalPct}%`, height: "100%", background: "linear-gradient(90deg,#818cf8,#f472b6,#fb923c)", borderRadius: 99, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: rc, minWidth: 30 }}>{globalPct}%</span>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ display: "flex", flex: 1 }}>
        {!mob && <Sidebar />}
        <div style={{ flex: 1, padding: mob ? "16px" : "28px 28px", overflowX: "hidden" }}>
          <div style={{ maxWidth: mob ? "100%" : 760 }}>
            {view === "home" && <Overview />}
            {aw && <Workstream />}
            {view === "roadmap" && <Roadmap />}
            {view === "changelog" && <Changelog />}
          </div>
        </div>
      </div>

    </div>
  );
}

interface NavBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}

function NavBtn({ active, onClick, icon, label, color }: NavBtnProps) {
  const pointerOption = "pointer" as const;
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: active ? "rgba(255,255,255,0.05)" : "transparent", border: "none", borderLeft: `2px solid ${active ? color : "transparent"}`, cursor: pointerOption, transition: "all 0.15s", textAlign: "left" }}>
      <span style={{ color: active ? color : "#52525b", display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{ fontSize: 12.5, color: active ? "#fafafa" : "#a1a1aa", fontWeight: active ? 500 : 400 }}>{label}</span>
    </button>
  );
}
