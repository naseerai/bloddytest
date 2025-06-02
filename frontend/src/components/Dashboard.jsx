import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Sidebar from './pages/Sidebar';
import UserManagement from './pages/UserManagement';
import Devices from './pages/Devices';
import { ActiveGuests, GuestQueues, SessionLogs, TimeRequests } from './pages/GuestManagement';
import '../components/styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Get tab from URL params or default to 'dashboard'
  const currentTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(currentTab);
  
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

  // Update activeTab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'dashboard';
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  // Function to handle tab changes and update URL
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement currentUser={currentUser} userType="user" />;
      case 'admins':
        return <UserManagement currentUser={currentUser} userType="admin" />;
      case 'devices':
        return <Devices currentUser={currentUser} />;
      case 'active-guests':
        return <ActiveGuests currentUser={currentUser} />;
      case 'guest-queues':
        return <GuestQueues currentUser={currentUser} />;
      case 'session-logs':
        return <SessionLogs currentUser={currentUser} />;
      case 'time-requests':
        return <TimeRequests currentUser={currentUser} />;
      case 'dashboard':
      default:
        switch (currentUser.role) {
          case 'superadmin':
            return (
              <div className="content-card">
                <h2>Superadmin Dashboard</h2>
                <p>Welcome Superadmin! You have complete system control.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                      <h3>Total Users</h3>
                      <p>Manage all users in the system</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⚙️</div>
                    <div className="stat-info">
                      <h3>Admin Management</h3>
                      <p>Control admin privileges</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-info">
                      <h3>Project Access Control</h3>
                      <p>Manage project sessions and queues</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-info">
                      <h3>Session Analytics</h3>
                      <p>View detailed logs and reports</p>
                    </div>
                  </div>
                </div>
                
                <div className="quick-actions">
                  <h3>Quick Actions</h3>
                  <div className="action-buttons">
                    <button onClick={() => handleTabChange('active-guests')} className="action-btn">
                      View Active Sessions
                    </button>
                    <button onClick={() => handleTabChange('time-requests')} className="action-btn">
                      Process Time Requests
                    </button>
                    <button onClick={() => handleTabChange('session-logs')} className="action-btn">
                      View Session Logs
                    </button>
                  </div>
                </div>
              </div>
            );
          case 'admin':
            return (
              <div className="content-card">
                <h2>Admin Dashboard</h2>
                <p>Welcome Admin! You can manage users and guest sessions.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                      <h3>User Management</h3>
                      <p>Manage system users</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-info">
                      <h3>Guest Session Control</h3>
                      <p>Monitor and manage guest access</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📋</div>
                    <div className="stat-info">
                      <h3>Queue Management</h3>
                      <p>Handle project access queues</p>
                    </div>
                  </div>
                </div>
                
                <div className="quick-actions">
                  <h3>Quick Actions</h3>
                  <div className="action-buttons">
                    <button onClick={() => handleTabChange('active-guests')} className="action-btn">
                      Manage Active Guests
                    </button>
                    <button onClick={() => handleTabChange('time-requests')} className="action-btn">
                      Review Time Requests
                    </button>
                    <button onClick={() => handleTabChange('guest-queues')} className="action-btn">
                      Manage Queues
                    </button>
                  </div>
                </div>
              </div>
            );
          case 'user':
            return (
              <div className="content-card">
                <h2>User Dashboard</h2>
                <p>Welcome User! Access your projects and monitor queues.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-info">
                      <h3>Your Profile</h3>
                      <p>View and manage your profile</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🔧</div>
                    <div className="stat-info">
                      <h3>IoT Projects</h3>
                      <p>Access your assigned projects</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⏰</div>
                    <div className="stat-info">
                      <h3>Queue Status</h3>
                      <p>Monitor project access queues</p>
                    </div>
                  </div>
                </div>
                
                <div className="quick-actions">
                  <h3>Quick Actions</h3>
                  <div className="action-buttons">
                    <button onClick={() => handleTabChange('devices')} className="action-btn">
                      View Projects
                    </button>
                    <button onClick={() => handleTabChange('guest-queues')} className="action-btn">
                      Check Queues
                    </button>
                  </div>
                </div>
              </div>
            );
          default: // guest
            return (
              <div className="content-card">
                <h2>Guest Dashboard</h2>
                <p>Welcome Guest! You have limited access to IoT projects.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-info">
                      <h3>Limited Access</h3>
                      <p>60-second sessions per project</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⏱️</div>
                    <div className="stat-info">
                      <h3>Session Timer</h3>
                      <p>Monitor your remaining time</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-info">
                      <h3>Request Extensions</h3>
                      <p>Ask for additional time when needed</p>
                    </div>
                  </div>
                </div>
                
                <div className="guest-info">
                  <h3>Guest Access Rules</h3>
                  <ul>
                    <li>Each project session is limited to 60 seconds</li>
                    <li>You can request time extensions from administrators</li>
                    <li>You may need to wait in queue if projects are busy</li>
                    <li>Higher priority users may bypass your session</li>
                  </ul>
                </div>
                
                <div className="quick-actions">
                  <h3>Quick Actions</h3>
                  <div className="action-buttons">
                    <button onClick={() => handleTabChange('devices')} className="action-btn">
                      Browse Projects
                    </button>
                  </div>
                </div>
              </div>
            );
        }
    }
  };

  const getPageTitle = () => {
    const titles = {
      'dashboard': 'Dashboard',
      'users': 'User Management',
      'admins': 'Admin Management',
      'devices': 'IoT Projects',
      'active-guests': 'Active Guest Sessions',
      'guest-queues': 'Project Queues',
      'session-logs': 'Session Logs',
      'time-requests': 'Time Extension Requests'
    };
    return titles[activeTab] || 'Dashboard';
  };

  return (
    <div className="dashboard-container">
      <Sidebar 
        currentUser={currentUser}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
      />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="header">
          <div className="header-title">
            <h1>{getPageTitle()}</h1>
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="user-email">{currentUser.email}</span>
              <span className={`user-role role-${currentUser.role}`}>{currentUser.role}</span>
            </div>
          </div>
        </div>

        <div className="content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;