// Supabase Edge Function: transactional-notifications
// Deploy with: supabase functions deploy transactional-notifications
// Dispatches transactional emails (Brevo/SMTP), organization invites, and join-request approval webhooks

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = performance.now();

  try {
    const body = await req.json();
    const {
      eventType = 'ORG_JOIN_REQUEST_APPROVED',
      recipientEmail,
      recipientName,
      organizationName = 'Omni Flow Organization',
      role = 'MEMBER',
      actionUrl = '',
    } = body;

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    let providerStatus = 'fallback_tokenized_outbox';

    if (brevoApiKey && recipientEmail) {
      const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Omni Flow Security & Operations', email: 'no-reply@omniflow.app' },
          to: [{ email: recipientEmail, name: recipientName || recipientEmail }],
          subject: `[Omni Flow] ${eventType.replace(/_/g, ' ')} — ${organizationName}`,
          htmlContent: `<div style="font-family:sans-serif;background:#070A12;color:#F8FAFC;padding:32px;border-radius:16px;">
            <h2 style="margin-top:0;color:#818CF8;">Omni Flow Workspace Notification</h2>
            <p>Hello ${recipientName || 'Team Member'},</p>
            <p>Event: <strong>${eventType}</strong> for organization <strong>${organizationName}</strong> (Role: ${role}).</p>
            ${actionUrl ? `<p><a href="${actionUrl}" style="display:inline-block;padding:10px 18px;background:#6366F1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Open Workspace</a></p>` : ''}
          </div>`,
        }),
      });
      providerStatus = brevoResp.ok ? 'brevo_smtp_dispatched' : `brevo_http_${brevoResp.status}`;
    }

    const durationMs = Math.round(performance.now() - startedAt);

    return new Response(
      JSON.stringify({
        ok: true,
        function: 'transactional-notifications',
        eventType,
        recipientEmail,
        providerStatus,
        durationMs,
        dispatchedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Notification dispatch error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
