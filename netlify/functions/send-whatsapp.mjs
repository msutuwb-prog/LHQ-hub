// Sends a quote/invoice PDF to a parent on WhatsApp through Meta's WhatsApp Cloud API,
// using LHQ's approved message template (document header + 6 body variables).
//
// Required environment variables (Netlify → Site configuration → Environment variables):
//   WA_TOKEN             permanent access token for a System User in Meta Business Suite
//   WA_PHONE_NUMBER_ID   the Phone Number ID of LHQ's WhatsApp number (from WhatsApp Manager / API Setup)
//   APP_ACCESS_CODE      same staff code used for email
// Optional:
//   WA_TEMPLATE          approved template for quotes & invoices (default: lhq_tutoring_document)
//   WA_RECEIPT_TEMPLATE  approved template for receipts (default: lhq_tutoring_receipt)
//   WA_TEMPLATE_LANG     template language code (default: en)
//   WA_BUSINESS_ACCOUNT_ID  WhatsApp Business Account ID; lets the app preview the template wording
//   WA_API_VERSION       Graph API version (default: v23.0)
//
// Template body variables, in order:
//   quotes & invoices: {{1}} parent name  {{2}} quote/invoice  {{3}} number  {{4}} being payment for  {{5}} total  {{6}} balance
//   receipts:          {{1}} parent name  {{2}} amount received  {{3}} being payment for  {{4}} receipt number  {{5}} balance remaining

const MAX_PDF_BYTES = 8 * 1024 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const env = (k, d = "") => (process.env[k] || d).trim();
const graph = (path) => `https://graph.facebook.com/${env("WA_API_VERSION", "v23.0")}/${path}`;
const auth = () => ({ authorization: `Bearer ${env("WA_TOKEN")}` });

// WhatsApp template variables can't contain new lines, tabs or more than 4 spaces in a row, and can't be empty.
const param = (v, fallback = "-") => {
  const s = String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 300);
  return { type: "text", text: s || fallback };
};

function normaliseNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "265" + d.slice(1); // local Malawi number
  else if (d.length === 9) d = "265" + d;
  return d;
}

function explain(err) {
  const e = (err && err.error) || {};
  const code = e.code;
  const map = {
    190: "WhatsApp access has expired or is wrong. Update WA_TOKEN in Netlify.",
    10: "The WhatsApp token doesn't have permission to send messages. Give the System User the whatsapp_business_messaging permission.",
    200: "The WhatsApp token doesn't have permission to send messages. Give the System User the whatsapp_business_messaging permission.",
    131030: "This number isn't on the test recipient list. Add it in WhatsApp Manager, or finish moving the number to live mode.",
    131026: "WhatsApp couldn't deliver to this number. Check it's the parent's WhatsApp number.",
    132000: "The template's variables don't match. The quote/invoice template needs 6 variables and the receipt template 5, each with a Document header.",
    132001: `A WhatsApp template (${templateName("document")} or ${templateName("receipt")}, language ${env("WA_TEMPLATE_LANG", "en")}) wasn't found or isn't approved yet.`,
    132012: "The template's header must be set to Document.",
    131047: "WhatsApp only allows a template message here. Check WA_TEMPLATE is set to an approved template.",
    131056: "Too many messages to this number in a short time. Wait a minute and try again.",
    133010: "LHQ's WhatsApp number isn't registered with the Cloud API yet. Finish registration in WhatsApp Manager.",
    368: "Meta has temporarily restricted this WhatsApp account. Check WhatsApp Manager for details.",
  };
  return map[code] || (e.error_user_msg || e.message ? `WhatsApp said: ${e.error_user_msg || e.message}` : "The WhatsApp message couldn't be sent. Try again in a minute.");
}

const TEMPLATES = {
  document: { env: "WA_TEMPLATE", def: "lhq_tutoring_document", count: 6, fallbacks: ["Parent/Guardian", "quote", "-", "-", "0.00", "0.00"] },
  receipt: { env: "WA_RECEIPT_TEMPLATE", def: "lhq_tutoring_receipt", count: 5, fallbacks: ["Parent/Guardian", "0.00", "-", "-", "0.00"] },
};
const templateName = (kind) => env(TEMPLATES[kind].env, TEMPLATES[kind].def);

