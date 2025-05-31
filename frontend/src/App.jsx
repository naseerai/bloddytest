import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/login/Login'
import GuestLogin from './components/login/GuestLogin'
import Dashboard from "./components/Dashboard"
import './App.css'

// Add a route protector component
const ProtectedRoute = ({ children }) => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  return currentUser ? children : <Navigate to="/" replace />;
};

// Component to redirect to dashboard with default tab
const DashboardRedirect = () => {
  return <Navigate to="/dashboard?tab=dashboard" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/guestlogin" element={<GuestLogin />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        {/* Redirect /dashboard without tab to /dashboard?tab=dashboard */}
        <Route 
          path="/dashboard-redirect" 
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  )
}

export default App;