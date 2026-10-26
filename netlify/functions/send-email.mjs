// Sends a quote/invoice PDF by email from LHQ's Gmail account.
//
// Required environment variables (Netlify → Site configuration → Environment variables):
//   GMAIL_USER          the Gmail address to send from, e.g. learnhqes@gmail.com
//   GMAIL_APP_PASSWORD  a 16-character Google App Password for that account (not the normal password)
//   APP_ACCESS_CODE     a code staff type into the app once, so strangers can't use this to send email
// Optional:
//   FROM_NAME           display name on sent emails (default: LHQ Learning Solutions)

import nodemailer from "nodemailer";

const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const env = (k) => (process.env[k] || "").trim();

function splitAddresses(value) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function textToHtml(text) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const paras = String(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`);
  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d2433">${paras.join("")}</div>`;
}

export default async (req) => {
  const configured = Boolean(env("GMAIL_USER") && env("GMAIL_APP_PASSWORD") && env("APP_ACCESS_CODE"));

  // The app calls GET to find out whether email sending has been set up.
  if (req.method === "GET") {
    return json({ configured, from: configured ? env("GMAIL_USER") : null });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!configured) {
    return json({ error: "Email sending isn't set up yet. Add GMAIL_USER, GMAIL_APP_PASSWORD and APP_ACCESS_CODE in Netlify." }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "The request couldn't be read." }, 400);
  }

  if (String(body.code || "") !== env("APP_ACCESS_CODE")) {
    return json({ error: "The access code is wrong. Check it under Email sending in the app." }, 401);
  }

  const to = splitAddresses(body.to);
  const cc = splitAddresses(body.cc);
  if (!to.length) return json({ error: "Add the recipient's email address." }, 400);
  if (to.length + cc.length > 5) return json({ error: "Send to at most 5 addresses at a time." }, 400);
  const bad = [...to, ...cc].find((a) => !EMAIL_RE.test(a));
  if (bad) return json({ error: `"${bad}" doesn't look like an email address.` }, 400);

  const subject = String(body.subject || "").slice(0, 200).trim();
  const text = String(body.text || "").slice(0, 20000);
  if (!subject) return json({ error: "Add a subject line." }, 400);

  let attachments = [];
  if (body.pdfBase64) {
    const content = Buffer.from(String(body.pdfBase64), "base64");
    if (content.length > MAX_PDF_BYTES) return json({ error: "The PDF is too large to email." }, 413);
    if (content.subarray(0, 4).toString() !== "%PDF") return json({ error: "The attachment isn't a valid PDF." }, 400);
    const filename = (String(body.filename || "LHQ Tutoring Quote.pdf").replace(/[\\/:*?"<>|\r\n]/g, "").slice(0, 150) || "LHQ Tutoring Quote") ;
    attachments.push({
      filename: filename.toLowerCase().endsWith(".pdf") ? filename : filename + ".pdf",
      content,
      contentType: "application/pdf",
    });
  }

  const user = env("GMAIL_USER");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: env("GMAIL_APP_PASSWORD").replace(/\s+/g, "") },
  });

  try {
    const info = await transporter.sendMail({
      from: { name: env("FROM_NAME") || "LHQ Learning Solutions", address: user },
      replyTo: user,
      to,
      cc: cc.length ? cc : undefined,
      subject,
      text,
      html: textToHtml(text),
      attachments,
    });
    return json({ ok: true, messageId: info.messageId, to, cc });
  } catch (err) {
    console.error("sendMail failed:", err && err.message);
    const authFail = err && (err.code === "EAUTH" || /auth|credentials|password/i.test(err.message || ""));
    return json(
      {
        error: authFail
          ? "Gmail rejected the login. Check GMAIL_USER and GMAIL_APP_PASSWORD in Netlify."
          : "The email couldn't be sent. Try again in a minute.",
      },
      502
    );
  }
};

export const config = { path: "/api/send-email" };
