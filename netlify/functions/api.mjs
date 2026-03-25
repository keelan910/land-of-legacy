import { neon } from "@netlify/neon";

export default async (req) => {
  const sql = neon();
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── INIT: Create table if it doesn't exist ──
    if (action === "init") {
      await sql`
        CREATE TABLE IF NOT EXISTS daily_sales (
          date_key TEXT PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    // ── GET: Fetch one day ──
    if (action === "get") {
      const date = url.searchParams.get("date");
      if (!date) return new Response(JSON.stringify({ error: "date required" }), { status: 400, headers });
      const rows = await sql`SELECT data FROM daily_sales WHERE date_key = ${date}`;
      return new Response(JSON.stringify({ data: rows.length > 0 ? rows[0].data : null }), { headers });
    }

    // ── ALL: Fetch all days ──
    if (action === "all") {
      const rows = await sql`SELECT date_key, data FROM daily_sales ORDER BY date_key`;
      const out = {};
      for (const r of rows) out[r.date_key] = r.data;
      return new Response(JSON.stringify({ data: out }), { headers });
    }

    // ── SAVE: Upsert a day ──
    if (action === "save") {
      const body = await req.json();
      if (!body.date || !body.data) return new Response(JSON.stringify({ error: "date and data required" }), { status: 400, headers });
      const jsonStr = JSON.stringify(body.data);
      await sql`
        INSERT INTO daily_sales (date_key, data, updated_at)
        VALUES (${body.date}, ${jsonStr}::jsonb, NOW())
        ON CONFLICT (date_key)
        DO UPDATE SET data = ${jsonStr}::jsonb, updated_at = NOW()
      `;
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: init, get, all, save" }), { status: 400, headers });

  } catch (e) {
    console.error("API Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
};

export const config = { path: "/.netlify/functions/api" };
