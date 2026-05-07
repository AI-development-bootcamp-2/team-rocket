import React from 'react';
import styles from './App.module.css';
import { LoginCard } from './components/LoginCard';

function App() {
  const handleLoginSubmit = (email: string, password: string) => {
    console.log('Login submitted:', { email, password });
  };

  return (
    <div className={styles.App}>
      <main className={styles['App-main']}>
        <LoginCard onSubmit={handleLoginSubmit} />
      </main>
    </div>
  );
}

export default App;
