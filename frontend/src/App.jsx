import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import GuestLogin from './components/GuestLogin'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/guestlogin" element={<GuestLogin />} />
      </Routes>
    </Router>
  )
}

export default App;