import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '20px' }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee'
      }}>
        <h1>Dashboard</h1>
        <div>
          {user?.displayName && <span style={{ marginRight: '10px' }}>Hello, {user.displayName}</span>}
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main>
        <h2>Welcome to your dashboard</h2>
        {/* Your dashboard content goes here */}
      </main>
    </div>
  );
};

export default Dashboard;