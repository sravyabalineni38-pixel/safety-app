import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { emergencyNumbers, buildSmsBody, sendSms, placeCall } from "../notify.js";

const router = Router();
const Chats = collection("aiChats");
const Users = collection("users");

// ---------------------------------------------------------------------------
// Smart reply engine — knows all app features, can trigger real actions
// ---------------------------------------------------------------------------
function buildReply(message, user) {
  const m = message.toLowerCase().trim();
  const nums = emergencyNumbers();
  const contacts = user?.emergencyContacts || [];
  const contactNames = contacts.map(c => c.name).join(", ");
  const contactCount = contacts.length;

  // GREETINGS
  if (/^(hi|hello|hey|hii|namaste|hai)\b/.test(m)) {
    return {
      text: `Hello! 👋 I'm your Guardian safety assistant. You can ask me about:\n\n• 🆘 SOS alerts & trusted contacts\n• 🗺️ Safe route navigation\n• ⏱️ Safety timer\n• 📍 Unsafe area reporting\n• ⌚ Wearable device\n• 🔋 Battery monitoring\n• 🩸 Period tracker\n• 📖 Emergency history\n\nOr say "trigger SOS" or "call [name]" and I'll do it for you!`
    };
  }

  // AM I SAFE
  if (/(am i safe|iam safe|i am safe|safe or not|am safe)/.test(m)) {
    return {
      text: contactCount > 0
        ? `✅ Guardian is active!\n\nYou have ${contactCount} trusted contact(s) ready: ${contactNames}\n\nIf you feel unsafe, say "trigger SOS" or tap the red SOS button on the Home screen — they'll be alerted with your live location instantly.`
        : `⚠️ Guardian is active, but you have NO trusted contacts saved!\n\nGo to the Contacts tab and add at least one trusted contact. Without contacts, SOS alerts can't reach anyone.`
    };
  }

  // SOS TRIGGER REQUEST
  if (/(trigger sos|send sos|press sos|activate sos|i'm in danger|i am in danger|help me now|someone is following|i need help now|emergency help)/.test(m)) {
    if (contactCount === 0) {
      return { text: `⚠️ No trusted contacts found! I can't send SOS without contacts.\n\nGo to the Contacts tab → Add Contact → enter their name & phone number.\n\nThen say "trigger SOS" again!` };
    }
    return {
      text: `🚨 SOS alert ready to trigger!\n\nThis will send emergency SMS + voice call to:\n📞 ${contactNames}\n\nSay "yes confirm SOS" to dispatch immediately, or tap the SOS button on Home screen.`,
      action: "CONFIRM_SOS"
    };
  }

  if (/(yes confirm sos|confirm sos|yes send|yes trigger|haan)/.test(m)) {
    return {
      text: `✅ Dispatching SOS alerts now to all ${contactCount} contact(s)!\n\nCheck the Home screen for real-time delivery status. Each contact receives:\n📱 SMS with your live GPS location & Google Maps link\n📞 Automated voice call\n\nStay calm and move to safety.`,
      action: "TRIGGER_SOS"
    };
  }

  // CALL A CONTACT
  const callMatch = m.match(/call (?:my )?(.+?)(?:\s+(?:now|please|for me))?$/);
  if (callMatch || /(call my contact|call mom|call dad|call someone|who can i call)/.test(m)) {
    if (contactCount === 0) {
      return { text: "You have no trusted contacts saved. Go to Contacts tab and add contacts with phone numbers first." };
    }
    const name = callMatch?.[1]?.trim();
    const matched = name ? contacts.find(c => c.name.toLowerCase().includes(name.toLowerCase())) : null;
    if (matched) {
      return {
        text: `📞 Calling ${matched.name} (${matched.phone}) via SOS system...\n\nTriggering emergency call now. You can also call directly: ${matched.phone}`,
        action: "TRIGGER_SOS",
        targetContact: matched
      };
    }
    const list = contacts.map((c, i) => `${i + 1}. ${c.name} — ${c.relation} — ${c.phone}`).join("\n");
    return { text: `📞 Your trusted contacts:\n\n${list}\n\nSay "call [name]" to call a specific person.` };
  }

  // CONTACTS INFO
  if (/(contact|trusted|who will|who gets|emergency contact|my contact)/.test(m)) {
    if (contactCount === 0) {
      return { text: "You haven't added any trusted contacts yet.\n\n➡️ Go to Contacts tab → Add Contact → enter their name, phone, and relationship.\n\nOnce added, they'll get SMS + voice calls when you trigger SOS." };
    }
    const list = contacts.map((c, i) => `${i + 1}. ${c.name} — ${c.relation} — ${c.phone}`).join("\n");
    return { text: `👥 Your ${contactCount} trusted contact(s):\n\n${list}\n\nAll of them get SMS + voice call when SOS is triggered. Go to Contacts tab to add or remove contacts.` };
  }

  // HOW DOES SOS WORK
  if (/(how.*sos|sos.*work|what.*sos|what happens when|sos ela|sos kaise)/.test(m)) {
    return {
      text: `🆘 How SOS Works:\n\n1. Tap the big red SOS button on Home screen\n2. Guardian gets your live GPS location\n3. Sends emergency SMS to all ${contactCount > 0 ? contactCount : "your"} contacts with Google Maps link\n4. Places automated voice call to each contact\n5. Real-time delivery status shown for each contact\n\nSMS includes: Your name, live location, Google Maps link\nVoice call says: "Emergency alert — [your name] needs urgent help"\n\nTap "I'm Safe ✓" when you're safe to resolve the alert.`
    };
  }

  // SAFE ROUTE
  if (/(route|navigate|navigation|path|walk|walking|way home|going home|safe way|direction)/.test(m)) {
    return { text: `🗺️ Safe Route Navigation:\n\nGo to Safe Route from the left menu:\n1. Enter your start location\n2. Enter your destination\n3. Tap "Get Safe Route"\n\nThe AI suggests a path avoiding recently reported unsafe areas. Risk levels (low/medium/high) are shown along the route.\n\nYou can also report unsafe spots to help others!` };
  }

  // UNSAFE AREAS
  if (/(unsafe|dangerous|report.*area|area.*report|spot|crime|incident)/.test(m)) {
    return { text: `⚠️ Unsafe Area Reporting:\n\nGo to Unsafe Areas from the menu to:\n• View a live map of reported unsafe spots near you\n• Report a new unsafe area (dark alleys, crime spots)\n• Upvote reports to warn others\n\nThis community data is used by Safe Route to automatically avoid dangerous areas.` };
  }

  // SAFETY TIMER
  if (/(timer|check.?in|checkin|set.*timer|safety timer|alone.*timer|late night)/.test(m)) {
    return { text: `⏱️ Safety Timer:\n\nPerfect when going somewhere alone!\n\nHow it works:\n1. Go to Timer tab\n2. Set a duration (e.g., 30 minutes)\n3. Tap "Start Timer"\n4. Check in before time runs out\n\nIf you DON'T check in → Guardian automatically sends your location to all trusted contacts. No action needed from you!\n\nUse it for: walking home late, meeting strangers, solo trips.` };
  }

  // FALL DETECTION
  if (/(fall|fell|faint|fainted|collapse|accident|hurt|injured)/.test(m)) {
    return { text: `🤕 Fall Detection:\n\nIf your wearable detects a hard fall:\n• Guardian auto-alerts all trusted contacts\n• Your GPS location is shared\n• You have a short window to press "I'm OK" to cancel\n\nYou can also manually log a fall from Fall Alerts tab.\n\nIf you're hurt right now, call ambulance: ${nums.ambulance} or say "trigger SOS"!` };
  }

  // WEARABLE
  if (/(wearable|band|device|smartwatch|watch|sensor|pair|connect device)/.test(m)) {
    return { text: `⌚ Wearable Device:\n\nGo to Wearable tab to:\n1. Pair your safety band / smartwatch\n2. Sync it with Guardian\n\nWhat the wearable does:\n• Physical SOS button triggers emergency alert\n• Fall sensor auto-alerts contacts\n• Real-time sync with Guardian` };
  }

  // BATTERY
  if (/(battery|charge|low power|dying|phone dying)/.test(m)) {
    return { text: `🔋 Battery Monitoring:\n\nGuardian monitors your battery in the Battery tab.\n\nAlerts:\n• When battery drops below 15%, Guardian can notify your trusted contacts so they know your phone may go offline\n• Battery history shows your charging patterns\n\nTip: Keep phone above 20% when going out at night — a dead phone means no SOS!` };
  }

  // PERIOD TRACKER
  if (/(period|cycle|menstrual|cramps|pms|flow|fertile|ovulation)/.test(m)) {
    return { text: `🩸 Period Tracker:\n\nGo to Period Tracker tab to:\n• Log period start/end dates and symptoms\n• Track flow intensity and cramps\n• See predictions for next cycle and fertile window\n\nAll period data is private and only visible to you.` };
  }

  // HISTORY
  if (/(history|past|previous|log|record|what happened|past event)/.test(m)) {
    return { text: `📋 Emergency History:\n\nThe History tab shows a complete timeline of:\n• All past SOS alerts\n• Fall detection events\n• Safety timer expirations\n• Who was notified and delivery status (SMS sent/failed, calls placed)\n\nUseful for reviewing what happened during emergencies.` };
  }

  // SHARE LOCATION
  if (/(share.*location|live location|location link|track me|send location)/.test(m)) {
    return { text: `📍 Share Live Location:\n\nOn the Home screen, tap "Share Live Location Link" to generate a unique tracking URL.\n\nShare this link with anyone — they can see your real-time location in any browser, without needing the Guardian app!\n\nPerfect for: letting family track you during commutes or travel.` };
  }

  // POLICE / HELPLINE
  if (/(police|ambulance|hospital|helpline|1091|emergency service|dial|call police)/.test(m)) {
    return { text: `🚨 Emergency Services (India):\n\n• 🚔 Police: ${nums.police}\n• 🚑 Ambulance: ${nums.ambulance}\n• 👩 Women's Helpline: ${nums.womenHelpline}\n\nFor immediate help, call ${nums.police} right now.\nOr say "trigger SOS" to alert your personal trusted contacts.` };
  }

  // THANK YOU
  if (/(thank|thanks|ok thanks|shukriya|nandri)/.test(m)) {
    return { text: "You're welcome! 💜 Stay safe. I'm always here if you need me. One tap on SOS and your entire trusted network is alerted instantly!" };
  }

  // DEFAULT
  return {
    text: `I'm your Guardian safety assistant 🛡️\n\nI can help with:\n• "trigger SOS" — Send emergency alert to ${contactCount > 0 ? `your ${contactCount} contact(s)` : "your contacts"}\n• "call [name]" — Call a specific contact\n• "show my contacts" — List trusted contacts\n• "how does SOS work" — SOS explanation\n• "safe route" — Navigation help\n• "safety timer" — Timer setup\n• "I feel unsafe" — Immediate help\n• "battery", "wearable", "period tracker" — Feature guides\n\nWhat do you need help with?`
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
router.get("/history", requireAuth, (req, res) => {
  const chat = Chats.findOne((c) => c.userId === req.user.id);
  res.json({ messages: chat?.messages || [] });
});

router.post("/message", requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required." });

  const user = Users.findOne((u) => u.id === req.user.id);
  const { text, action, targetContact } = buildReply(message, user);

  let actionResult = null;

  // Execute real actions
  if (action === "TRIGGER_SOS") {
    try {
      const contacts = targetContact ? [targetContact] : (user?.emergencyContacts || []);
      if (contacts.length > 0) {
        const smsBody = buildSmsBody(user?.name || "Guardian User", null, null);
        const callMessage = `Emergency alert. ${user?.name || "A Guardian user"} needs urgent assistance. Please check on them immediately.`;
        const results = [];
        for (const c of contacts) {
          const sms  = await sendSms(c.phone, smsBody);
          const call = await placeCall(c.phone, callMessage);
          results.push({ contact: c, sms, call });
        }
        actionResult = { type: "SOS_SENT", results };
      }
    } catch (e) {
      actionResult = { type: "SOS_ERROR", error: e.message };
    }
  }

  const userMsg = { role: "user", text: message, at: new Date().toISOString() };
  const botMsg  = { role: "assistant", text, action: action || null, actionResult, at: new Date().toISOString() };

  let chat = Chats.findOne((c) => c.userId === req.user.id);
  if (!chat) {
    Chats.insert({ id: nanoid(), userId: req.user.id, messages: [userMsg, botMsg] });
  } else {
    Chats.update(chat.id, { messages: [...chat.messages, userMsg, botMsg] });
  }

  res.json({ reply: botMsg });
});

router.delete("/history", requireAuth, (req, res) => {
  const chat = Chats.findOne((c) => c.userId === req.user.id);
  if (chat) Chats.update(chat.id, { messages: [] });
  res.json({ ok: true });
});

export default router;




