import "dotenv/config";

// notify.js
// Central notification engine.
// If TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are set
// in .env, REAL SMS messages and voice calls are sent via Twilio.
// If credentials are missing or fail → safe fallback with clear status reporting.
// NEVER log TWILIO_AUTH_TOKEN.

const TWILIO_SID        = process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.trim() : "";
const TWILIO_TOKEN      = process.env.TWILIO_AUTH_TOKEN ? process.env.TWILIO_AUTH_TOKEN.trim() : "";
const TWILIO_FROM       = process.env.TWILIO_FROM_NUMBER ? process.env.TWILIO_FROM_NUMBER.replace(/[\s-]/g, "").trim() : "";
const TWILIO_CALL_FROM  = (process.env.TWILIO_CALL_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || "").replace(/[\s-]/g, "").trim();
const TWILIO_CALL_URL   = process.env.TWILIO_CALL_WEBHOOK_URL ? process.env.TWILIO_CALL_WEBHOOK_URL.trim() : "";
const FAST2SMS_KEY      = process.env.FAST2SMS_API_KEY ? process.env.FAST2SMS_API_KEY.trim() : "";

const hasTwilio = !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);
if (FAST2SMS_KEY) {
  console.log(`[Fast2SMS] ✅ Fast2SMS Indian SMS Gateway configured.`);
}

let twilioClient = null;

if (hasTwilio) {
  try {
    const twilio = (await import("twilio")).default;
    twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
    console.log(`[Twilio] ✅ Twilio initialised.`);
    console.log(`[Twilio]    SMS FROM  : ${TWILIO_FROM}`);
    console.log(`[Twilio]    CALL FROM : ${TWILIO_CALL_FROM}`);
    console.log(`[Twilio]    CALL URL  : ${TWILIO_CALL_URL || "(inline TwiML fallback)"}`);
  } catch (err) {
    console.warn("[Twilio] ⚠️  Could not load twilio package:", err.message);
  }
} else {
  console.warn("[Twilio] ⚠️  DEMO MODE — Twilio credentials not set in .env.");
}

// ---------------------------------------------------------------------------
// Normalize phone numbers to E.164 standard (e.g. +91XXXXXXXXXX)
// ---------------------------------------------------------------------------
export function formatE164(phone, defaultCountry = "+91") {
  if (!phone) return "";
  let clean = String(phone).trim().replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) return clean;
  if (clean.startsWith("00")) return "+" + clean.slice(2);
  if (clean.startsWith("0") && clean.length === 11) return defaultCountry + clean.slice(1);
  if (clean.length === 10) return defaultCountry + clean;
  return clean.startsWith("+") ? clean : defaultCountry + clean;
}

// ---------------------------------------------------------------------------
// Build the SOS SMS body
// ---------------------------------------------------------------------------
export function buildSmsBody(userName, lat, lng) {
  const mapsUrl = (lat && lng)
    ? `https://maps.google.com/?q=${lat},${lng}`
    : null;

  return [
    "🚨 SOS EMERGENCY ALERT 🚨",
    "",
    `${userName || "A user"} triggered SOS and needs immediate assistance!`,
    "",
    mapsUrl ? `📍 Live GPS Location:\n${mapsUrl}` : "📍 GPS Location: Unavailable",
    lat && lng ? `Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "",
    "",
    "Automated emergency voice call is also being dispatched.",
    "— Women Protection System (Guardian)"
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Send SMS
// Returns: { ok, mode, to, sid?, status?, error? }
// ---------------------------------------------------------------------------
export async function sendSms(toNumber, body) {
  const formatted = formatE164(toNumber);
  const smsText = encodeURIComponent(body);
  const smsLink = `sms:${formatted}?body=${smsText}`;
  const waLink = `https://wa.me/${formatted.replace("+", "")}?text=${smsText}`;

  // 1. Try Fast2SMS for Indian (+91) numbers if configured
  if (FAST2SMS_KEY) {
    const clean10 = String(toNumber).replace(/\D/g, "").slice(-10);
    if (clean10.length === 10) {
      try {
        console.log(`[Fast2SMS] 🚀 Dispatching real SMS to ${clean10}...`);
        const f2Res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": FAST2SMS_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "q",
            message: body,
            language: "english",
            flash: 0,
            numbers: clean10
          })
        });
        const f2Data = await f2Res.json();
        if (f2Data.return === true) {
          console.log(`[Fast2SMS ✅ REAL SMS DELIVERED] → ${clean10}`, f2Data.message);
          return { ok: true, mode: "live", provider: "fast2sms", to: formatted, status: "delivered", smsLink, waLink };
        } else {
          console.warn(`[Fast2SMS Notice] ${clean10}: [Code ${f2Data.status_code}] ${f2Data.message}`);
        }
      } catch (f2Err) {
        console.error(`[Fast2SMS Error] ${f2Err.message}`);
      }
    }
  }

  // 2. Fall back to Twilio
  if (!twilioClient) {
    console.log(`[SMS DEMO] → ${formatted || toNumber}`);
    return {
      ok: false,
      mode: "demo",
      to: formatted || toNumber,
      status: "simulated",
      smsLink,
      waLink
    };
  }

  try {
    const msg = await twilioClient.messages.create({
      to:   formatted,
      from: TWILIO_FROM,
      body
    });
    console.log(`[Twilio SMS ✅] → ${formatted}  SID=${msg.sid}  Status=${msg.status}`);
    return { ok: true, mode: "live", to: formatted, sid: msg.sid, status: msg.status, smsLink, waLink };
  } catch (err) {
    console.error(`[Twilio SMS ✗] → ${formatted}  Error: ${err.message}`);
    return {
      ok: false,
      mode: "live",
      to: formatted,
      error: err.message,
      smsLink,
      waLink
    };
  }
}

