const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

// Получаем API ключ SendGrid из переменных окружения Firebase (его нужно настроить отдельно)
const SENDGRID_API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(SENDGRID_API_KEY);

// Функция срабатывает при создании нового документа в коллекции "lessons"
exports.sendBookingNotification = functions.firestore
  .document('lessons/{lessonId}')
  .onCreate(async (snap, context) => {
    const lesson = snap.data();
    const bookingDate = new Date(lesson.start).toLocaleString('ru-RU');

    // Настройка параметров email
    const msg = {
      to: 'ksiusha.maestra@gmail.com', // замените на email администратора
      from: 'ksiusha.maestra@gmail.com', // замените на подтвержденный email отправителя в SendGrid
      subject: 'Новый урок забронирован',
      text: `Пользователь ${lesson.userEmail} забронировал урок на ${bookingDate}`,
      html: `<p>Пользователь <strong>${lesson.userEmail}</strong> забронировал урок на <strong>${bookingDate}</strong>.</p>`,
    };

    try {
      await sgMail.send(msg);
      console.log('Email отправлен администратору');
      return null;
    } catch (error) {
      console.error('Ошибка отправки email:', error);
      return null;
    }
  });
