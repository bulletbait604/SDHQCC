/** Notify staff when the in-app contact form is submitted (Resend API). */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const DEFAULT_NOTIFY_EMAIL = 'bulletbait604@gmail.com'

export type ContactNotifyResult = { sent: true } | { sent: false; reason: string }

export async function sendContactStaffEmail(opts: {
  kickUsername: string
  replyEmail: string
  message: string
}): Promise<ContactNotifyResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const to = process.env.FEEDBACK_NOTIFY_EMAIL?.trim() || DEFAULT_NOTIFY_EMAIL
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'SDHQ Creator Corner <onboarding@resend.dev>'

  if (!apiKey) {
    console.warn('[feedback] RESEND_API_KEY is not set; staff email notification skipped.')
    return { sent: false, reason: 'missing_api_key' }
  }

  const subject = `[SDHQ Contact] @${opts.kickUsername}`
  const html = `
<p><strong>Kick username:</strong> ${escapeHtml(opts.kickUsername)}</p>
<p><strong>Reply-to address:</strong> ${escapeHtml(opts.replyEmail)}</p>
<p><strong>Message:</strong></p>
<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;">${escapeHtml(opts.message)}</pre>
<hr />
<p style="color:#666;font-size:12px;">Reply in your mail client to reach this user directly.</p>
`.trim()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: opts.replyEmail,
      subject,
      html,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as { message?: string }

  if (!res.ok) {
    console.error('[feedback] Resend failed:', res.status, data)
    return {
      sent: false,
      reason: typeof data.message === 'string' ? data.message : `http_${res.status}`,
    }
  }

  return { sent: true }
}
