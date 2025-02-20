// student_reminder.js
const admin = require('firebase-admin');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// Инициализируем Firebase Admin через сервисный аккаунт (если ещё не инициализирован)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Настройка Sendinblue SDK
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.SIB_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendStudentReminders() {
  const now = new Date();
  // Напоминание отправляется за 60 минут до начала урока
  const reminderTimeMs = 60 * 60 * 1000;
  const reminderThreshold = new Date(now.getTime() + reminderTimeMs);

  try {
    // Выбираем уроки, где studentNotified == false, и начало урока находится между now и reminderThreshold
    const snapshot = await db.collection('lessons')
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
      const subject = 'Напоминание: Ваш урок скоро начнется';
      const status = lesson.paid ? 'Оплачен' : 'Не оплачен';
      const htmlContent = `<p>Hola <strong>${lesson.userName}</strong>!</p>
                           <p>Напоминаем, что ваш урок начнется в <strong>${lesson.start}</strong>.</p>
                           <p>Статус оплаты: <strong>${status}</strong>.</p>`;
      
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = { email: 'info@clases-con-xenia.online', name: 'Clases' };
      sendSmtpEmail.to = [{ email: lesson.userEmail, name: lesson.userName }];

      tranEmailApi.sendTransacEmail(sendSmtpEmail).then((data) => {
        console.log(`Напоминание отправлено для ${lesson.userEmail}:`, data);
        updatePromises.push(db.collection('lessons').doc(doc.id).update({ studentNotified: true }));
      }).catch((error) => {
        console.error(`Ошибка отправки напоминания для ${lesson.userEmail}:`, error);
      });
    });

    await Promise.all(updatePromises);
    console.log('Все уведомления ученикам обработаны');
  } catch (error) {
    console.error('Ошибка в sendStudentReminders:', error);
  }
}

sendStudentReminders();
