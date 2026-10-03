const { sendMessage } = require('../lib/telegram');
const { sendLeadEmail } = require('../lib/email');

module.exports = async (req, res) => {
  // CORS - allow the site (on another domain) to POST here
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, service, message } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'name и phone обязательны' });
  }

  const text =
    `🔔 <b>Новая заявка с сайта</b>\n\n` +
    `Имя: ${escapeHtml(name)}\n` +
    `Телефон: ${escapeHtml(phone)}\n` +
    (service ? `Услуга: ${escapeHtml(service)}\n` : '') +
    (message ? `Комментарий: ${escapeHtml(message)}` : '');

  const chatId = process.env.MANAGER_CHAT_ID;
  await sendMessage(chatId, text);

  await sendLeadEmail({
    subject: `Новая заявка с сайта — ${name}`,
    text: `Имя: ${name}\nТелефон: ${phone}\nУслуга: ${service || '-'}\nКомментарий: ${message || '-'}`,
  });

  res.status(200).json({ ok: true });
};

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
