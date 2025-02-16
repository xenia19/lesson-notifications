import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import format from "date-fns/format";
import ru from "date-fns/locale/ru";
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import moment from 'moment';
import { onAuthStateChanged } from 'firebase/auth';

const localizer = momentLocalizer(moment);

function AdminDashboard() {
  const [lessons, setLessons] = useState([]);
  // Обновлённый state для нового урока: добавлено поле studentName
  const [newLesson, setNewLesson] = useState({ studentEmail: '', studentName: '', start: '', duration: 60 });
  const navigate = useNavigate();

  // Проверка доступа: только администратор (email: ksiusha.maestra@gmail.com)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== 'ksiusha.maestra@gmail.com') {
        alert('Доступ запрещен. Перенаправление на главную страницу.');
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Загрузка всех уроков из базы данных Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'lessons'), (snapshot) => {
      const loadedLessons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLessons(loadedLessons);
    });
    return () => unsubscribe();
  }, []);

  const handleAddLesson = async () => {
    if (!newLesson.studentEmail || !newLesson.start) {
      alert('Введите email ученика и время начала урока.');
      return;
    }

    const startTime = new Date(newLesson.start);
    const endTime = new Date(startTime.getTime() + newLesson.duration * 60000);

    try {
      await addDoc(collection(db, 'lessons'), {
        userEmail: newLesson.studentEmail,
        userName: newLesson.studentName || newLesson.studentEmail, // сохраняем имя или, если оно не указано, email
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        title: `Урок (${newLesson.studentName || newLesson.studentEmail})`,
        paid: false, // по умолчанию урок не оплачен
      });
      alert('Урок добавлен успешно!');
      setNewLesson({ studentEmail: '', studentName: '', start: '', duration: 60 });
    } catch (error) {
      console.error('Ошибка при добавлении урока:', error);
    }
  };

  const handleDeleteLesson = async (id) => {
    const confirmDelete = window.confirm('Вы уверены, что хотите удалить этот урок?');
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, 'lessons', id));
        alert('Урок успешно удалён.');
      } catch (error) {
        console.error('Ошибка при удалении урока:', error);
      }
    }
  };

  // Функция переключения статуса оплаты
  const handleTogglePaid = async (lessonId, currentPaid) => {
    try {
      await updateDoc(doc(db, 'lessons', lessonId), { paid: !currentPaid });
    } catch (error) {
      console.error('Ошибка обновления статуса оплаты:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Roboto, sans-serif' }}>
      <h1 style={{ color: '#2c3e50', fontSize: '32px', fontWeight: 'bold' }}>Админ-панель</h1>

      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)' }}>
        <h3>Добавить новый урок</h3>
        {/* Поле ввода имени ученика */}
        <input
          type="text"
          placeholder="Имя ученика"
          value={newLesson.studentName}
          onChange={(e) => setNewLesson({ ...newLesson, studentName: e.target.value })}
          style={{ padding: '10px', width: '100%', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <input
          type="email"
          placeholder="Email ученика"
          value={newLesson.studentEmail}
          onChange={(e) => setNewLesson({ ...newLesson, studentEmail: e.target.value })}
          style={{ padding: '10px', width: '100%', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <input
          type="datetime-local"
          value={newLesson.start}
          onChange={(e) => setNewLesson({ ...newLesson, start: e.target.value })}
          style={{ padding: '10px', width: '100%', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <select
          value={newLesson.duration}
          onChange={(e) => setNewLesson({ ...newLesson, duration: Number(e.target.value) })}
          style={{ padding: '10px', width: '100%', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        >
          <option value={45}>45 минут</option>
          <option value={60}>60 минут</option>
          <option value={90}>90 минут</option>
        </select>
        <button
          onClick={handleAddLesson}
          style={{ padding: '10px 20px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
        >
          Добавить урок
        </button>
      </div>

      <h2>Календарь уроков</h2>
      <Calendar
        localizer={localizer}
        events={lessons.map(lesson => ({
          title: lesson.userName || lesson.userEmail,
          start: new Date(lesson.start),
          end: new Date(lesson.end),
          id: lesson.id,
        }))}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500, marginBottom: '30px', border: '1px solid #ddd', borderRadius: '8px' }}
      />

      <h2>Все забронированные уроки</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>Имя ученика</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>Дата и время</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>Оплата</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>Действие</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map(lesson => (
            <tr key={lesson.id} style={{ backgroundColor: '#ffffff', textAlign: 'center' }}>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                {lesson.userName || lesson.userEmail}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                {format(new Date(lesson.start), 'dd MMMM yyyy, HH:mm', { locale: ru })}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                <button
                  onClick={() => handleTogglePaid(lesson.id, lesson.paid)}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: lesson.paid ? '#2ecc71' : '#e67e22',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  {lesson.paid ? 'Оплачено' : 'Не оплачено'}
                </button>
              </td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                <button
                  onClick={() => handleDeleteLesson(lesson.id)}
                  style={{ padding: '5px 10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDashboard;
