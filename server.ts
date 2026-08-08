import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Supabase Admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Ensure the 'avatars' storage bucket is created
async function ensureAvatarsBucket() {
  if (!supabaseAdmin) {
    console.log("Supabase Admin client not configured. Skipping bucket creation.");
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Using anonymous key fallback for server-side client. Skipping bucket creation via SDK to avoid RLS error (relying on database migrations for 'avatars' bucket setup).");
    return;
  }
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      console.error("Error listing Supabase storage buckets:", listError.message);
      return;
    }
    const bucketExists = buckets?.some(b => b.id === 'avatars');
    if (!bucketExists) {
      console.log("Bucket 'avatars' not found. Creating...");
      const { error: createError } = await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        console.warn("Failed to create bucket 'avatars' via SDK:", createError.message);
      } else {
        console.log("Successfully created public storage bucket: 'avatars'.");
      }
    } else {
      console.log("Bucket 'avatars' already exists.");
    }
  } catch (err) {
    console.warn("Exception checking/creating avatars bucket:", err);
  }
}
ensureAvatarsBucket();

// Ensure the 'resumes' storage bucket is created (private bucket)
async function ensureResumesBucket() {
  if (!supabaseAdmin) {
    console.log("Supabase Admin client not configured. Skipping resumes bucket creation.");
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Using anonymous key fallback for server-side client. Skipping resumes bucket creation via SDK.");
    return;
  }
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      console.error("Error listing Supabase storage buckets:", listError.message);
      return;
    }
    const bucketExists = buckets?.some(b => b.id === 'resumes');
    if (!bucketExists) {
      console.log("Bucket 'resumes' not found. Creating...");
      const { error: createError } = await supabaseAdmin.storage.createBucket('resumes', {
        public: false,
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        console.warn("Failed to create bucket 'resumes' via SDK:", createError.message);
      } else {
        console.log("Successfully created private storage bucket: 'resumes'.");
      }
    } else {
      console.log("Bucket 'resumes' already exists.");
    }
  } catch (err: any) {
    console.warn("Exception checking/creating resumes bucket:", err);
  }
}
ensureResumesBucket();

// Initialize Resend Client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;


// Expose Supabase configuration securely (only public keys)
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    appUrl: process.env.VITE_APP_URL || process.env.APP_URL || ""
  });
});

const PORT = 3000;

// Lazy initialization of Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("GEMINI_API_KEY environment variable is missing. Falling back to high-fidelity simulated response modes.");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Live AI Search and Matcher Endpoint
app.post("/api/search", async (req, res) => {
  const { query, type = "all" } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  const ai = getAi();
  if (!ai) {
    // Elegant simulation fallback
    const matchedCategory = query.toLowerCase().includes("design") ? "Designer" :
                            query.toLowerCase().includes("code") || query.toLowerCase().includes("dev") ? "Developer" :
                            query.toLowerCase().includes("electric") ? "Electrician" :
                            query.toLowerCase().includes("carpenter") ? "Carpenter" : "Developer";
    return res.json({
      matchedCategory,
      filterTerms: [query],
      locationPreference: "",
      aiAnalysis: `Simulation Mode: Analyzed request for "${query}". Premium career opportunities in local markets are showing a 12% boost this quarter.`,
      alternativeSuggestions: ["Creative Architect", "Interactive Dev"],
    });
  }

  try {
    const prompt = `Analyze this user query for our local career marketplace: "${query}".
    Classify the query into a category, extract key skills or filter terms, determine any location parsed, and generate an inspiring 1-sentence career advice/insight matching this interest.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedCategory: {
              type: Type.STRING,
              description: "The most relevant category: 'Developer', 'Designer', 'Electrician', 'Carpenter', 'Driver', 'Chef', 'Teacher', 'Photographer', 'Mechanic', 'Cleaner'",
            },
            filterTerms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Extracted skills or keyword filters like 'React', 'solar', 'hardwood', 'Figma'",
            },
            locationPreference: {
              type: Type.STRING,
              description: "Parsed city/state or remote preference, empty if none.",
            },
            aiAnalysis: {
              type: Type.STRING,
              description: "A premium, inspiring, 1-sentence career advice or market trend matching this query.",
            },
            alternativeSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 related alternative skills or titles they might be interested in.",
            },
          },
          required: ["matchedCategory", "filterTerms", "locationPreference", "aiAnalysis", "alternativeSuggestions"],
        },
      },
    });

    const dataText = response.text?.trim() || "{}";
    const result = JSON.parse(dataText);
    res.json(result);
  } catch (error: any) {
    console.error("AI Search Error:", error);
    res.status(500).json({ error: "Failed to perform AI analysis", details: error.message });
  }
});

// 2. OpenComm AI Career Co-Pilot Chat Endpoint
app.post("/api/ai-chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const ai = getAi();
  if (!ai) {
    // Beautiful default fallback message from OpenComm Co-Pilot
    return res.json({
      text: `### Welcome to OpenComm Career Co-Pilot (Offline Mode)

It looks like the \`GEMINI_API_KEY\` is not set, but I can still share some **premium advice** based on our product specifications:

1. **Optimize Your Profile**: Active workers with verified badges receive **4.2x more contract inquiries**.
2. **Local Marketplace Pulse**: High-end carpentry and custom solar installations are up **25%** in regional hubs.
3. **Drafting Proposals**: Always state your availability and include a link to your Figma or GitHub portfolio.

*Feel free to explore our pre-loaded jobs and workers!*`,
    });
  }

  try {
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: `You are the OpenComm Career Co-Pilot. You are a premium, highly sophisticated, ultra-polished career advisor and business scout.
        You speak with professional composure, clarity, and precision (like the design teams at Apple, Stripe, and Linear).
        Assist the user with professional networking, resume/profile tips, drafting job posts, or explaining how they can succeed on OpenComm.
        Always format your responses with elegant markdown, headers, bullet points, and neat typography. Keep answers concise, highly structured, and inspiring.`,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: "Failed to connect to Career Co-Pilot", details: error.message });
  }
});

