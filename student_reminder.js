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
  const reminderTimeMs = 27 * 60 * 1000;
  const reminderThreshold = new Date(now.getTime() + reminderTimeMs);

  try {
    // Выбираем уроки, где studentNotified == false, и начало урока находится между now и reminderThreshold
    const snapshot = await db.collection('lessons')
      .where('start', '>=', now.toISOString())
      .where('start', '<=', reminderThreshold.toISOString())
      .where('studentNotified', '==', false)
      .get();

    if (snapshot.empty) {
      console.log('Нет уроков для уведомления учеников');
      return;
    }

    const updatePromises = [];

    // Обходим найденные уроки
    for (const doc of snapshot.docs) {
      const lesson = doc.data();
      const userTimezone = lesson.userTimezone || "UTC"; // Теперь lesson объявлен перед использованием

      function getTimeZoneName(timeZone) {
        const options = { timeZone, timeZoneName: 'long' };
        const dateFormatter = new Intl.DateTimeFormat('ru-RU', options);
        const parts = dateFormatter.formatToParts(new Date());
        const timeZonePart = parts.find(part => part.type === 'timeZoneName');
        return timeZonePart ? timeZonePart.value : 'Неизвестная зона';
      }

      const timeZoneName = getTimeZoneName(userTimezone);

      // Конвертируем дату в русский формат в часовом поясе ученика
      const dateOptions = { timeZone: userTimezone, day: "numeric", month: "long", year: "numeric" };
      const timeOptions = { timeZone: userTimezone, hour: "2-digit", minute: "2-digit", hour12: false }; // 24-часовой формат
      const dateLocal = new Date(lesson.start).toLocaleDateString("ru-RU", dateOptions);
      const timeLocal = new Date(lesson.start).toLocaleTimeString("ru-RU", timeOptions);
      const lessonTimeLocal = `${dateLocal} в ${timeLocal}`;

      console.log(lessonTimeLocal, "user time zone", userTimezone); // Проверяем правильность времени

      // Формируем email
      const subject = "Напоминание: Ваш урок скоро начнется";
      const status = lesson.paid ? "Оплачен" : "Не оплачен";
      const htmlContent = `<p>Hola <strong>${lesson.userName}</strong>!</p>
                           <p>Напоминаем, что ваш урок начнется <strong>${lessonTimeLocal}</strong> (время - ${timeZoneName}).</p>
                           <p>Статус оплаты: <strong>${status}</strong>.</p>`;
      
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = { email: 'info@clases-con-xenia.online', name: 'Ksenia' };
      sendSmtpEmail.to = [{ email: lesson.userEmail, name: lesson.userName }];

      try {
        const data = await tranEmailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`Напоминание отправлено для ${lesson.userEmail}:`, data);
        updatePromises.push(db.collection('lessons').doc(doc.id).update({ studentNotified: true }));
      } catch (error) {
        console.error(`Ошибка отправки напоминания для ${lesson.userEmail}:`, error);
      }
    }

    await Promise.all(updatePromises);
    console.log('Все уведомления ученикам обработаны');
  } catch (error) {
    console.error('Ошибка в sendStudentReminders:', error);
  }
}

sendStudentReminders();
