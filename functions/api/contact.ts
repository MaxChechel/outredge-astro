/**
 * Contact form endpoint — a Cloudflare Pages Function. TEMPLATE.
 *
 * §8. Ships INERT: `sendLead()` refuses to send until a provider is configured,
 * and the form on the page stays visibly disabled until this endpoint is
 * deployed and verified end to end. A form that silently drops submissions is
 * worse than no form, and it is the default state of every unconfigured
 * endpoint, so the default here is to fail loudly instead.
 *
 * Defence in depth, cheapest check first — the order matters, because each one
 * costs more than the last and the expensive one should run least:
 *   1. Honeypot field. Free, and catches naive bots.
 *   2. Time-to-submit floor. A human does not fill seven fields in three seconds.
 *   3. Turnstile, verified SERVER-SIDE. The client widget alone proves nothing:
 *      a bot posts straight to this endpoint and never loads the widget at all.
 *
 * Every key comes from the environment. Nothing secret is ever in this repo.
 */

interface Env {
  /** Cloudflare Turnstile. Required. */
  TURNSTILE_SECRET_KEY: string;
  /** Where leads go, and the verified sender they come from. */
  LEAD_TO: string;
  LEAD_FROM: string;
  /** Present only on the email delivery path. */
  RESEND_API_KEY?: string;
  /** Present only on the CRM delivery path. See the seam in sendLead(). */
  CRM_API_KEY?: string;
  CRM_ENDPOINT?: string;
}

/** PROJECT: the fields this form collects. Kept in one place so the validator,
 *  the email body and the CRM payload cannot drift apart. */
const FIELDS = ['name', 'company', 'email', 'message'] as const;
type Field = (typeof FIELDS)[number];

const REQUIRED: readonly Field[] = ['name', 'email', 'message'];

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** Below this, the submission was not typed by a person. */
const MIN_FILL_MS = 3000;
/** Above this, the timestamp is stale or forged; treat it as absent. */
const MAX_FILL_MS = 1000 * 60 * 60 * 6;

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Typed locally rather than with Cloudflare's `PagesFunction`, which lives in
 * @cloudflare/workers-types — a dependency whose only job here would be one type
 * alias, and which would pull Workers globals into the Astro tsconfig.
 */
interface RequestContext {
  request: Request;
  env: Env;
}

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

// ============================================================================
// THE DELIVERY BOUNDARY (§8)
//
// Everything above this line is validation. Everything below it is delivery, and
// it is ONE FUNCTION on purpose: email today, a CRM tomorrow, both for a while —
// and swapping the hop touches NEITHER THE FORM NOR THE PAGE. Nothing outside
// this file knows or cares where a lead ends up.
//
// A lead is a plain object here, not a form-shaped one, for the same reason the
// content layer has an adapter (§5): the caller should not have to know the
// destination's field names.
// ============================================================================

export interface Lead {
  fields: Record<Field, string>;
  /** For reply-to on email, and for attribution in a CRM. */
  email: string;
  submittedAt: string;
}

type Delivery = { ok: true } | { ok: false; reason: string };

async function sendLead(lead: Lead, env: Env): Promise<Delivery> {
  // --- Path A: email via Resend ------------------------------------------
  if (env.RESEND_API_KEY) {
    const text = FIELDS.map((f) => `${f}: ${lead.fields[f] || '—'}`).join('\n');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.LEAD_FROM,
        to: [env.LEAD_TO],
        reply_to: lead.email,
        subject: `New enquiry from ${lead.fields.name || 'the website'}`,
        text: `${text}\n\nsubmitted: ${lead.submittedAt}`,
      }),
    });
    if (!res.ok) return { ok: false, reason: `resend ${res.status}` };
    return { ok: true };
  }

  // --- Path B: a CRM -----------------------------------------------------
  // The seam, deliberately left visible rather than described in a comment
  // elsewhere. Uncomment, map the fields to the CRM's names, and delete Path A
  // (or keep both and fan out — the boundary makes that a local decision).
  //
  // if (env.CRM_API_KEY && env.CRM_ENDPOINT) {
  //   const res = await fetch(env.CRM_ENDPOINT, {
  //     method: 'POST',
  //     headers: {
  //       authorization: `Bearer ${env.CRM_API_KEY}`,
  //       'content-type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       properties: {
  //         firstname: lead.fields.name,
  //         company: lead.fields.company,
  //         email: lead.email,
  //         message: lead.fields.message,
  //       },
  //     }),
  //   });
  //   if (!res.ok) return { ok: false, reason: `crm ${res.status}` };
  //   return { ok: true };
  // }

  // No provider configured. Refuse loudly — see the note at the top.
  return { ok: false, reason: 'no delivery provider configured' };
}

// ============================================================================

export const onRequestPost = async ({ request, env }: RequestContext): Promise<Response> => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Malformed submission.' }, 400);
  }

  // 1. Honeypot. A real browser never fills a hidden, off-screen field.
  if (String(form.get('company_website') ?? '').trim() !== '') {
    // 200, not 403: a bot that can tell rejection from success learns how to
    // avoid the trap. One that cannot, keeps walking into it.
    return json({ ok: true }, 200);
  }

  // 2. Time floor.
  const started = Number(form.get('started_at') ?? 0);
  const elapsed = Date.now() - started;
  if (!started || elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) {
    return json({ ok: false, error: 'That submission looked automated. Please try again.' }, 400);
  }

  // 3. Turnstile, server-side.
  if (!env.TURNSTILE_SECRET_KEY) {
    return json({ ok: false, error: 'Form is not configured.' }, 503);
  }
  const token = String(form.get('cf-turnstile-response') ?? '');
  if (!token) return json({ ok: false, error: 'Verification missing.' }, 400);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip))) {
    return json({ ok: false, error: 'Verification failed.' }, 403);
  }

  // 4. Validate. Server-side, because `required` in markup is a hint to a
  //    browser, not a constraint on an HTTP request.
  const fields = Object.fromEntries(
    FIELDS.map((f) => [f, String(form.get(f) ?? '').trim()]),
  ) as Record<Field, string>;

  const missing = REQUIRED.filter((f) => !fields[f]);
  if (missing.length) {
    return json({ ok: false, error: `Missing: ${missing.join(', ')}.` }, 400);
  }
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(fields.email)) {
    return json({ ok: false, error: 'That email address does not look right.' }, 400);
  }

  // 5. Deliver, behind the boundary.
  const delivery = await sendLead(
    { fields, email: fields.email, submittedAt: new Date().toISOString() },
    env,
  );
  if (!delivery.ok) {
    console.error('sendLead failed:', delivery.reason);
    return json({ ok: false, error: 'Could not send right now. Please email us directly.' }, 502);
  }

  return json({ ok: true }, 200);
};
