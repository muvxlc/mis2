export const sendDiscordNotification = async (message: string, webhookUrl: string) => {
  if (!webhookUrl) {
    console.warn('[DISCORD] Skip sending: Webhook URL is missing');
    return;
  }
  
  console.log(`[DISCORD] Attempting to send...`);
  try {
    await $fetch(webhookUrl, {
      method: 'POST',
      body: { content: message }
    });
    console.log('[DISCORD] Send success');
  } catch (e: any) {
    console.error('[DISCORD] Send failed:', e.message);
  }
};

export const sendTelegramNotification = async (message: string, botToken: string, chatId: string) => {
  if (!botToken || !chatId) {
    console.warn('[TELEGRAM] Skip sending: Token or Chat ID is missing');
    return;
  }

  console.log(`[TELEGRAM] Attempting to send message...`);
  try {
    await $fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      body: { 
        chat_id: chatId.toString(), 
        text: message.replace(/\*\*/g, ''), // Strip bold for simple text or handle via HTML
        parse_mode: 'HTML' 
      }
    });
    console.log('[TELEGRAM] Send success');
  } catch (e: any) {
    console.error('[TELEGRAM] Send failed:', e.data || e.message);
  }
};

export const notifyStatusChange = async (projectName: string, oldStatus: string, newStatus: string, userName: string) => {
  console.log(`[NOTIFY] Status change for project: ${projectName} (${oldStatus} -> ${newStatus}) by ${userName}`);
  
  const formatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const thaiTime = formatter.format(new Date());
  const message = `🔔 แจ้งเตือนการเปลี่ยนสถานะโครงการ\n\n📌 โครงการ: ${projectName}\n🔄 สถานะ: ${oldStatus || 'รอดำเนินการ'} ➡️ ${newStatus}\n👤 ผู้ดำเนินการ: ${userName}\n📅 วันที่: ${thaiTime} (UTC+7)`;
  
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  console.log(`[NOTIFY] Config check - Discord: ${discordWebhook ? 'Yes' : 'No'}, Telegram: ${telegramToken ? 'Yes' : 'No'}`);

  const promises = [];
  if (discordWebhook) promises.push(sendDiscordNotification(message, discordWebhook));
  if (telegramToken && telegramChatId) promises.push(sendTelegramNotification(message, telegramToken, telegramChatId));

  await Promise.allSettled(promises);
};
