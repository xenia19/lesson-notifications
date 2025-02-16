import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BookingCalendar from './BookingCalendar';
import AdminDashboard from './AdminDashboard';
import Auth from './Auth';
import { auth } from './firebase';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

function App() {
  const [persistenceSet, setPersistenceSet] = useState(false);

  useEffect(() => {
    // Устанавливаем постоянство до рендера приложения
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Persistence установлена в local");
        setPersistenceSet(true);
      })
      .catch((error) => {
        console.error("Ошибка установки persistence:", error);
      });
  }, []);

  if (!persistenceSet) {
    // Пока не установлено постоянство, показываем загрузку
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<BookingCalendar />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
