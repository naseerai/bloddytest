import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Line, Column, Pie, Area } from '@antv/g2plot';
import Sidebar from './pages/Sidebar';
import UserManagement from './pages/UserManagement';
import Devices from './pages/Devices';
import { ActiveGuests, GuestQueues, SessionLogs, TimeRequests } from './pages/GuestManagement';
import TourGuide from './TourGuide';
import '../components/styles/Dashboard.css';
import { MdOutlineTrendingUp } from "react-icons/md";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    dailyAccess: [],
    projectAccess: [],
    userRoleDistribution: [],
    hourlyAccess: [],
    weeklyAccess: [],
    monthlyAccess: [],
    topUsers: [],
    sessionDuration: { sessions: [], roleAverages: [] }
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    days: 7,
    limit: 1000
  });
  
  // Refs for G2plot containers
  const dailyAccessRef = useRef(null);
  const projectAccessRef = useRef(null);
  const userRoleRef = useRef(null);
  const hourlyAccessRef = useRef(null);
  const weeklyAccessRef = useRef(null);
  const monthlyAccessRef = useRef(null);
  
  // Chart instances
  const chartsRef = useRef({});
  
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

  // Check if user should see analytics
  const shouldShowAnalytics = ['superadmin', 'admin', 'user'].includes(currentUser.role);

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

  // Fetch analytics data with role-based filtering
  const fetchAnalyticsData = async (filters = {}) => {
    if (!shouldShowAnalytics) return;
    
    setAnalyticsLoading(true);
    try {
      // Import the analytics service
      const { AnalyticsService } = await import('./services/analyticsService');
      
      // Apply role-based filtering
      const data = await AnalyticsService.fetchRoleBasedAnalytics(
        currentUser.role,
        currentUser.email,
        { ...analyticsFilters, ...filters }
      );
      
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      
      // Fallback to mock data if Firebase fails (only for non-guests)
      if (shouldShowAnalytics) {
        const mockData = generateMockAnalyticsData();
        setAnalyticsData(mockData);
      }
    } finally {
      setAnalyticsLoading(false);
    }
  };

