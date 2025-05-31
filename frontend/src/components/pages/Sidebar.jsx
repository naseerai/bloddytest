import React from 'react';
import '../styles/Sidebar.css';

const Sidebar = ({ currentUser, sidebarCollapsed, setSidebarCollapsed, activeTab, setActiveTab, onLogout }) => {
  const getMenuItems = () => {
    const items = [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' }
    ];

    if (['superadmin', 'admin'].includes(currentUser.role)) {
      items.push({ key: 'users', label: 'Users', icon: '👥' });
    }

    if (currentUser.role === 'superadmin') {
      items.push({ key: 'admins', label: 'Admins', icon: '⚙️' });
    }

    return items;
  };

  return (
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
          <li 
            key={item.key} 
            className={`menu-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => setActiveTab(item.key)}
          >
            <span className="menu-icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="menu-label">{item.label}</span>}
          </li>
        ))}
        
        <li className="menu-item logout-item" onClick={onLogout}>
          <span className="menu-icon">🚪</span>
          {!sidebarCollapsed && <span className="menu-label">Logout</span>}
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;