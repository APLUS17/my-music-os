import { NextRequest, NextResponse } from 'next/server';

// Seed data to return if Notion integration is not configured
const SEED_WORKSTREAMS = [
  { id: "mkt", name: "Market Validation", progress: 60, status: "In Progress", phase: "Foundation" },
  { id: "icp", name: "Ideal Customer Profile", progress: 80, status: "In Progress", phase: "Foundation" },
  { id: "psf", name: "Problem / Solution Fit", progress: 40, status: "In Progress", phase: "Foundation" },
  { id: "pos", name: "Positioning & Messaging", progress: 20, status: "Not Started", phase: "Foundation" },
  { id: "gtm", name: "Go-To-Market Strategy", progress: 0, status: "Not Started", phase: "Launch" },
  { id: "lseq", name: "Launch Sequence", progress: 0, status: "Not Started", phase: "Launch" },
  { id: "seo", name: "Content & SEO", progress: 0, status: "Not Started", phase: "Scale" },
  { id: "com", name: "Community Building", progress: 10, status: "In Progress", phase: "Launch" },
  { id: "paid", name: "Paid Acquisition", progress: 0, status: "Not Started", phase: "Scale" },
  { id: "road", name: "Product Roadmap", progress: 90, status: "In Progress", phase: "Foundation" },
  { id: "onb", name: "Onboarding & UX", progress: 50, status: "In Progress", phase: "Foundation" },
  { id: "ret", name: "Retention & Engagement", progress: 0, status: "Not Started", phase: "Scale" },
  { id: "prc", name: "Pricing & Monetization", progress: 30, status: "In Progress", phase: "Foundation" },
  { id: "part", name: "Partnerships & Distribution", progress: 0, status: "Not Started", phase: "Scale" },
  { id: "kpi", name: "Success Metrics & KPIs", progress: 70, status: "In Progress", phase: "Foundation" }
];

const SEED_ROADMAP = [
  { id: "mvp", name: "MVP", status: "active", targetDate: "2026-06-15", phase: "Foundation" },
  { id: "beta", name: "Beta", status: "upcoming", targetDate: "2026-08-01", phase: "Launch" },
  { id: "v1", name: "V1.0 Launch", status: "upcoming", targetDate: "2026-10-10", phase: "Launch" },
  { id: "v15", name: "V1.5 Growth", status: "future", targetDate: "2027-01-15", phase: "Scale" }
];

const SEED_CHANGELOG = [
  { id: "c1", version: "v0.0.1", date: "Jan 2025", tag: "milestone", text: "Project kickoff. Core concept validated through 10 songwriter interviews." },
  { id: "c2", version: "v0.0.2", date: "Feb 2025", tag: "product", text: "Wireframes complete. User flow mapped from voice memo to finished song." },
  { id: "c3", version: "v0.0.3", date: "Mar 2025", tag: "strategy", text: "Positioning locked: LYRIQ for aspiring songwriters who never finish songs." }
];