// Generate mock data based on user role
const generateMockAnalyticsData = () => {
  const now = new Date();
  const projects = ['fleet_tracking', 'smart_home', 'weather_station', 'security_system']; // ✅ Uncommented this line
  const roles = ['guest', 'user', 'admin', 'superadmin'];
  
  // Filter projects based on user role
  let availableProjects = projects;
  if (currentUser.role === 'user') {
    // Users might only see assigned projects
    availableProjects = projects.slice(0, 2); // Example: only first 2 projects
  }
  
  // Generate role-appropriate data
  const generateDailyData = (days) => {
    const dailyData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyData.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        accesses: Math.floor(Math.random() * 50) + 10,
        uniqueUsers: Math.floor(Math.random() * 20) + 5
      });
    }
    return dailyData;
  };
  
  const generateProjectData = () => {
    return availableProjects.map(project => ({
      project: project.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      accesses: Math.floor(Math.random() * 100) + 20,
      sessions: Math.floor(Math.random() * 80) + 15,
      uniqueUsers: Math.floor(Math.random() * 30) + 10,
      projectId: project
    }));
  };
  
  const generateRoleData = () => {
    // Show different role distributions based on user role
    let availableRoles = roles;
    if (currentUser.role === 'user') {
      availableRoles = ['user']; // Users might only see their own role data
    } else if (currentUser.role === 'admin') {
      availableRoles = ['guest', 'user', 'admin']; // Admins might not see superadmin data
    }
    
    return availableRoles.map(role => ({
      role: role.charAt(0).toUpperCase() + role.slice(1),
      count: Math.floor(Math.random() * 30) + 5,
      percentage: Math.floor(Math.random() * 40) + 10
    }));
  };
  
  const generateHourlyData = () => {
    const hourlyData = [];
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        accesses: Math.floor(Math.random() * 20) + 1,
        uniqueUsers: Math.floor(Math.random() * 10) + 1
      });
    }
    return hourlyData;
  };
  
  return {
    dailyAccess: generateDailyData(analyticsFilters.days),
    projectAccess: generateProjectData(),
    userRoleDistribution: generateRoleData(),
    hourlyAccess: generateHourlyData(),
    weeklyAccess: generateDailyData(4).map((item, index) => ({
      ...item,
      week: `Week ${index + 1}`
    })),
    monthlyAccess: generateDailyData(6).map((item, index) => ({
      ...item,
      month: new Date(now.getFullYear(), now.getMonth() - index, 1)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    })),
    topUsers: [],
    sessionDuration: { sessions: [], roleAverages: [] }
  };
};

  // Initialize analytics data
  useEffect(() => {
    if (activeTab === 'dashboard' && shouldShowAnalytics) {
      fetchAnalyticsData();
    }
  }, [activeTab, currentUser.role]);

  // Create charts when data is available
  useEffect(() => {
    if (analyticsData.dailyAccess.length > 0 && activeTab === 'dashboard' && shouldShowAnalytics) {
      createCharts();
    }
    
    return () => {
      // Cleanup charts
      Object.values(chartsRef.current).forEach(chart => {
        if (chart && chart.destroy) {
          chart.destroy();
        }
      });
      chartsRef.current = {};
    };
  }, [analyticsData, activeTab]);

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setAnalyticsFilters(prev => ({ ...prev, ...newFilters }));
    fetchAnalyticsData(newFilters);
  };

  const createCharts = () => {
    // Daily Access Trend
    if (dailyAccessRef.current) {
      const dailyChart = new Line(dailyAccessRef.current, {
        data: analyticsData.dailyAccess,
        xField: 'day',
        yField: 'accesses',
        smooth: true,
        color: '#1890ff',
        point: {
          size: 5,
          shape: 'diamond',
          style: {
            fill: 'white',
            stroke: '#1890ff',
            lineWidth: 2,
          },
        },
        tooltip: {
          formatter: (datum) => {
            return { 
              name: 'Daily Access', 
              value: `${datum.accesses} accesses (${datum.uniqueUsers || 0} users)` 
            };
          },
        },
        yAxis: {
          title: {
            text: 'Number of Accesses',
          },
        },
        xAxis: {
          title: {
            text: `Last ${analyticsFilters.days} Days`,
          },
        },
      });
      dailyChart.render();
      chartsRef.current.dailyChart = dailyChart;
    }

    // Project Access Distribution
    if (projectAccessRef.current) {
      const projectChart = new Column(projectAccessRef.current, {
        data: analyticsData.projectAccess,
        xField: 'project',
        yField: 'accesses',
        color: '#52c41a',
        columnWidthRatio: 0.6,
        tooltip: {
          formatter: (datum) => {
            return { 
              name: 'Project Access', 
              value: `${datum.accesses} sessions (${datum.uniqueUsers || 0} users)` 
            };
          },
        },
        yAxis: {
          title: {
            text: 'Total Accesses',
          },
        },
        xAxis: {
          title: {
            text: 'IoT Projects',
          },
        },
      });
      projectChart.render();
      chartsRef.current.projectChart = projectChart;
    }

    // User Role Distribution (only for superadmin and admin)
    if (userRoleRef.current && ['superadmin', 'admin','user'].includes(currentUser.role)) {
      const roleChart = new Pie(userRoleRef.current, {
        data: analyticsData.userRoleDistribution,
        angleField: 'count',
        colorField: 'role',
        radius: 0.8,
        label: {
          type: 'outer',
          content: '{name} ({percentage}%)',
        },
        interactions: [{ type: 'element-active' }],
        color: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
      });
      roleChart.render();
      chartsRef.current.roleChart = roleChart;
    }

    // Hourly Access Pattern
    if (hourlyAccessRef.current) {
      const hourlyChart = new Area(hourlyAccessRef.current, {
        data: analyticsData.hourlyAccess,
        xField: 'hour',
        yField: 'accesses',
        smooth: true,
        color: '#722ed1',
        areaStyle: {
          fill: 'l(270) 0:#722ed1 1:#d3adf7',
        },
        tooltip: {
          formatter: (datum) => {
            return { 
              name: 'Hourly Access', 
              value: `${datum.accesses} sessions (${datum.uniqueUsers || 0} users)` 
            };
          },
        },
        yAxis: {
          title: {
            text: 'Sessions',
          },
        },
        xAxis: {
          title: {
            text: 'Hour of Day',
          },
        },
      });
      hourlyChart.render();
      chartsRef.current.hourlyChart = hourlyChart;
    }
  };

  const renderAnalyticsFilters = () => {
    if (!shouldShowAnalytics) return null;

    return (
      <div className="analytics-filters" style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        padding: '15px',
        background: '#f5f5f5',
        borderRadius: '8px',
        alignItems: 'center'
      }}>
        <div className="filter-group">
          <label>Time Range:</label>
          <select 
            value={analyticsFilters.days} 
            onChange={(e) => handleFilterChange({ days: parseInt(e.target.value) })}
            style={{ marginLeft: '8px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 3 Months</option>
          </select>
        </div>
        
        {['superadmin', 'admin','user'].includes(currentUser.role) && (
          <div className="filter-group">
            <label>Data Limit:</label>
            <select 
              value={analyticsFilters.limit} 
              onChange={(e) => handleFilterChange({ limit: parseInt(e.target.value) })}
              style={{ marginLeft: '8px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value={500}>500 Records</option>
              <option value={1000}>1000 Records</option>
              <option value={2000}>2000 Records</option>
              <option value={5000}>5000 Records</option>
            </select>
          </div>
        )}
        
        <button 
          onClick={() => fetchAnalyticsData()}
          disabled={analyticsLoading}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: 'none',
            background: '#1890ff',
            color: 'white',
            cursor: analyticsLoading ? 'not-allowed' : 'pointer',
            opacity: analyticsLoading ? 0.6 : 1
          }}
        >
          {analyticsLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    );
  };

  const renderAnalyticsCharts = () => {
    if (!shouldShowAnalytics) return null;

    const getGridColumns = () => {
      switch (currentUser.role) {
        case 'superadmin':
          return 'repeat(auto-fit, minmax(400px, 1fr))';
        case 'admin':
          return 'repeat(auto-fit, minmax(450px, 1fr))';
        case 'user':
          return 'repeat(auto-fit, minmax(450px, 1fr))';
        default:
          return 'repeat(auto-fit, minmax(400px, 1fr))';
      }
    };

    return (
      <div className="analytics-grid" style={{
        display: 'grid',
        gridTemplateColumns: getGridColumns(),
        gap: '20px',
        marginBottom: '30px'
      }}>
        {/* Daily Access Trend - All roles */}
        <div className="chart-container" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minHeight: '300px'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#1890ff' }}>
            <MdOutlineTrendingUp style={{fontSize:"20px"}}/> Daily Access Trend
            {analyticsLoading && <span style={{ fontSize: '12px', color: '#666' }}> (Loading...)</span>}
          </h3>
          <div ref={dailyAccessRef} style={{ height: '250px' }}></div>
        </div>
        
        {/* Project Access Distribution - All roles */}
        <div className="chart-container" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minHeight: '300px'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#52c41a' }}>
            🎯 Project Access Distribution
          </h3>
          <div ref={projectAccessRef} style={{ height: '250px' }}></div>
        </div>
        
        {/* User Role Distribution - Superadmin and Admin only */}
        {['superadmin', 'admin','user'].includes(currentUser.role) && (
          <div className="chart-container" style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            minHeight: '300px'
          }}>
            <h3 style={{ marginBottom: '15px', color: '#faad14' }}>
              👥 User Role Distribution
            </h3>
            <div ref={userRoleRef} style={{ height: '250px' }}></div>
          </div>
        )}
        
        {/* Hourly Access Pattern - All roles */}
        <div className="chart-container" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minHeight: '300px'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#722ed1' }}>
            ⏰ Hourly Access Pattern
          </h3>
          <div ref={hourlyAccessRef} style={{ height: '250px' }}></div>
        </div>
      </div>
    );
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
              <div className="content-card fade-in-up">
                <h2>Superadmin Dashboard</h2>
                <p>Welcome back! You have complete system control and oversight.</p>
                
                {/* Analytics Filters */}
                {renderAnalyticsFilters()}
                
                {/* Analytics Charts Grid */}
                {renderAnalyticsCharts()}
              </div>
            );
          case 'admin':
            return (
              <div className="content-card fade-in-up">
                <h2>Admin Dashboard</h2>
                <p>Welcome back! You can manage users and monitor guest sessions effectively.</p>
                
                {/* Analytics Filters */}
                {renderAnalyticsFilters()}
                
                {/* Analytics Charts Grid */}
                {renderAnalyticsCharts()}
              </div>
            );
          case 'user':
            return (
              <div className="content-card fade-in-up">
                <h2>User Dashboard</h2>
                <p>Welcome back! Access your assigned projects and monitor your usage patterns.</p>
                
                {/* Analytics Filters */}
                {renderAnalyticsFilters()}
                
                {/* Analytics Charts Grid */}
                {renderAnalyticsCharts()}
                
              </div>
            );
          default: // guest
            return (
              <div className="content-card fade-in-up">
                {/* Tour Guide for Guests */}
                <TourGuide currentUser={currentUser} activeTab={activeTab} />
                
                <h2>Guest Dashboard</h2>
                <p>Welcome to our IoT platform! You have limited access to explore our projects.</p>
                
                <div className="dashboard-stats" data-tour="stats">
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
                
                <div className="guest-info" data-tour="guest-info">
                  <h3>🔍 Guest Access Rules</h3>
                  <ul>
                    <li>Each project session is limited to 60 seconds for exploration</li>
                    <li>You can request time extensions from administrators when needed</li>
                    <li>You may need to wait in queue if projects are currently in use</li>
                    <li>Registered users and admins may have priority access</li>
                    <li>Make the most of your time - try different controls and sensors!</li>
                  </ul>
                </div>
                
                <div className="quick-actions" data-tour="quick-actions">
                  <h3>🚀 Ready to Start?</h3>
                  <div className="action-buttons">
                    <button onClick={() => handleTabChange('devices')} className="action-btn">
                      Browse IoT Projects
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
            {shouldShowAnalytics && activeTab === 'dashboard' && (
              <span style={{ fontSize: '14px', color: '#666', marginLeft: '10px' }}>
                Analytics enabled for {currentUser.role}
              </span>
            )}
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