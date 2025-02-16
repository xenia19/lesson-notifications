const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const mailgun = require('mailgun-js');
// Значения берутся из настроек конфигурации Firebase. Ранее вы их установили командой:
// firebase functions:config:set mailgun.domain="mg.clases-con-xenia.online" mailgun.api_key="YOUR_MAILGUN_API_KEY"
const MG_DOMAIN = functions.config().mailgun.domain;
const MG_API_KEY = functions.config().mailgun.api_key;
const mg = mailgun({ apiKey: MG_API_KEY, domain: MG_DOMAIN });

// HTTP-триггерная функция для отправки email-напоминаний
exports.sendLessonRemindersHTTP = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const now = new Date();

  // Задаём порог: напоминание будет отправлено за 60 минут до начала урока
  const reminderTimeMs = 60 * 60 * 1000; // 60 минут в миллисекундах
  const reminderThreshold = new Date(now.getTime() + reminderTimeMs);

  try {
    // Предполагается, что уроки хранятся в коллекции 'lessons'
    // и поле 'start' – это ISO-строка с датой и временем начала урока
    const snapshot = await db.collection('lessons')
      .where('start', '>=', now.toISOString())
      .where('start', '<=', reminderThreshold.toISOString())
      .get();

    if (snapshot.empty) {
      console.log('Нет предстоящих уроков для напоминаний');
      res.status(200).send('No lessons to remind');
      return;
    }

    const sendPromises = [];
    snapshot.forEach(doc => {
      const lesson = doc.data();
      let subject, text, html;

      if (!lesson.paid) {
        subject = 'Напоминание: У вас есть неоплаченный урок';
        text = `Привет, ${lesson.userName}! Напоминаем, что у вас запланирован неоплаченный урок, начинающийся в ${lesson.start}. Пожалуйста, оформите оплату.`;
        html = `<p>Привет, ${lesson.userName}!</p>
                <p>У вас запланирован <strong>неоплаченный урок</strong>, начинающийся в <strong>${lesson.start}</strong>.</p>
                <p>Пожалуйста, оформите оплату.</p>`;
      } else {
        subject = 'Напоминание о предстоящем уроке';
        text = `Привет, ${lesson.userName}! Напоминаем, что ваш урок начнется в ${lesson.start}.`;
        html = `<p>Привет, ${lesson.userName}!</p>
                <p>Напоминаем, что ваш урок начнется в <strong>${lesson.start}</strong>.</p>`;
      }
      
      const data = {
        from: 'noreply@clases-con-xenia.online', // Убедитесь, что этот email настроен и подтвержден в Mailgun
        to: lesson.userEmail,
        subject: subject,
        text: text,
        html: html,
      };

      sendPromises.push(
        mg.messages().send(data)
          .then(response => console.log('Письмо отправлено:', lesson.userEmail, response))
          .catch(error => console.error('Ошибка при отправке письма:', lesson.userEmail, error))
      );
    });

    await Promise.all(sendPromises);
    res.status(200).send('Reminders sent successfully');
  } catch (error) {
    console.error('Ошибка в функции напоминаний:', error);
    res.status(500).send('Error sending reminders');
  }
});
