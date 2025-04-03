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
      .where('studentNotified', '==', false)
      .get();

    if (snapshot.empty) {
      console.log('Нет уроков для уведомления учеников');
      return;
    }

    const updatePromises = [];

    for (const doc of snapshot.docs) {
      const lesson = doc.data();
      const lessonStart = new Date(lesson.start);
      if (lessonStart < now || lessonStart > reminderThreshold) continue;
      
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
      const dateLocal = lessonStart.toLocaleDateString("ru-RU", dateOptions);
      const timeLocal = lessonStart.toLocaleTimeString("ru-RU", timeOptions);
      const lessonTimeLocal = `${dateLocal} в ${timeLocal}`;

      console.log(lessonTimeLocal, "user time zone", userTimezone);

      // Получаем все уроки пользователя
      const allLessonsSnapshot = await db.collection('lessons')
        .where('userEmail', '==', lesson.userEmail)
        .get();
      
      // Фильтруем только будущие уроки
      const futureLessons = allLessonsSnapshot.docs.map(d => d.data()).filter(l => new Date(l.start) > now);
      console.log(`У пользователя ${lesson.userEmail} осталось ${futureLessons.length} будущих уроков.`);
      
      const isLastLesson = futureLessons.length === 1;
      const lastLessonText = isLastLesson ? '<p><strong>Кстати, это последний забронированный урок.</strong> Не забудь забронировать новые уроки! ;)</p>' : '';
      
      const subject = "Напоминание: урок скоро начнется";
      const htmlContent = `<p>Hola <strong>${lesson.userName}</strong>!</p>
                           <p>Урок начнется <strong>${lessonTimeLocal}</strong> (время - ${timeZoneName}).</p>
                           ${lastLessonText}`;
      
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
