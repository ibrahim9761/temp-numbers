// server.js
// Backend proxy for the davidcyriltech tempnumber/sms24 API.
// Keeps the API calls server-side (avoids browser CORS issues) and
// normalizes whatever shape the upstream API returns into a stable
// contract the frontend can rely on.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const BASE = "https://apis.davidcyriltech.my.id/tempnumber/sms24";
const NUMBERS_URL = `${BASE}/numbers`;
const INBOX_URL = (number) => `${BASE}/inbox?number=${encodeURIComponent(number)}`;

// Simple timeout wrapper so a slow upstream never hangs a request forever.
async function fetchJson(url, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Upstream did not return JSON (status ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

// ---- Normalizers -----------------------------------------------------
// NOTE: I could not reach apis.davidcyriltech.my.id from the build
// sandbox to inspect a live response, so these normalizers try every
// common shape these "free API" services tend to use. If your real
// response uses different field names, this is the ONLY place you
// need to edit — add the field name to the relevant `||` chain below.

function normalizeNumbers(json) {
  // Confirmed live shape from apis.davidcyriltech.my.id/tempnumber/sms24/numbers:
  // { creator, success, source, result: { numbers: [...], total } }
  let arr = [];
  if (json.result && Array.isArray(json.result.numbers)) arr = json.result.numbers;
  else if (Array.isArray(json.numbers)) arr = json.numbers;
  else if (Array.isArray(json.data)) arr = json.data;
  else if (Array.isArray(json.result)) arr = json.result;
  else if (Array.isArray(json.results)) arr = json.results;
  else if (Array.isArray(json.list)) arr = json.list;

  return arr.map((item) => {
    if (typeof item === "string") return { number: item, country: null, provider: null, raw: item };
    const number =
      item.number || item.phone || item.msisdn || item.phone_number || item.numberId || item.id || "";
    return {
      number: String(number),
      country: item.country || item.country_name || item.countryName || item.range || null,
      provider: item.provider || item.service || item.operator || null,
      raw: item,
    };
  });
}

function normalizeInbox(json) {
  // Confirmed live shape from apis.davidcyriltech.my.id/tempnumber/sms24/inbox:
  // { creator, success, source, result: { number, messages: [...], total } }
  let arr = [];
  if (json.result && Array.isArray(json.result.messages)) arr = json.result.messages;
  else if (Array.isArray(json.messages)) arr = json.messages;
  else if (Array.isArray(json.data)) arr = json.data;
  else if (Array.isArray(json.sms)) arr = json.sms;
  else if (Array.isArray(json.result)) arr = json.result;
  else if (Array.isArray(json.inbox)) arr = json.inbox;

  return arr
    .map((item) => {
      if (typeof item === "string") return { from: "Unknown", text: item, time: null, raw: item };
      return {
        from: item.from || item.sender || item.range || item.service || "Unknown",
        text: item.message || item.text || item.body || item.sms || item.content || "",
        time: item.time || item.date || item.created_at || item.receivedAt || item.timestamp || null,
        raw: item,
      };
    })
    .filter((m) => m.text || m.from !== "Unknown");
}

// ---- Routes ------------------------------------------------------------

app.get("/api/numbers", async (req, res) => {
  try {
    const json = await fetchJson(NUMBERS_URL);
    res.json({ success: true, numbers: normalizeNumbers(json) });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get("/api/inbox", async (req, res) => {
  const number = req.query.number;
  if (!number) {
    return res.status(400).json({ success: false, error: "Missing ?number= query param" });
  }
  try {
    const json = await fetchJson(INBOX_URL(number));
    res.json({ success: true, messages: normalizeInbox(json) });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`TempLine running at http://localhost:${PORT}`);
});