// --- EMAIL VERIFICATION SYSTEM ---

interface VerificationToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  redirectAction?: string;
  email: string;
}

const inMemoryTokens = new Map<string, VerificationToken>();
const ipEmailCounts = new Map<string, { count: number; lastReset: number }>();
const userEmailCounts = new Map<string, { count: number; lastReset: number }>();
const userLastSent = new Map<string, number>();

function checkRateLimit(userId: string, email: string, ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  
  // 1. 60-second cooldown per user
  const lastSent = userLastSent.get(userId) || 0;
  if (now - lastSent < 60000) {
    const remaining = Math.ceil((60000 - (now - lastSent)) / 1000);
    return { allowed: false, message: `Please wait ${remaining} seconds before requesting another email.` };
  }

  // 2. IP limit (max 10 per hour)
  const ipInfo = ipEmailCounts.get(ip) || { count: 0, lastReset: now };
  if (now - ipInfo.lastReset > 3600000) {
    ipInfo.count = 0;
    ipInfo.lastReset = now;
  }
  if (ipInfo.count >= 10) {
    return { allowed: false, message: "Too many verification requests from this IP address. Please try again in an hour." };
  }

  // 3. User limit (max 5 per hour)
  const userInfo = userEmailCounts.get(userId) || { count: 0, lastReset: now };
  if (now - userInfo.lastReset > 3600000) {
    userInfo.count = 0;
    userInfo.lastReset = now;
  }
  if (userInfo.count >= 5) {
    return { allowed: false, message: "Maximum verification email limit reached (5 per hour). Please try again later." };
  }

  // Update
  ipInfo.count += 1;
  ipEmailCounts.set(ip, ipInfo);

  userInfo.count += 1;
  userEmailCounts.set(userId, userInfo);

  userLastSent.set(userId, now);

  return { allowed: true };
}

