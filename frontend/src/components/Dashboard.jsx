import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Sidebar from './pages/Sidebar';
import UserManagement from './pages/UserManagement';
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
      case 'dashboard':
      default:
        switch (currentUser.role) {
          case 'superadmin':
            return (
              <div className="content-card">
                <h2>Superadmin Dashboard</h2>
                <p>Welcome Superadmin! You can manage everything.</p>
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
                </div>
              </div>
            );
          case 'admin':
            return (
              <div className="content-card">
                <h2>Admin Dashboard</h2>
                <p>Welcome Admin! You can manage users.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                      <h3>User Management</h3>
                      <p>Manage system users</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          case 'user':
            return (
              <div className="content-card">
                <h2>User Dashboard</h2>
                <p>Welcome User! Here's your dashboard.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-info">
                      <h3>Your Profile</h3>
                      <p>View and manage your profile</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          default: // guest
            return (
              <div className="content-card">
                <h2>Guest Dashboard</h2>
                <p>Welcome Guest! Enjoy your temporary access.</p>
                <div className="dashboard-stats">
                  <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-info">
                      <h3>Limited Access</h3>
                      <p>Explore available features</p>
                    </div>
                  </div>
                </div>
              </div>
            );
        }
    }
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
            <h1>{activeTab === 'dashboard' ? 'Dashboard' : 
                 activeTab === 'users' ? 'User Management' : 
                 activeTab === 'admins' ? 'Admin Management' : 'Dashboard'}</h1>
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