// ---------------------------------------------------------------------------
// Place automated voice call
// Returns: { ok, mode, to, sid?, status?, error?, callLink? }
// ---------------------------------------------------------------------------
export async function placeCall(toNumber, twimlMessage) {
  const formatted = formatE164(toNumber);
  const callLink = `tel:${formatted}`;

  // 1. Try Fast2SMS Voice Route for Indian numbers
  if (FAST2SMS_KEY) {
    const clean10 = String(toNumber).replace(/\D/g, "").slice(-10);
    if (clean10.length === 10) {
      try {
        console.log(`[Fast2SMS] 📞 Dispatching voice call to ${clean10}...`);
        const vRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": FAST2SMS_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "otp_voice",
            variables_values: "112",
            numbers: clean10
          })
        });
        const vData = await vRes.json();
        if (vData.return === true) {
          console.log(`[Fast2SMS ✅ REAL VOICE CALL PLACED] → ${clean10}`);
          return { ok: true, mode: "live", provider: "fast2sms", to: formatted, status: "completed", callLink };
        } else {
          console.warn(`[Fast2SMS Voice Notice] ${clean10}: [Code ${vData.status_code}] ${vData.message}`);
        }
      } catch (vErr) {
        console.error(`[Fast2SMS Voice Error] ${vErr.message}`);
      }
    }
  }

  // 2. Fall back to Twilio
  if (!twilioClient) {
    console.log(`[CALL DEMO] → ${formatted || toNumber}`);
    return {
      ok: false,
      mode: "demo",
      to: formatted || toNumber,
      status: "simulated",
      callLink
    };
  }

  try {
    // Use TWILIO_CALL_FROM_NUMBER (US number) + TWILIO_CALL_WEBHOOK_URL
    // This matches the working curl command exactly:
    //   From: +17372508034  (US Twilio number — no Indian DLT restrictions)
    //   Url:  TWILIO_CALL_WEBHOOK_URL (Twilio voice webhook)
    const callParams = {
      to:   formatted,
      from: TWILIO_CALL_FROM,
      url:  TWILIO_CALL_URL || `https://handler.twilio.com/twiml/EHb9314e86d6e59bfa6dbc94ba46c03f0f`
    };

    console.log(`[CALL] → ${formatted}  from=${TWILIO_CALL_FROM}  url=${callParams.url}`);
    const call = await twilioClient.calls.create(callParams);
    console.log(`[CALL ✅] → ${formatted}  SID=${call.sid}  Status=${call.status}`);
    return { ok: true, mode: "live", to: formatted, sid: call.sid, status: call.status, callLink };
  } catch (err) {
    console.error(`[CALL ✗] → ${formatted}  Error: ${err.message}`);
    // Provide click-to-call fallback info when Twilio call fails
    return {
      ok: false,
      mode: "live",
      to: formatted,
      error: err.message,
      callLink
    };
  }
}

// ---------------------------------------------------------------------------
// isDemoMode — lets routes include a hint in their response
// ---------------------------------------------------------------------------
export function isDemoMode() {
  return !hasTwilio || !twilioClient;
}

// ---------------------------------------------------------------------------
// emergencyNumbers — local police/ambulance numbers
// ---------------------------------------------------------------------------
export function emergencyNumbers() {
  return {
    police:        process.env.EMERGENCY_POLICE_NUMBER  || "100",
    ambulance:     process.env.EMERGENCY_AMBULANCE_NUMBER || "108",
    womenHelpline: process.env.EMERGENCY_WOMEN_HELPLINE || "1091"
  };
}
