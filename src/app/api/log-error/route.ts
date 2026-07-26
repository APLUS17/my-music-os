import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const { message, stack, url, context } = (body ?? {}) as Record<string, unknown>;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  console.error("[client-error]", message, typeof stack === "string" ? stack : "");

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("error_logs").insert([{
      user_id: user?.id ?? null,
      message: message.slice(0, 2000),
      stack: typeof stack === "string" ? stack.slice(0, 8000) : null,
      url: typeof url === "string" ? url.slice(0, 500) : null,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      context: context && typeof context === "object" ? context : null,
    }]);
  } catch (err) {
    console.error("[log-error] failed to persist:", err);
  }

  return NextResponse.json({ success: true });
}
