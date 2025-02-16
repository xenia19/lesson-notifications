import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from './firebase';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);

  // Вход через Google
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
    } catch (error) {
      console.error('Ошибка при входе через Google:', error);
    }
  };

  // Регистрация с Email и паролем
  const handleSignUp = async () => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      alert('Регистрация прошла успешно');
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      alert('Ошибка при регистрации');
    }
  };

  // Вход с Email и паролем
  const handleSignIn = async () => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
    } catch (error) {
      console.error('Ошибка при входе:', error);
    }
  };

  // Выход из системы
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <h2>Аутентификация</h2>

      {user ? (
        <div>
          <p>Добро пожаловать, {user.displayName || user.email}</p>
          <button onClick={handleSignOut} style={{ padding: '10px', backgroundColor: 'red', color: 'white' }}>
            Выйти
          </button>
        </div>
      ) : (
        <div>
          <button onClick={handleGoogleSignIn} style={{ padding: '10px', backgroundColor: '#4285F4', color: 'white', marginBottom: '10px' }}>
            Войти через Google
          </button>

          <div>
            <h3>Вход или регистрация через Email</h3>
            <input
              type="email"
              placeholder="Введите email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '5px', marginBottom: '10px', width: '100%' }}
            />
            <input
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '5px', marginBottom: '10px', width: '100%' }}
            />
            <div>
              <button onClick={handleSignIn} style={{ padding: '10px', backgroundColor: 'green', color: 'white', marginRight: '10px' }}>
                Войти
              </button>
              <button onClick={handleSignUp} style={{ padding: '10px', backgroundColor: 'blue', color: 'white' }}>
                Зарегистрироваться
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Auth;
