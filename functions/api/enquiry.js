/**
 * POST /api/enquiry — Cloudflare Pages Function behind the enquiry form.
 *
 * Cloudflare Pages has no built-in form handling, so this is what catches the
 * submission and turns it into an email. It fails LOUDLY when it is not
 * configured: a form that reports success while dropping the message on the
 * floor is worse than one that plainly says it is broken.
 *
 * Environment (Cloudflare dashboard → Settings → Variables and Secrets, or
 * `npx wrangler pages secret put NAME`). Recipient addresses live here, never
 * in the page source, which is public:
 *
 *   RESEND_API_KEY  secret  — from resend.com
 *   ENQUIRY_TO      plain   — comma-separated recipients
 *   ENQUIRY_FROM    plain   — e.g. "Casabella <site@casabellaaruba.com>"
 *                             the domain must be verified with Resend
 */

const LIMITS = {
  name: 120,
  email: 200,
  interest: 40,
  phone: 80,
  preferredContact: 80,
  residence: 120,
  page: 80,
  message: 4000
};

const INTERESTS = {
  tower: "Buying at Casabella Tower",
  suites: "Staying at Casabella Suites",
  pipeline: "A project in development",
  land: "Bringing us a plot / partnership",
  other: "Something else"
};

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

async function readFields(request) {
  const type = request.headers.get("content-type") || "";

  if (type.includes("application/json")) return await request.json();

  const form = await request.formData();
  const out = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

const clean = (value, max) => String(value == null ? "" : value).trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  let fields;
  try {
    fields = await readFields(request);
  } catch (err) {
    return json({ ok: false, error: "We could not read that submission." }, 400);
  }

  // Honeypot. Bots fill every field; humans never see this one. Answer 200 so
  // the bot has no signal to tune against, but send nothing.
  if (clean(fields["bot-field"], 200) || clean(fields._gotcha, 200)) {
    return json({ ok: true }, 200);
  }

  const name = clean(fields.name, LIMITS.name);
  const email = clean(fields.email, LIMITS.email);
  const message = clean(fields.message, LIMITS.message);
  const interest = clean(fields.interest, LIMITS.interest);
  const phone = clean(fields.phone, LIMITS.phone);
  const preferredContact = clean(fields.preferredContact, LIMITS.preferredContact);
  const residence = clean(fields.residence, LIMITS.residence);
  const page = clean(fields.page, LIMITS.page);

  if (!name || !email || (!message && interest !== "tower")) {
    return json({ ok: false, error: "Please fill in the required fields." }, 400);
  }

  // Deliberately loose — the strict grammar rejects valid addresses, and a
  // bounced reply is a cheaper failure than a lost enquiry.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "That email address does not look right." }, 400);
  }

  const to = clean(env.ENQUIRY_TO, 500)
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  if (!env.RESEND_API_KEY || !to.length || !env.ENQUIRY_FROM) {
    console.error("enquiry: missing RESEND_API_KEY, ENQUIRY_TO or ENQUIRY_FROM");
    return json(
      { ok: false, error: "The form is not connected yet. Please write to sales@casabellaaruba.com." },
      503
    );
  }

  const subject =
    "Casabella enquiry — " + (INTERESTS[interest] || "Website") + " — " + name;

  const body = [
    "Interest: " + (INTERESTS[interest] || interest || "not stated"),
    "Name:     " + name,
    "Email:    " + email,
    ...(phone ? ["Phone:    " + phone] : []),
    ...(preferredContact ? ["Preferred contact: " + preferredContact] : []),
    ...(residence ? ["Residence: " + residence] : []),
    ...(page ? ["Page:     " + page] : []),
    "",
    message || "No additional message.",
    "",
    "—",
    "Sent from casabellaaruba.com",
    "Country: " + (request.headers.get("cf-ipcountry") || "unknown")
  ].join("\n");

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + env.RESEND_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: env.ENQUIRY_FROM,
        to: to,
        reply_to: email,
        subject: subject,
        text: body
      })
    });
  } catch (err) {
    console.error("enquiry: send threw", err);
    return json({ ok: false, error: "We could not send that just now." }, 502);
  }

  if (!response.ok) {
    console.error("enquiry: resend " + response.status + " " + (await response.text()));
    return json({ ok: false, error: "We could not send that just now." }, 502);
  }

  return json({ ok: true }, 200);
}

// Anything other than POST on this path is a mistake, not a page.
export const onRequest = ({ request, next }) =>
  request.method === "POST"
    ? next()
    : new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