function renderSuccessHtml(redirectAction: string) {
  const targetUrl = `/?verified=true&action=${encodeURIComponent(redirectAction)}`;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verified Successfully - OpenComm</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
        .heading { font-family: 'Space Grotesk', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-[#111827] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-[#273449] text-center relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
        
        <div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto mb-6">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>

        <h1 class="heading text-2xl font-black tracking-tight mb-3">Email Verified</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          Your account is now fully verified. You have successfully unlocked all trusted interactions including job applications, job posting, hiring, and professional messaging.
        </p>

        <a href="${targetUrl}" class="inline-flex w-full justify-center items-center h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md transition-all">
          Continue to OpenComm
        </a>
      </div>
    </body>
    </html>
  `;
}

function renderErrorHtml(message: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Failed - OpenComm</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
        .heading { font-family: 'Space Grotesk', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-[#111827] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-[#273449] text-center relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-red-500" />
        
        <div class="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>

        <h1 class="heading text-2xl font-black tracking-tight mb-3">Verification Failed</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          ${message}
        </p>

        <a href="/" class="inline-flex w-full justify-center items-center h-12 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all hover:bg-slate-200 dark:hover:bg-zinc-700">
          Back to OpenComm
        </a>
      </div>
    </body>
    </html>
  `;
}

// 2.5 Get Resume Signed URL Endpoint (Secure & Private access)
app.post("/api/get-resume-url", async (req, res) => {
  const { resumePath, workerId, requesterId } = req.body;

  if (!resumePath || !workerId || !requesterId) {
    return res.status(400).json({ error: "resumePath, workerId, and requesterId are required." });
  }

  if (!supabaseAdmin) {
    // Emulator / sandbox mode: return a sandbox mock signed URL
    return res.json({ signedUrl: `/mock-resumes/${resumePath}?token=mock-sandbox-token` });
  }

  try {
    let isAuthorized = requesterId === workerId;

    if (!isAuthorized) {
      // Check if there is an active job application by workerId to a job posted by requesterId
      const { data: apps, error: appErr } = await supabaseAdmin
        .from('job_applications')
        .select('id, jobs(posted_by)')
        .eq('applicant_id', workerId);

      if (!appErr && apps) {
        const isEmployer = apps.some((app: any) => app.jobs && app.jobs.posted_by === requesterId);
        if (isEmployer) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Check if there is a contact request between workerId and requesterId
      const { data: contactReqs, error: contactErr } = await supabaseAdmin
        .from('contact_requests')
        .select('id')
        .or(`requester_id.eq.${requesterId},receiver_id.eq.${requesterId}`)
        .or(`requester_id.eq.${workerId},receiver_id.eq.${workerId}`);

      if (!contactErr && contactReqs && contactReqs.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Check if there is a hiring request between workerId and requesterId
      const { data: hireReqs, error: hireErr } = await supabaseAdmin
        .from('hiring_requests')
        .select('id')
        .or(`client_id.eq.${requesterId},worker_id.eq.${requesterId}`)
        .or(`client_id.eq.${workerId},worker_id.eq.${workerId}`);

      if (!hireErr && hireReqs && hireReqs.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Unauthorized access to resume file." });
    }

    // Generate signed URL (expires in 1 hour / 3600 seconds)
    const { data, error } = await supabaseAdmin.storage
      .from('resumes')
      .createSignedUrl(resumePath, 3600);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ signedUrl: data.signedUrl });
  } catch (err: any) {
    console.error("Error generating resume signed URL:", err);
    return res.status(500).json({ error: err.message || "Failed to generate resume URL." });
  }
});

// 3. Send Verification Email Endpoint
app.post("/api/send-verification-email", async (req, res) => {
  const { email, userId, redirectAction = "" } = req.body;
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();

  if (!email || !userId) {
    return res.status(400).json({ error: "Email and User ID are required." });
  }

  // Rate limiting check
  const rateLimitResult = checkRateLimit(userId, email, ip);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: rateLimitResult.message });
  }

  // Generate cryptographically secure tokens
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Invalidate older unused tokens for this user in Supabase
  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from("email_verification_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("used_at", null);
    } catch (err) {
      console.warn("Could not invalidate old tokens in Supabase DB:", err);
    }
  }

  // Also invalidate in-memory old tokens for this user
  for (const [hash, tok] of inMemoryTokens.entries()) {
    if (tok.userId === userId && !tok.usedAt) {
      tok.usedAt = new Date();
      inMemoryTokens.set(hash, tok);
    }
  }

  // Store new token in-memory fallback
  const tokenRecord: VerificationToken = {
    userId,
    tokenHash,
    expiresAt,
    usedAt: null,
    createdAt: new Date(),
    redirectAction,
    email
  };
  inMemoryTokens.set(tokenHash, tokenRecord);

  // Store new token in Supabase
  if (supabaseAdmin) {
    try {
      const { error: insertErr } = await supabaseAdmin
        .from("email_verification_tokens")
        .insert({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString()
        });
      if (insertErr) {
        console.warn("Could not insert token in database:", insertErr);
      }
    } catch (err) {
      console.warn("Database insert catch error:", err);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`;
  const verificationUrl = `${appUrl}/verify-email?token=${rawToken}`;
  console.log(`[Verification] Created verification link for ${email}: ${verificationUrl}`);

  let emailSent = false;
  let emailErrorMsg = "";

  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: "OpenComm Security <security@opencomm.org>",
        to: email,
        subject: "Verify Your OpenComm Marketplace Account",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; max-width: 600px; margin: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #1e1b4b; font-size: 24px; font-weight: 800; margin: 0; font-family: 'Space Grotesk', sans-serif;">Verify your email address</h2>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
              Thank you for signing up for OpenComm. To ensure a trusted experience, email verification is required before sending job applications, posting jobs, sending hiring requests, and using professional messaging.
            </p>
            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${verificationUrl}" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #ffffff; background-image: linear-gradient(to right, #4f46e5, #06b6d4); text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);">Verify My Account</a>
            </div>
            <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              If you did not request this email, please ignore it safely. This link expires in 30 minutes.
            </p>
          </div>
        `
      });
      if (error) {
        console.error("Resend delivery error:", error);
        emailErrorMsg = error.message;
      } else {
        emailSent = true;
      }
    } catch (err: any) {
      console.error("Resend throw error:", err);
      emailErrorMsg = err.message || "Failed to deliver email.";
    }
  }

  return res.json({
    success: true,
    message: emailSent 
      ? "Verification email sent successfully." 
      : `Verification email generated. (Delivery fell back: ${emailErrorMsg || "No RESEND_API_KEY"})`,
    url: verificationUrl,
    mock: !emailSent
  });
});

