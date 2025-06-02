import React from 'react';
import '../styles/Sidebar.css';
import { IoLogOutOutline } from "react-icons/io5";
import { AiOutlineDashboard } from "react-icons/ai";
import { MdOutlineDevices } from "react-icons/md";
import { FaCrown } from "react-icons/fa6";
import { HiUsers } from "react-icons/hi";
import { IoLogoElectron } from "react-icons/io5";
import { GoSidebarCollapse, GoSidebarExpand } from "react-icons/go";
import { MdAccessTime, MdQueue, MdHistory, MdNotifications } from "react-icons/md";
import { FaUserClock } from "react-icons/fa";

const Sidebar = ({ currentUser, sidebarCollapsed, setSidebarCollapsed, activeTab, setActiveTab, onLogout }) => {
  const getMenuItems = () => {
    const items = [
      { key: 'dashboard', label: 'Dashboard', icon: <AiOutlineDashboard className="menu-icon" /> },
      { key: 'devices', label: 'Devices', icon: <MdOutlineDevices className="menu-icon" /> }
    ];

    // Role-based menu items
    if (['superadmin', 'admin'].includes(currentUser.role)) {
      items.push({ key: 'users', label: 'Users', icon: <HiUsers className="menu-icon" /> });
    }

    if (currentUser.role === 'superadmin') {
      items.push({ key: 'admins', label: 'Admins', icon: <FaCrown className="menu-icon" /> });
    }

    // Guest management items based on role
    if (currentUser.role === 'superadmin') {
      items.push(
        { key: 'active-guests', label: 'Active Guests', icon: <FaUserClock className="menu-icon" /> },
        { key: 'guest-queues', label: 'Guest Queues', icon: <MdQueue className="menu-icon" /> },
        { key: 'session-logs', label: 'Session Logs', icon: <MdHistory className="menu-icon" /> },
        { key: 'time-requests', label: 'Time Requests', icon: <MdNotifications className="menu-icon" /> }
      );
    } else if (currentUser.role === 'admin') {
      items.push(
        { key: 'active-guests', label: 'Active Guests', icon: <FaUserClock className="menu-icon" /> },
        { key: 'guest-queues', label: 'Guest Queues', icon: <MdQueue className="menu-icon" /> },
        { key: 'time-requests', label: 'Time Requests', icon: <MdNotifications className="menu-icon" /> }
      );
    } else if (currentUser.role === 'user') {
      items.push(
        { key: 'guest-queues', label: 'Queues', icon: <MdQueue className="menu-icon" /> }
      );
    }

    return items;
  };

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="logo">
        <IoLogoElectron className="logo-icon" />
        {!sidebarCollapsed && <span className="logo-text">Logo</span>}
      </div>
      
      <button 
        className="collapse-btn"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? 
          <GoSidebarExpand className="collapse-icon" /> : 
          <GoSidebarCollapse className="collapse-icon" />
        }
      </button>

      <ul className="menu">
        {getMenuItems().map(item => (
          <li 
            key={item.key}
            className={`menu-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => setActiveTab(item.key)}
            title={sidebarCollapsed ? item.label : ''}
          >
            {item.icon}
            {!sidebarCollapsed && <span className="menu-label">{item.label}</span>}
          </li>
        ))}
      </ul>

      <div 
        className="menu-item logout-item"
        onClick={onLogout}
        title={sidebarCollapsed ? 'Logout' : ''}
      >
        <IoLogOutOutline className="menu-icon" />
        {!sidebarCollapsed && <span className="menu-label">Logout</span>}
      </div>
    </div>
  );
};

export default Sidebar;