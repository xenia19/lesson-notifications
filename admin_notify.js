// admin_notify.js
const admin = require('firebase-admin');
const mailgun = require('mailgun-js');

// Инициализируем Firebase Admin через сервисный аккаунт, переданный через переменную окружения
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Настройки Mailgun из переменных окружения
const MG_DOMAIN = process.env.MG_DOMAIN; // например, "mg.clases-con-xenia.online"
const MG_API_KEY = process.env.MG_API_KEY; // ваш Mailgun API-ключ
const mg = mailgun({ apiKey: MG_API_KEY, domain: MG_DOMAIN });

// Email администратора (куда будут приходить уведомления)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // например, "admin@clases-con-xenia.online"

async function notifyAdminOnNewBooking() {
  try {
    // Запрос к коллекции 'lessons': выбираем документы, где поле adminNotified равно false
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
      const text = `Пользователь ${lesson.userName} (${lesson.userEmail}) забронировал урок, начинающийся в ${lesson.start}.`;

      const data = {
        from: 'info@clases-con-xenia.online', // этот email должен быть подтверждён в Mailgun
        to: ADMIN_EMAIL,
        subject: subject,
        text: text,
      };

      mg.messages().send(data, async (error, body) => {
        if (error) {
          console.error(`Ошибка отправки уведомления администратору для бронирования пользователя ${lesson.userName} (${lesson.userEmail}):`, error);
        } else {
          console.log(`Уведомление администратору отправлено для бронирования пользователя ${lesson.userName} (${lesson.userEmail}):`, body);
          // Обновляем документ, чтобы повторное уведомление не отправлялось
          updatePromises.push(
            db.collection('lessons').doc(doc.id).update({ adminNotified: true })
          );
        }
      });
    });

    // Ждем завершения всех обновлений документов
    await Promise.all(updatePromises);
    console.log('Все уведомления администратору обработаны');
  } catch (error) {
    console.error('Ошибка в notifyAdminOnNewBooking:', error);
  }
}

notifyAdminOnNewBooking();
