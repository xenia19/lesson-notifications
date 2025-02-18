// admin_notify.js
const admin = require('firebase-admin');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// Инициализируем Firebase Admin через сервисный аккаунт, переданный через переменную окружения
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Настройка Sendinblue SDK
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.SIB_API_KEY; // Ваш Sendinblue API-ключ

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// Email администратора (куда будут отправляться уведомления)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // например, "admin@clases-con-xenia.online"
console.log('ADMIN_EMAIL:', ADMIN_EMAIL);
async function notifyAdminOnNewBooking() {
  try {
    // Запрос: выбираем документы в коллекции 'lessons', где adminNotified == false
    const snapshot = await db.collection('lessons')
      .where('adminNotified', '==', false)
      .get();

    if (snapshot.empty) {
      console.log('Новых бронирований не найдено');
      return;
    }

    const updatePromises = [];

    snapshot.forEach(doc => {
      const lesson = doc.data();
      const subject = 'Новый урок забронирован';
      const htmlContent = `<p>Пользователь <strong>${lesson.userName}</strong> (${lesson.userEmail}) забронировал урок, начинающийся в <strong>${lesson.start}</strong>.</p>`;
      
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = { email: 'info@clases-con-xenia.online', name: 'Clases' };
      sendSmtpEmail.to = [{ email: ADMIN_EMAIL, name: 'Admin' }];

      tranEmailApi.sendTransacEmail(sendSmtpEmail).then((data) => {
        console.log(`Уведомление администратору отправлено для бронирования пользователя ${lesson.userName} (${lesson.userEmail}):`, data);
        // После успешной отправки обновляем документ, чтобы уведомление не повторялось
        updatePromises.push(db.collection('lessons').doc(doc.id).update({ adminNotified: true }));
      }).catch((error) => {
        console.error(`Ошибка отправки уведомления администратору для бронирования пользователя ${lesson.userName} (${lesson.userEmail}):`, error);
      });
    });

    // Ждем, пока обновятся все документы
    await Promise.all(updatePromises);
    console.log('Все уведомления администратору обработаны');
  } catch (error) {
    console.error('Ошибка в notifyAdminOnNewBooking:', error);
  }
}

notifyAdminOnNewBooking();
