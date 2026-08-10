import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function parseUserAgent(ua: string) {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType = "Desktop";

  if (/mobile/i.test(ua)) deviceType = "Mobile";
  else if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";

  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/edg/i.test(ua)) browser = "Edge";
  else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { browser, os, deviceType };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization token" });
    }
    const token = authHeader.slice(7).trim();

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Server authentication client unavailable" });
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: "Invalid or expired session token" });
    }

    const rawHeader = (req.headers["x-forwarded-for"] as string || "");
    let rawIp = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader.split(",")[0].trim();
    if (rawIp.startsWith("::ffff:")) {
      rawIp = rawIp.substring(7);
    }

    const userAgent = (req.headers["user-agent"] as string) || "";
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { auth_provider, session_fingerprint } = body;
    const parsed = parseUserAgent(userAgent);

    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("record_login_activity", {
      p_user_id: user.id,
      p_ip_address: (rawIp && rawIp !== "127.0.0.1" && rawIp !== "::1") ? rawIp : null,
      p_country: null,
      p_region: null,
      p_city: null,
      p_device_type: parsed.deviceType,
      p_os: parsed.os,
      p_browser: parsed.browser,
      p_user_agent: userAgent,
      p_auth_provider: auth_provider || user.app_metadata?.provider || "email",
      p_session_fingerprint: session_fingerprint || null
    });

    if (rpcErr) {
      console.warn("record_login_activity RPC warning:", rpcErr.message);
      return res.status(500).json({ error: rpcErr.message });
    }

    return res.status(200).json(rpcRes || { success: true });
  } catch (err: any) {
    console.error("Error in /api/record-login Vercel route:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