export async function GET(req: NextRequest) {
  const notionApiKey = process.env.NOTION_API_KEY;
  const dbWorkstreamsId = process.env.NOTION_DB_WORKSTREAMS_ID;
  const dbRoadmapId = process.env.NOTION_DB_ROADMAP_ID;
  const dbChangelogId = process.env.NOTION_DB_CHANGELOG_ID;

  // Fallback to seeds if configuration is incomplete
  if (!notionApiKey || !dbWorkstreamsId || !dbRoadmapId || !dbChangelogId) {
    return NextResponse.json({
      synced: false,
      message: "Rendering fallback seed data. Configure Notion variables in .env.local to sync.",
      workstreams: SEED_WORKSTREAMS,
      roadmap: SEED_ROADMAP,
      changelog: SEED_CHANGELOG
    });
  }

  try {
    // 1. Fetch Workstreams from Notion
    const wsResponse = await fetch(`https://api.notion.com/v1/databases/${dbWorkstreamsId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      next: { revalidate: 30 } // Cache database query results for 30 seconds
    });

    // 2. Fetch Roadmap from Notion
    const rmResponse = await fetch(`https://api.notion.com/v1/databases/${dbRoadmapId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      next: { revalidate: 30 }
    });

    // 3. Fetch Changelog from Notion
    const logResponse = await fetch(`https://api.notion.com/v1/databases/${dbChangelogId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      next: { revalidate: 30 }
    });

    if (!wsResponse.ok || !rmResponse.ok || !logResponse.ok) {
      console.warn("One or more Notion API queries failed. Falling back to seeds.");
      return NextResponse.json({
        synced: false,
        message: "Notion API returned an error. Falling back to seed data.",
        workstreams: SEED_WORKSTREAMS,
        roadmap: SEED_ROADMAP,
        changelog: SEED_CHANGELOG
      });
    }

    const wsData = await wsResponse.json();
    const rmData = await rmResponse.json();
    const logData = await logResponse.json();

    // Map Notion Workstreams database rows
    const parsedWorkstreams = wsData.results.map((page: any) => {
      const props = page.properties;
      const name = props.Name?.title?.[0]?.plain_text || "Untitled Workstream";
      // Find matching ID by name match (or fallback to lowercase name hash)
      const mappedId = name.toLowerCase().includes("validation") ? "mkt"
        : name.toLowerCase().includes("persona") || name.toLowerCase().includes("customer") ? "icp"
        : name.toLowerCase().includes("fit") ? "psf"
        : name.toLowerCase().includes("position") || name.toLowerCase().includes("message") ? "pos"
        : name.toLowerCase().includes("go-to-market") || name.toLowerCase().includes("gtm") ? "gtm"
        : name.toLowerCase().includes("sequence") ? "lseq"
        : name.toLowerCase().includes("seo") || name.toLowerCase().includes("content") ? "seo"
        : name.toLowerCase().includes("community") ? "com"
        : name.toLowerCase().includes("paid") || name.toLowerCase().includes("acquisition") ? "paid"
        : name.toLowerCase().includes("roadmap") ? "road"
        : name.toLowerCase().includes("onboarding") ? "onb"
        : name.toLowerCase().includes("retention") ? "ret"
        : name.toLowerCase().includes("pricing") || name.toLowerCase().includes("monet") ? "prc"
        : name.toLowerCase().includes("partner") || name.toLowerCase().includes("dist") ? "part"
        : name.toLowerCase().includes("kpi") || name.toLowerCase().includes("metric") ? "kpi"
        : page.id;

      return {
        id: mappedId,
        name: name,
        phase: props.Phase?.select?.name || "Foundation",
        category: props.Category?.select?.name || "Strategy",
        progress: props.Progress?.number ?? 0,
        status: props.Status?.select?.name || "Not Started",
        linearCycleId: props["Linear Cycle ID"]?.rich_text?.[0]?.plain_text || ""
      };
    });

    // Map Notion Roadmap database rows
    const parsedRoadmap = rmData.results.map((page: any) => {
      const props = page.properties;
      const name = props.Name?.title?.[0]?.plain_text || "Untitled Release";
      const mappedId = name.toLowerCase().includes("mvp") ? "mvp"
        : name.toLowerCase().includes("beta") ? "beta"
        : name.toLowerCase().includes("v1.0") || name.toLowerCase().includes("launch") ? "v1"
        : name.toLowerCase().includes("v1.5") || name.toLowerCase().includes("growth") ? "v15"
        : page.id;

      return {
        id: mappedId,
        name: name,
        phase: props.Phase?.select?.name || "Foundation",
        status: (props.Status?.select?.name || "upcoming").toLowerCase(), // active, upcoming, future
        targetDate: props["Target Date"]?.date?.start || ""
      };
    });

    // Map Notion Changelog database rows
    const parsedChangelog = logData.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        version: props.Version?.rich_text?.[0]?.plain_text || "",
        date: props.Timestamp?.date?.start || new Date(page.created_time).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        tag: (props.Type?.select?.name || "product").toLowerCase(), // milestone, product, strategy, growth
        text: props["Event Title"]?.title?.[0]?.plain_text || props.Details?.rich_text?.[0]?.plain_text || "Activity update."
      };
    });

    return NextResponse.json({
      synced: true,
      workstreams: parsedWorkstreams.length > 0 ? parsedWorkstreams : SEED_WORKSTREAMS,
      roadmap: parsedRoadmap.length > 0 ? parsedRoadmap : SEED_ROADMAP,
      changelog: parsedChangelog.length > 0 ? parsedChangelog : SEED_CHANGELOG
    });

  } catch (error: any) {
    console.error("Error communicating with Notion:", error);
    return NextResponse.json({
      synced: false,
      error: error.message || "Failed to fetch dashboard data from Notion.",
      workstreams: SEED_WORKSTREAMS,
      roadmap: SEED_ROADMAP,
      changelog: SEED_CHANGELOG
    });
  }
}
