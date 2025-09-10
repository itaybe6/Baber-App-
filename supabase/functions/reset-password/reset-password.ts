// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Environment
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
// Use service role to bypass RLS when reading users
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("RESET_FROM_EMAIL") || "onboarding@resend.dev";

// Decode the demo hash scheme used by the app
function decodeDemoHash(hash) {
  if (!hash || typeof hash !== "string") return null;
  if (hash === "default_hash") return "123456";
  if (hash.startsWith("hash_")) return hash.slice(5);
  return null;
}

async function sendEmail(to, subject, text) {
  if (!resendApiKey) {
    console.warn("[reset-password] Missing RESEND_API_KEY. Skipping email send.");
    return { ok: false, skipped: true };
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, text }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Failed to send email (${resp.status}): ${errText}`);
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, phone } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'email'" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Query users table by email (and phone if provided)
    let q = admin.from("users").select("id, name, email, phone, password_hash").eq("email", email).limit(1);
    if (phone && typeof phone === "string" && phone.trim().length > 0) {
      q = q.eq("phone", phone.trim());
    }
    const { data: users, error: findErr } = await q;
    if (findErr) {
      console.error("[reset-password] query error", findErr);
      // Do not leak details
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const user = Array.isArray(users) && users.length > 0 ? users[0] : null;
    if (!user) {
      // Generic success to avoid user enumeration
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const plain = decodeDemoHash(user.password_hash);
    if (!plain) {
      console.warn("[reset-password] password_hash not decodable for user", user.id);
    }

    const subject = "איפוס/שחזור סיסמה";
    const text = plain
      ? `שלום ${user.name || ""},\n\nהתבקשה שחזור סיסמה לחשבון שלך.\nהסיסמה הנוכחית שלך היא: ${plain}\n\nמומלץ להתחבר ולשנות אותה מידית.`
      : `שלום ${user.name || ""},\n\nהתבקשה שחזור סיסמה לחשבון שלך.\nלא הצלחנו לשחזר את הסיסמה הקיימת. פנה לתמיכה או בקש מאיתנו לאפס ידנית.`;

    try {
      await sendEmail(email, subject, text);
      console.log("reset-password email sent", email);
    } catch (sendErr) {
      console.error("[reset-password] email send error", sendErr);
      // Still return ok to the client to avoid enumeration / UX issues
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[reset-password] unexpected error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});


