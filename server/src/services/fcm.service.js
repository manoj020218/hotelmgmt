function getMessaging() {
  try {
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length > 0) {
      return admin.messaging();
    }
  } catch {}
  return null;
}

async function sendToToken(token, notification, data = {}) {
  if (!token) return;
  const msg = getMessaging();
  if (!msg) return;
  try {
    await msg.send({ token, notification, data });
  } catch (err) {
    console.warn('[FCM] sendToToken failed:', err.message);
  }
}

async function sendToTopic(topic, notification, data = {}) {
  if (!topic) return;
  const msg = getMessaging();
  if (!msg) return;
  try {
    await msg.send({ topic, notification, data });
  } catch (err) {
    console.warn('[FCM] sendToTopic failed:', err.message);
  }
}

module.exports = { sendToToken, sendToTopic };
