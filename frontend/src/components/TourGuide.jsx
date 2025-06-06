import React, { useRef, useState, useEffect } from 'react';
import { Tour } from 'antd';
import { QuestionCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';

const TourGuide = ({ currentUser, activeTab }) => {
  const [open, setOpen] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  
  // Refs for tour targets
  const devicesButtonRef = useRef(null);
  const statsRef = useRef(null);
  const quickActionsRef = useRef(null);
  const guestInfoRef = useRef(null);

  // Check if user has seen the tour
  useEffect(() => {
    if (currentUser?.role === 'guest') {
      const tourKey = `tour_seen_${currentUser.email}`;
      const seen = localStorage.getItem(tourKey);
      setHasSeenTour(!!seen);
    }
  }, [currentUser]);

  // Auto-start tour for new guests
  useEffect(() => {
    if (currentUser?.role === 'guest' && !hasSeenTour && activeTab === 'dashboard') {
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, hasSeenTour, activeTab]);

  // Guest dashboard tour steps
  const guestTourSteps = [
    {
      title: '🎯 Welcome to Guest Access!',
      description: 'This dashboard shows your limited access privileges. You can access IoT projects for 60 seconds each.',
      target: () => statsRef.current,
      placement: 'bottom',
    },
    {
      title: '📊 Your Access Statistics',
      description: 'These cards show your current privileges: 60-second sessions, session timer, and extension requests.',
      target: () => statsRef.current,
      placement: 'top',
    },
    {
      title: '📋 Guest Access Rules',
      description: 'Important information about your session limits, queue system, and how to request more time.',
      target: () => guestInfoRef.current,
      placement: 'top',
    },
    {
      title: '🚀 Quick Actions',
      description: 'Use this button to browse and access available IoT projects. Click here when you\'re ready to start!',
      target: () => quickActionsRef.current,
      placement: 'top',
    },
  ];

  // Device page tour steps
  const deviceTourSteps = [
    {
      title: '🔧 IoT Projects',
      description: 'Here you can see all available IoT projects. Each project has different sensors and controls.',
      target: () => document.querySelector('.devices-container'),
      placement: 'bottom',
    },
    {
      title: '⏰ Session Timer',
      description: 'When you start a session, you\'ll see a timer showing your remaining 60 seconds.',
      target: () => document.querySelector('.device-card'),
      placement: 'top',
    },
    {
      title: '🎮 Controls',
      description: 'Use these buttons to interact with the IoT device. Try different controls to see live responses!',
      target: () => document.querySelector('.device-controls'),
      placement: 'left',
    },
  ];

  const handleTourComplete = () => {
    setOpen(false);
    if (currentUser?.role === 'guest') {
      const tourKey = `tour_seen_${currentUser.email}`;
      localStorage.setItem(tourKey, 'true');
      setHasSeenTour(true);
    }
  };

  const startTour = () => {
    setOpen(true);
  };

  // Only show for guests
  if (currentUser?.role !== 'guest') {
    return null;
  }

  const currentSteps = activeTab === 'devices' ? deviceTourSteps : guestTourSteps;

  return (
    <>
      {/* Tour Guide Section */}
      <div className="tour-guide-container" ref={statsRef}>
        <button 
          className="tour-start-btn" 
          onClick={startTour}
          type="button"
        >
          <PlayCircleOutlined />
          {hasSeenTour ? 'Replay Guide' : 'Start Guide Tour'}
        </button>
        
        {!hasSeenTour && (
          <div className="tour-guide-info">
            <QuestionCircleOutlined className="info-icon" />
            <p>
              New to the system? Take a quick guided tour to learn how to use the dashboard and access IoT projects!
            </p>
          </div>
        )}
      </div>

      {/* Invisible refs for tour targeting */}
      <div ref={devicesButtonRef} style={{ position: 'absolute', visibility: 'hidden' }} />
      <div ref={quickActionsRef} style={{ position: 'absolute', visibility: 'hidden' }} />
      <div ref={guestInfoRef} style={{ position: 'absolute', visibility: 'hidden' }} />

      {/* Tour Component */}
      <Tour 
        open={open} 
        onClose={handleTourComplete}
        steps={currentSteps}
        type="primary"
        arrow={true}
        placement="bottom"
        mask={{
          style: {
            boxShadow: 'inset 0 0 15px #fff',
          },
        }}
      />
    </>
  );
};

export default TourGuide;