import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserModal from './pages/UserModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Get current user with error handling
  let currentUser;
  try {
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) throw new Error('No user found');
  } catch (error) {
    console.error('Auth error:', error);
    localStorage.removeItem('currentUser');
    navigate('/');
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  const getMenuItems = () => {
    const items = [
      { key: '1', label: 'Dashboard', icon: '📊' }
    ];

    if (['superadmin', 'admin'].includes(currentUser.role)) {
      items.push({ key: '2', label: 'User Management', icon: '👥' });
    }

    if (currentUser.role === 'superadmin') {
      items.push({ key: '3', label: 'Admin Settings', icon: '⚙️' });
    }

    return items;
  };

  const renderContent = () => {
    switch (currentUser.role) {
      case 'superadmin':
        return (
          <div className="content-card">
            <h2>Superadmin Dashboard</h2>
            <p>Welcome Superadmin! You can manage everything.</p>
            <UserModal currentUser={currentUser} />
          </div>
        );
      case 'admin':
        return (
          <div className="content-card">
            <h2>Admin Dashboard</h2>
            <p>Welcome Admin! You can manage users.</p>
            <UserModal currentUser={currentUser} />
          </div>
        );
      case 'user':
        return (
          <div className="content-card">
            <h2>User Dashboard</h2>
            <p>Welcome User! Here's your dashboard.</p>
            <UserModal currentUser={currentUser} />
          </div>
        );
      default: // guest
        return (
          <div className="content-card">
            <h2>Guest Dashboard</h2>
            <p>Welcome Guest! Enjoy your temporary access.</p>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo">Logo</div>
        <button 
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? '>' : '<'}
        </button>
        
        <ul className="menu">
          {getMenuItems().map(item => (
            <li key={item.key} className="menu-item">
              <span className="menu-icon">{item.icon}</span>
              {!sidebarCollapsed && item.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <div className="header">
          <div className="user-info">
            <span>{currentUser.email}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="content-area">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;