async function templatePreview(kind = "document") {
  const waba = env("WA_BUSINESS_ACCOUNT_ID");
  if (!waba) return null;
  try {
    const name = templateName(kind);
    const r = await fetch(graph(`${waba}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,language,components`), { headers: auth() });
    const j = await r.json();
    const t = (j.data || []).find((x) => x.language === env("WA_TEMPLATE_LANG", "en")) || (j.data || [])[0];
    if (!t) return null;
    const part = (type) => (t.components || []).find((c) => c.type === type);
    return { status: t.status, body: part("BODY")?.text || "", footer: part("FOOTER")?.text || "", header: part("HEADER")?.format || "" };
  } catch {
    return null;
  }
}

export default async (req) => {
  const configured = Boolean(env("WA_TOKEN") && env("WA_PHONE_NUMBER_ID") && env("APP_ACCESS_CODE"));

  if (req.method === "GET") {
    if (!configured) return json({ configured: false });
    let from = null, verifiedName = null, tokenOk = true;
    try {
      const r = await fetch(graph(`${env("WA_PHONE_NUMBER_ID")}?fields=display_phone_number,verified_name`), { headers: auth() });
      const j = await r.json();
      if (!r.ok) tokenOk = false;
      from = j.display_phone_number || null;
      verifiedName = j.verified_name || null;
    } catch {
      tokenOk = false;
    }
    const [preview, receiptPreview] = tokenOk ? await Promise.all([templatePreview("document"), templatePreview("receipt")]) : [null, null];
    return json({ configured: true, tokenOk, from, verifiedName, template: templateName("document"), receiptTemplate: templateName("receipt"), preview, receiptPreview });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!configured) return json({ error: "WhatsApp sending isn't set up yet. Add WA_TOKEN and WA_PHONE_NUMBER_ID in Netlify." }, 503);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "The request couldn't be read." }, 400);
  }
  if (String(body.code || "") !== env("APP_ACCESS_CODE")) {
    return json({ error: "The access code is wrong. Check it under Sending in the app." }, 401);
  }

  const to = normaliseNumber(body.to);
  if (to.length < 10 || to.length > 15) return json({ error: "Add the parent's WhatsApp number, e.g. 0991 234 567." }, 400);

  const pdf = Buffer.from(String(body.pdfBase64 || ""), "base64");
  if (!pdf.length) return json({ error: "The PDF is missing." }, 400);
  if (pdf.length > MAX_PDF_BYTES) return json({ error: "The PDF is too large to send." }, 413);
  if (pdf.subarray(0, 4).toString() !== "%PDF") return json({ error: "The attachment isn't a valid PDF." }, 400);
  let filename = String(body.filename || "LHQ Tutoring Quote.pdf").replace(/[\\/:*?"<>|\r\n]/g, "").slice(0, 150);
  if (!filename.toLowerCase().endsWith(".pdf")) filename += ".pdf";

  const kind = body.kind === "receipt" ? "receipt" : "document";
  const spec = TEMPLATES[kind];
  // Values for the numbered placeholders, in order. (Older app versions sent a `vars` object.)
  let values = Array.isArray(body.params) ? body.params : null;
  if (!values) { const v = body.vars || {}; values = [v.name, v.type, v.number, v.for, v.total, v.balance]; }
  values = Array.from({ length: spec.count }, (_, i) => values[i]);
  const phoneId = env("WA_PHONE_NUMBER_ID");

  // 1. Upload the PDF to WhatsApp's media store
  let mediaId;
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    form.append("file", new Blob([pdf], { type: "application/pdf" }), filename);
    const r = await fetch(graph(`${phoneId}/media`), { method: "POST", headers: auth(), body: form });
    const j = await r.json();
    if (!r.ok || !j.id) return json({ error: explain(j) }, 502);
    mediaId = j.id;
  } catch (e) {
    console.error("media upload failed:", e && e.message);
    return json({ error: "The PDF couldn't be uploaded to WhatsApp. Try again in a minute." }, 502);
  }

  // 2. Send the approved template with the PDF as its document header
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName(kind),
        language: { code: env("WA_TEMPLATE_LANG", "en") },
        components: [
          { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename } }] },
          { type: "body", parameters: values.map((val, i) => param(val, spec.fallbacks[i])) },
        ],
      },
    };
    const r = await fetch(graph(`${phoneId}/messages`), {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error("send failed:", JSON.stringify(j.error || j));
      return json({ error: explain(j) }, 502);
    }
    return json({ ok: true, to, messageId: j.messages?.[0]?.id, status: j.messages?.[0]?.message_status || "accepted" });
  } catch (e) {
    console.error("send failed:", e && e.message);
    return json({ error: "The WhatsApp message couldn't be sent. Try again in a minute." }, 502);
  }
};

export const config = { path: "/api/send-whatsapp" };