// 4. Verification Callback Endpoint
app.get("/verify-email", async (req, res) => {
  const rawToken = req.query.token as string;
  if (!rawToken) {
    return res.status(400).send(renderErrorHtml("Missing verification token."));
  }

  // Hash received token to query database / memory
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();

  let tokenRecord: any = null;
  let useInMemory = true;

  // Attempt to query token from Supabase DB
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("email_verification_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", now.toISOString())
        .maybeSingle();

      if (!error && data) {
        tokenRecord = data;
        useInMemory = false;
      }
    } catch (err) {
      console.error("Database query error for verification token:", err);
    }
  }

  // Fallback to in-memory check
  if (!tokenRecord) {
    const memoryRecord = inMemoryTokens.get(tokenHash);
    if (memoryRecord && !memoryRecord.usedAt && memoryRecord.expiresAt > now) {
      tokenRecord = memoryRecord;
      useInMemory = true;
    }
  }

  if (!tokenRecord) {
    return res.status(400).send(renderErrorHtml("The verification link is invalid, has expired, or has already been used. Please request a new verification link."));
  }

  // Mark token as used
  const usedAt = new Date();
  if (useInMemory) {
    const memoryRecord = inMemoryTokens.get(tokenHash)!;
    memoryRecord.usedAt = usedAt;
    inMemoryTokens.set(tokenHash, memoryRecord);
  } else if (supabaseAdmin) {
    await supabaseAdmin
      .from("email_verification_tokens")
      .update({ used_at: usedAt.toISOString() })
      .eq("id", tokenRecord.id);
  }

  // Update profiles.email_verified_for_actions = true
  const userId = tokenRecord.user_id || tokenRecord.userId;
  const redirectAction = tokenRecord.redirectAction || tokenRecord.redirect_action || "";

  if (supabaseAdmin) {
    try {
      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update({ email_verified_for_actions: true })
        .eq("id", userId);
      if (updateErr) {
        console.error("Failed to update profile email_verified_for_actions in DB:", updateErr);
      }
    } catch (err) {
      console.error("Profile update catch error:", err);
    }
  }

  // Standard callback rendering (Success HTML page)
  res.send(renderSuccessHtml(redirectAction));
});

// User-Agent parser helper
function parseUserAgent(ua: string): { os: string; browser: string; deviceType: string } {
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';
  let deviceType = 'Desktop';

  if (!ua) return { os, browser, deviceType };

  if (/mobile/i.test(ua)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) { os = 'iOS'; deviceType = /ipad/i.test(ua) ? 'Tablet' : 'Mobile'; }
  else if (/android/i.test(ua)) { os = 'Android'; deviceType = 'Mobile'; }
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/opr\//i.test(ua)) browser = 'Opera';

  return { os, browser, deviceType };
}

// Endpoint: Record authenticated user login activity
app.post("/api/record-login", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
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

    let rawIp = (req.headers["x-forwarded-for"] as string || "").split(",")[0].trim() || req.socket.remoteAddress || "";
    if (rawIp.startsWith("::ffff:")) {
      rawIp = rawIp.substring(7);
    }

    const userAgent = req.headers["user-agent"] || "";
    const { auth_provider, session_fingerprint } = req.body || {};
    const parsed = parseUserAgent(userAgent);

    // Create user-scoped Supabase client with verified JWT token header so auth.uid() in Postgres resolves to user ID
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";
    if (!supabaseAnonKey) {
      console.warn("Supabase anon key is missing for user-scoped client.");
      return res.status(500).json({ error: "Server authentication client misconfigured" });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: rpcRes, error: rpcErr } = await userClient.rpc("record_login_activity", {
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

    return res.json(rpcRes || { success: true });
  } catch (err: any) {
    console.error("Error in /api/record-login:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Serve frontend through Vite in dev, or statically in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpenComm Server running on http://localhost:${PORT}`);
  });
}

startServer();
