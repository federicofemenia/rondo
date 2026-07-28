import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('Checking connection…');

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3000/health');
        const payload = await response.json();
        setStatus(payload.ok ? 'API online' : 'API returned an unexpected payload');
      } catch {
        setStatus('API offline');
      }
    };

    void loadStatus();
  }, []);

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <h1>Rondo</h1>
      <p>Repository foundation is live.</p>
      <p>Status: {status}</p>
    </main>
  );
}

export default App;
