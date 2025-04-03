const admin = require('firebase-admin');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// Инициализируем Firebase Admin
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

async function sendLowLessonReminder() {
  try {
    const snapshot = await db.collection('lessons').get();
    const lessonsByUser = {};

    snapshot.forEach(doc => {
      const lesson = doc.data();
      if (!lessonsByUser[lesson.userEmail]) {
        lessonsByUser[lesson.userEmail] = { count: 0, notified: false };
      }
      lessonsByUser[lesson.userEmail].count++;
    });

    const updatePromises = [];
    for (const [userEmail, data] of Object.entries(lessonsByUser)) {
      if (data.count <= 1 && !data.notified) {
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.subject = "Español";
        sendSmtpEmail.htmlContent = `<p>Hola!</p><p>У вас остался всего ${data.count} урок. Пожалуйста, запишитесь на новые занятия!</p>`;
        sendSmtpEmail.sender = { email: 'info@clases-con-xenia.online', name: 'Ksenia' };
        sendSmtpEmail.to = [{ email: userEmail }];

        try {
          await tranEmailApi.sendTransacEmail(sendSmtpEmail);
          console.log(`Уведомление о низком количестве уроков отправлено для ${userEmail}`);
          updatePromises.push(db.collection('lessons').doc(userEmail).update({ lowLessonNotified: true }));
        } catch (error) {
          console.error(`Ошибка отправки уведомления для ${userEmail}:`, error);
        }
      }
    }
    await Promise.all(updatePromises);
    console.log('Обработаны все уведомления о низком количестве уроков');
  } catch (error) {
    console.error('Ошибка в sendLowLessonReminder:', error);
  }
}

sendLowLessonReminder();
