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
  const reminderTimeMs = 60 * 60 * 1000;
  const reminderThreshold = new Date(now.getTime() + reminderTimeMs);

  try {
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

    for (const doc of snapshot.docs) {
      const lesson = doc.data();
      const userTimezone = lesson.userTimezone || "UTC";

      function getTimeZoneName(timeZone) {
        const options = { timeZone, timeZoneName: 'long' };
        const dateFormatter = new Intl.DateTimeFormat('ru-RU', options);
        const parts = dateFormatter.formatToParts(new Date());
        const timeZonePart = parts.find(part => part.type === 'timeZoneName');
        return timeZonePart ? timeZonePart.value : 'Неизвестная зона';
      }

      const timeZoneName = getTimeZoneName(userTimezone);

      const dateOptions = { timeZone: userTimezone, day: "numeric", month: "long", year: "numeric" };
      const timeOptions = { timeZone: userTimezone, hour: "2-digit", minute: "2-digit", hour12: false };
      const dateLocal = new Date(lesson.start).toLocaleDateString("ru-RU", dateOptions);
      const timeLocal = new Date(lesson.start).toLocaleTimeString("ru-RU", timeOptions);
      const lessonTimeLocal = `${dateLocal} в ${timeLocal}`;

      console.log(lessonTimeLocal, "user time zone", userTimezone);

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

async function sendLowLessonReminder() {
  try {
    const usersSnapshot = await db.collection('users').get();
    const updatePromises = [];
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      const lastReminderSent = user.lastLowLessonReminder ? new Date(user.lastLowLessonReminder) : null;
      
      const lessonsSnapshot = await db.collection('lessons')
        .where('userEmail', '==', user.email)
        .get();
 console.log(lessonsSnapshot, "snap", lastReminderSent);
      if (lessonsSnapshot.size <= 1 && (!lastReminderSent || lastReminderSent < threeDaysAgo)) {
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.subject = "Напоминание: Остался всего 1 урок";
        sendSmtpEmail.htmlContent = `<p>Hola!</p>
                                     <p>У тебя осталось <strong>${lessonsSnapshot.size}</strong> забронированных уроков.</p>
                                     <p>Не забудь забронировать новые уроки! ;)</p>`;
        sendSmtpEmail.sender = { email: 'info@clases-con-xenia.online', name: 'Ksenia' };
        sendSmtpEmail.to = [{ email: user.email }];

        try {
          await tranEmailApi.sendTransacEmail(sendSmtpEmail);
          console.log(`Напоминание о низком количестве уроков отправлено для ${user.email}`);
          updatePromises.push(db.collection('users').doc(userDoc.id).update({ lastLowLessonReminder: now.toISOString() }));
        } catch (error) {
          console.error(`Ошибка отправки напоминания о низком количестве уроков для ${user.email}:`, error);
        }
      }
    }

    await Promise.all(updatePromises);
    console.log('Все напоминания о низком количестве уроков обработаны');
  } catch (error) {
    console.error('Ошибка в sendLowLessonReminder:', error);
  }
}

sendStudentReminders();
sendLowLessonReminder();
