// student_reminder.js
const admin = require('firebase-admin');
const mailgun = require('mailgun-js');

// Инициализируем Firebase Admin через сервисный аккаунт
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Настройки Mailgun
const MG_DOMAIN = process.env.MG_DOMAIN;
const MG_API_KEY = process.env.MG_API_KEY;
const mg = mailgun({ apiKey: MG_API_KEY, domain: MG_DOMAIN });

async function sendStudentReminders() {
  const now = new Date();
  // Устанавливаем порог: напоминание за 60 минут до начала урока
  const reminderTimeMs = 60 * 60 * 1000;
  const reminderThreshold = new Date(now.getTime() + reminderTimeMs);

  try {
    // Выбираем уроки, по которым ещё не отправлено уведомление ученику
    // Предполагается, что поле studentNotified равно false или отсутствует
    const snapshot = await db.collection('lessons')
      .where('studentNotified', '==', false)
      .where('start', '>=', now.toISOString())
      .where('start', '<=', reminderThreshold.toISOString())
      .get();

    if (snapshot.empty) {
      console.log('Нет уроков для уведомления учеников');
      return;
    }

    const updatePromises = [];

    snapshot.forEach(doc => {
      const lesson = doc.data();
      let subject = 'Напоминание: Ваш урок скоро начнется';
      let text = `Привет, ${lesson.userName}!\n\nВаш урок начнется в ${lesson.start}.\n\nСтатус оплаты: ${lesson.paid ? 'Оплачен' : 'Не оплачен'}.`;
      let html = `<p>Привет, ${lesson.userName}!</p>
                  <p>Напоминаем, что ваш урок начнется в <strong>${lesson.start}</strong>.</p>
                  <p>Статус оплаты: <strong>${lesson.paid ? 'Оплачен' : 'Не оплачен'}</strong>.</p>`;

      const data = {
        from: 'noreply@clases-con-xenia.online',
        to: lesson.userEmail,
        subject: subject,
        text: text,
        html: html,
      };

      mg.messages().send(data, async (error, body) => {
        if (error) {
          console.error(`Ошибка отправки напоминания для ученика ${lesson.userEmail}:`, error);
        } else {
          console.log(`Напоминание отправлено для ${lesson.userEmail}:`, body);
          // Обновляем документ, чтобы уведомление не отправлялось повторно
          updatePromises.push(
            db.collection('lessons').doc(doc.id).update({ studentNotified: true })
          );
        }
      });
    });

    await Promise.all(updatePromises);
    console.log('Все уведомления ученикам обработаны');
  } catch (error) {
    console.error('Ошибка в sendStudentReminders:', error);
  }
}

sendStudentReminders();
