const { sendMessage, answerCallback } = require('../lib/telegram');
const { sendLeadEmail } = require('../lib/email');

const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

// Texts used as "markers" so we can tell, via reply_to_message, what question
// we're getting an answer to — no database needed, the bot is stateless.
const ASK_PAINT_METERS = 'Сколько метров уголка/профиля нужно покрасить? Пришлите число.';
const ASK_CUSTOM_REQUEST = 'Опишите, что нужно изготовить (что за изделие, примерные размеры, материал) — передам менеджеру.';

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🎨 Рассчитать покраску (руб/м)', callback_data: 'calc_paint' }],
      [{ text: '🔧 Изготовление (ворота, заборы и т.п.)', callback_data: 'custom_work' }],
      [{ text: '📋 Прайс и цвета RAL', callback_data: 'price_ral' }],
      [{ text: '👤 Связаться с менеджером', callback_data: 'contact_manager' }],
    ],
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('ok');
  const update = req.body;

  try {
    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
  } catch (e) {
    console.error(e);
  }

  res.status(200).send('ok'); // always 200 so Telegram doesn't retry
};

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Stateless "reply" flow: check what question this message is replying to
  const repliedTo = msg.reply_to_message?.text;

  if (repliedTo === ASK_PAINT_METERS) {
    const meters = parseFloat(text.replace(',', '.'));
    if (isNaN(meters) || meters <= 0) {
      return sendMessage(chatId, 'Нужно просто число метров, например: 5');
    }
    const price = Math.round(meters * 100);
    return sendMessage(
      chatId,
      `Покраска ${meters} м уголка/профиля: <b>≈ ${price} ₽</b>\n\n` +
        `Это цена за погонный метр (100 ₽/м). Если изделия крупные или партия смешанная — точнее посчитает менеджер.\n\n` +
        `Если хотите оставить заявку с этим расчётом — напишите телефон для связи.`
    );
  }

  if (repliedTo === ASK_CUSTOM_REQUEST) {
    await notifyManager(msg, `🔧 Запрос на изготовление:\n${text}`);
    return sendMessage(chatId, 'Спасибо! Передал менеджеру, он свяжется с вами в ближайшее время 👍');
  }

  if (text === '/start') {
    return sendMessage(
      chatId,
      'Здравствуйте! Это бот ГОРН — изготовление металлоизделий и порошковая покраска.\n\nВыберите, что нужно:',
      mainMenu
    );
  }

  // Any other free text — treat as a lead message and forward
  if (text && !text.startsWith('/')) {
    await notifyManager(msg, `💬 Сообщение из бота:\n${text}`);
    return sendMessage(chatId, 'Принял, передал менеджеру. Если нужен точный расчёт — используйте меню /start');
  }
}

async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  await answerCallback(cq.id, '');

  switch (cq.data) {
    case 'calc_paint':
      return sendMessage(chatId, ASK_PAINT_METERS, { reply_markup: { force_reply: true } });

    case 'custom_work':
      await sendMessage(
        chatId,
        'Изготовление считаем индивидуально — цена зависит от размеров, материала и сложности.\n' +
          'Партия/загрузка покраски ("печка") — от 4000 ₽ за загрузку.'
      );
      return sendMessage(chatId, ASK_CUSTOM_REQUEST, { reply_markup: { force_reply: true } });

    case 'price_ral':
      return sendMessage(
        chatId,
        '📋 <b>Расценки</b>\n' +
          '• Покраска уголка/профиля — 100 ₽/м\n' +
          '• Покраска партией ("печка") — от 4000 ₽ за загрузку\n' +
          '• Изготовление — расчёт индивидуально\n\n' +
          'Цвета RAL — любые из стандартной палитры, уточняйте у менеджера конкретный номер.'
      );

    case 'contact_manager':
      return sendMessage(chatId, 'Напишите вопрос прямо сюда — я передам его менеджеру.');
  }
}

async function notifyManager(msg, label) {
  const from = msg.from;
  const contact = `от @${from.username || from.first_name} (id ${from.id})`;
  const text = `${label}\n\n${contact}`;
  await sendMessage(MANAGER_CHAT_ID, text);
  await sendLeadEmail({ subject: 'Новое сообщение из Telegram-бота', text: `${label}\n${contact}` });
}
