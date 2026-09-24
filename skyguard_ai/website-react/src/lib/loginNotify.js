// Login email notification via EmailJS (free tier, no backend needed).
// Fires only on FRESH logins — never on page reloads/session restores —
// because callers invoke it solely in explicit sign-in success paths.
// Never blocks or breaks login: misconfiguration/failure is silent.

export async function sendLoginNotification(toEmail, method = 'Email') {
  if (!toEmail) return;
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
  if (!serviceId || !templateId || !publicKey) return; // not configured yet

  try {
    const { default: emailjs } = await import('@emailjs/browser');
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: toEmail,
        app_name: 'SkyGuard AI',
        login_method: method,
        login_time: new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      },
      { publicKey }
    );
  } catch {
    // Notification failure must never affect the login itself.
  }
}
