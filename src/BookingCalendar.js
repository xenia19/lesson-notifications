import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import './App.css';
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import ru from "date-fns/locale/ru";
import googleLogo from './google.png';

const locales = { ru };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Кастомный компонент для отрисовки ячеек времени
function CustomTimeSlotWrapper({ value, children }) {
  // Определяем час для временного слота в часовом поясе Сан-Паулу
  const hour = moment.tz(value, 'America/Sao_Paulo').hour();
  const isDisabled = hour < 7 || hour >= 22;
  const style = isDisabled
    ? { backgroundColor: '#f0f0f0', pointerEvents: 'none' }
    : {};
  return React.cloneElement(children, {
    style: { ...children.props.style, ...style },
  });
}

function BookingCalendar() {
  const [events, setEvents] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [lessonDuration, setLessonDuration] = useState(60);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [authMode, setAuthMode] = useState(''); // 'login' или 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showSelectedModal, setShowSelectedModal] = useState(false);

  // Определение, мобильное ли устройство (ширина экрана <= 768px)
  const isMobile = window.innerWidth <= 768;
  const defaultView = isMobile ? 'day' : 'week';

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log("Auth persistence установлена"))
      .catch((error) => console.error("Ошибка установки persistence:", error));
  }, []);

  useEffect(() => {
    document.title = 'Уроки испанского';
    auth.languageCode = 'ru';
    const unsubscribe = onSnapshot(collection(db, 'lessons'), (snapshot) => {
      const loadedEvents = snapshot.docs.map(doc => ({
        ...doc.data(),
        start: new Date(doc.data().start),
        end: new Date(doc.data().end),
        id: doc.id,
      }));
      setEvents(loadedEvents);
    });
    return () => unsubscribe();
  }, []);

  // Авторизация через Google
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      setShowModal(false);
      alert('Вы вошли через Google!');
    } catch (error) {
      console.error('Ошибка авторизации через Google:', error);
    }
  };

  // Авторизация через email (вход или регистрация)
  const handleEmailAuth = async () => {
    try {
      if (authMode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        if (!result.user.emailVerified) {
          alert("Пожалуйста, подтвердите ваш email перед входом.");
          await signOut(auth);
          return;
        }
        setUser(result.user);
        alert('Вы вошли через email!');
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        await sendEmailVerification(result.user);
        alert('Вы успешно зарегистрированы! Проверьте email для подтверждения.');
        setAuthMode('login');
      }
      setShowModal(false);
    } catch (error) {
      console.error('Ошибка авторизации через email:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      alert("Введите email для сброса пароля.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email, {
        url: 'https://clases-con-xenia.online/',
        handleCodeInApp: false,
      });
      alert("Письмо для сброса пароля отправлено на " + email);
    } catch (error) {
      console.error("Ошибка при сбросе пароля:", error);
      alert("Ошибка: " + error.message);
    }
  };

  const handleSlotDelete = async (event) => {
    const confirmDelete = window.confirm(
      `Удалить урок: ${format(event.start, 'dd MMMM yyyy, HH:mm', { locale: ru })}?`
    );
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, 'lessons', event.id));
        alert('Урок успешно удалён.');
      } catch (error) {
        console.error('Ошибка при удалении урока:', error);
      }
    }
  };

  const handleBooking = async () => {
    try {
      for (const slot of selectedSlots) {
        const endTime = new Date(slot.start.getTime() + lessonDuration * 60000);
        await addDoc(collection(db, 'lessons'), {
          title: 'Урок',
          start: slot.start.toISOString(),
          end: endTime.toISOString(),
          userEmail: user.email,
          userName: user.displayName || user.email,
          paid: false,
          adminNotified: false
        });
      }
      alert('Уроки успешно забронированы!');
      setSelectedSlots([]);
    } catch (error) {
      console.error('Ошибка при бронировании:', error);
    }
  };

  const now = new Date();

  // Баланс уроков: для оплаченных учитываем только будущие уроки, а неоплаченные — все
  const paidLessons = events.filter(
    event => event.userEmail === user?.email && event.paid && event.start >= now
  ).length;
  const pendingLessons = events.filter(
    event => event.userEmail === user?.email && !event.paid
  ).length;

  // Список запланированных уроков – только будущие уроки, отсортированные по дате
  const userBookedLessons = events
    .filter(event => event.userEmail === user?.email && event.start >= now)
    .sort((a, b) => a.start - b.start);

  // Кастомный рендер события для календаря
  const MyEvent = ({ event }) => {
    if (event.temp) return <span>{event.title}</span>;
    if (event.userEmail === user?.email) {
      return (
        <div style={{ textAlign: "center", lineHeight: 1.2 }}>
          <div style={{ fontWeight: "bold" }}>{event.title}</div>
   
        </div>
      );
    }
    return <span>{event.title}</span>;
  };

  const selectedSlotEvents = selectedSlots.map((slot, idx) => ({
    id: `temp-${idx}`,
    title: '',
    start: slot.start,
    end: new Date(slot.start.getTime() + lessonDuration * 60000),
    temp: true,
  }));

  const combinedEvents = [...events, ...selectedSlotEvents];

  return (
    <div
      className="container"
      style={{
        fontFamily: 'Roboto, sans-serif',
        backgroundColor: '#f4f6f8',
        padding: '20px',
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap'
      }}
    >
      {/* Левая колонка – календарь и панель бронирования */}
      <div style={{ flex: 3, minWidth: '300px' }}>
        <header 
          className="header" 
          style={{
            padding: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            marginBottom: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)'
          }}
        >
          <h1 style={{ color: '#2c3e50', fontSize: '30px', fontWeight: 'bold', margin: 0 }}>
            Уроки испанского
          </h1>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 'bold', color: '#34495e' }}>
                Привет, {user.displayName || user.email}
              </span>
              <button
                onClick={async () => { 
                  await signOut(auth); 
                  setUser(null); 
                  alert('Вы вышли из системы.'); 
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Выйти
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '12px 25px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              Войти
            </button>
          )}
        </header>

        {/* Панель управления бронированием */}
        {user && (
          <div
            style={{
              marginBottom: '15px',
              padding: '15px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '16px' }}>
                Длительность урока:
              </label>
              <select
                value={lessonDuration}
                onChange={(e) => setLessonDuration(parseInt(e.target.value))}
                style={{
                  padding: '5px 10px',
                  fontSize: '16px',
                  borderRadius: '6px',
                  border: '1px solid #ccc'
                }}
              >
                <option value="45">45 минут</option>
                <option value="60">60 минут</option>
                <option value="90">90 минут</option>
              </select>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                Выбрано уроков: {selectedSlots.length}
              </span>
              <span
                style={{
                  cursor: 'pointer',
                  color: '#27ae60',
                  fontSize: '18px',
                  padding: '0 5px',
                }}
                onMouseEnter={() => setShowSelectedModal(true)}
                onMouseLeave={() => setShowSelectedModal(false)}
              >
                ▼
              </span>
              {showSelectedModal && (
                <div
                  style={{
                    position: 'absolute',
                    top: '30px',
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    padding: '10px',
                    zIndex: 100,
                    minWidth: '200px'
                  }}
                >
                  <strong>Выбранные уроки</strong>
                  {selectedSlots.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {selectedSlots.map((slot, idx) => (
                        <li key={idx} style={{ padding: '5px 0', borderBottom: '1px solid #eee' }}>
                          {format(slot.start, 'dd MMMM yyyy, HH:mm', { locale: ru })}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0 }}>Нет выбранных уроков.</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <button
                onClick={handleBooking}
                disabled={selectedSlots.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: selectedSlots.length === 0 ? '#ccc' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: selectedSlots.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s ease'
                }}
              >
                Забронировать уроки
              </button>
            </div>
          </div>
        )}

        {/* Модальное окно авторизации/регистрации */}
        {showModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '16px',
                width: '350px',
                textAlign: 'center',
                boxShadow: '0 12px 24px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '15px',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#e74c3c',
                }}
              >
                ×
              </button>

              {/* Кнопка входа через Google */}
              <button
                onClick={handleGoogleLogin}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  fontSize: '18px',
                  marginBottom: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  color: '#555'
                }}
              >
                <img 
                  src={googleLogo} 
                  alt="Google logo" 
                  style={{ width: '24px', height: '24px' }} 
                />
                Войти через Google
              </button>

              {/* Если не выбран режим email, предлагаем его */}
              {!authMode && (
                <button
                  onClick={() => setAuthMode('login')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#2ecc71',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '18px',
                    marginBottom: '15px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  Войти через Email
                </button>
              )}

              {authMode && (
                <>
                  {authMode === 'register' && (
                    <input
                      type="text"
                      placeholder="Введите имя"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{
                        width: '90%',
                        padding: '10px',
                        margin: '15px 0',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '16px',
                        outline: 'none',
                      }}
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Введите email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '90%',
                      padding: '10px',
                      margin: '15px 0',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '16px',
                      outline: 'none',
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '90%',
                      padding: '10px',
                      margin: '15px 0',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '16px',
                      outline: 'none',
                    }}
                  />
                  {authMode === 'login' && (
                    <p
                      onClick={handleResetPassword}
                      style={{
                        color: '#2980b9',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '14px',
                        marginBottom: '15px'
                      }}
                    >
                      Забыли пароль?
                    </p>
                  )}
                  <button
                    onClick={handleEmailAuth}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '18px',
                      marginBottom: '15px',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s ease',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                  </button>
                </>
              )}

              {authMode && (
                <p
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setName('');
                  }}
                  style={{
                    color: '#2980b9',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '16px',
                    marginTop: '20px',
                  }}
                >
                  {authMode === 'login'
                    ? 'Нет аккаунта? Зарегистрироваться'
                    : 'Уже есть аккаунт? Войти'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Календарь */}
        <Calendar
          localizer={localizer}
          events={combinedEvents}
          selectable
          onSelectEvent={(event) => {
            if (event.temp) {
              setSelectedSlots(prev => prev.filter(slot => slot.start.getTime() !== event.start.getTime()));
            } else if (event.userEmail === user?.email) {
              handleSlotDelete(event);
            } else {
              alert('Вы не можете удалить бронирование другого пользователя.');
            }
          }}
          onSelectSlot={(slotInfo) => {
            // Проверяем, находится ли выбранное время в интервале 7:00–22:00 по Сан-Паулу
            const hour = moment.tz(slotInfo.start, 'America/Sao_Paulo').hour();
            if (hour < 7 || hour >= 22) {
              alert('В это время бронирование недоступно.');
              return;
            }
            if (user) {
              const alreadySelected = selectedSlots.some(
                slot => slot.start.getTime() === slotInfo.start.getTime()
              );
              if (alreadySelected) {
                setSelectedSlots(prev =>
                  prev.filter(
                    slot => slot.start.getTime() !== slotInfo.start.getTime()
                  )
                );
              } else {
                setSelectedSlots(prev => [...prev, slotInfo]);
              }
            } else {
              alert('Пожалуйста, авторизуйтесь, чтобы забронировать уроки.');
            }
          }}
          startAccessor="start"
          endAccessor="end"
          defaultView={defaultView}
          views={{ day: true, month: true, week: !isMobile }}
          firstDay={1}
          style={{
            height: '100%',
            width: '100%',
            padding: '15px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0px 6px 15px rgba(0, 0, 0, 0.1)',
            marginBottom: '20px'
          }}
          step={30}  
          timeslots={2}
    

          // Убираем min и max, чтобы показывать все 24 часа
          getNow={() => new Date()}
          culture="ru"
          messages={{
            previous: 'Предыдущий',
            next: 'Следующий',
            today: 'Сегодня',
            month: 'Месяц',
            week: 'Неделя',
            day: 'День',
            agenda: 'Повестка дня',
            date: 'Дата',
            time: 'Время',
            event: 'Событие',
            noEventsInRange: 'Нет событий в этом диапазоне.',
            showMore: (total) => `+ ещё ${total}`
          }}
          components={{
            event: MyEvent,
            timeSlotWrapper: CustomTimeSlotWrapper, // Подключаем кастомный wrapper для слотов
          }}
          eventPropGetter={(event) => {
            if (event.temp) {
              return {
                style: {
                  backgroundColor: '#8e44ad',
                  border: '2px dashed #fff',
                  color: 'white',
                  borderRadius: '6px',
                  padding: '2px',
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }
              };
            }
            if (event.userEmail === user?.email) {
              if (event.start < now) {
                return {
                  style: {
                    backgroundColor: event.paid ? '#95a5a6' : '#f39c12',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    width: '100%',
                    height: '100%',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }
                };
              } else {
                return {
                  style: {
                    backgroundColor: event.paid ? '#2ecc71' : '#e67e22',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    width: '100%',
                    height: '100%',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }
                };
              }
            }
            return {
              style: {
                backgroundColor: '#d3d3d3',
                color: 'transparent',
                border: 'none',
                borderRadius: '6px',
                width: '100%',
                height: '100%',
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }
            };
          }}
        />
      </div>

      {/* Правая колонка – баланс уроков и список запланированных уроков */}
      {user && (
        <div
          style={{
            flex: 1,
            minWidth: '280px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {/* Баланс уроков */}
          {(userBookedLessons.length > 0 || pendingLessons > 0) && (
            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
                textAlign: 'center'
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Баланс уроков</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '16px' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#2ecc71' }}>{paidLessons}</div>
                  <div>Оплачено</div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#e67e22' }}>{pendingLessons}</div>
                  <div>Ожидают оплаты</div>
                </div>
              </div>
            </div>
          )}

          {/* Список запланированных уроков (только будущие уроки) */}
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Запланированные уроки</h3>
            {userBookedLessons.length > 0 ? (
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {userBookedLessons.map(lesson => (
                  <li
                    key={lesson.id}
                    style={{
                      marginBottom: '10px',
                      padding: '10px',
                      backgroundColor: '#f0f8ff',
                      borderRadius: '8px',
                      boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ fontSize: '14px', color: '#2c3e50' }}>
                      {format(new Date(lesson.start), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                    </div>
                    <span
                      onClick={() => handleSlotDelete(lesson)}
                      style={{
                        fontWeight: 'bold',
                        fontSize: '20px',
                        color: '#e74c3c',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#2c3e50', fontSize: '18px', textAlign: 'center', padding: '10px' }}>
                Нет запланированных уроков.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingCalendar;
