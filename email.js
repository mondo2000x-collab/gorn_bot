async function sendLeadEmail({ subject, text }) {
  if (!process.env.RESEND_API_KEY) return; // email optional until key is added
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.LEAD_EMAIL_FROM || 'Заявки ГОРН <leads@resend.dev>',
      to: process.env.LEAD_EMAIL_TO,
      subject,
      text,
    }),
  });
}

module.exports = { sendLeadEmail };
