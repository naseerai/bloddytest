import React, { useState, useEffect, useRef } from 'react';
import { realtimeDb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase'; // Firestore
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  updateDoc,
  serverTimestamp,
  addDoc,
  getDocs
} from 'firebase/firestore';
import '../styles/Devices.css';

const Devices = ({ currentUser }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Project access control states
  const [projectSessions, setProjectSessions] = useState({});
  const [queues, setQueues] = useState({});
  const [activeSession, setActiveSession] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [queuePosition, setQueuePosition] = useState(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [pendingProjectAccess, setPendingProjectAccess] = useState(null);
  
  // Refs for cleanup
  const sessionUnsubscribes = useRef({});
  const queueUnsubscribes = useRef({});
  const countdownInterval = useRef(null);

  useEffect(() => {
    if (!currentUser) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Load projects from Realtime Database
    const projectsRef = ref(realtimeDb, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const projectsArray = Object.entries(data).map(([id, project]) => ({
            id,
            name: project.name || 'Unnamed Project',
            description: project.description || 'No description',
            access: project.access || {},
            devices: getDevicesFromProject(project),
            alerts: project.alerts ? Object.values(project.alerts) : []
          }));
          setProjects(projectsArray);
        } else {
          setProjects([]);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error processing data:", err);
        setError(err.message);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      cleanupListeners();
    };
  }, [currentUser]);

  // Setup real-time listeners for project sessions and queues
  useEffect(() => {
    if (projects.length > 0) {
      setupProjectListeners();
    }
    return () => cleanupListeners();
  }, [projects]);

  const setupProjectListeners = () => {
    projects.forEach(project => {
      // Listen to active sessions
      const sessionQuery = query(
        collection(db, 'project_sessions'),
        where('projectId', '==', project.id)
      );
      
      sessionUnsubscribes.current[project.id] = onSnapshot(sessionQuery, (snapshot) => {
        const sessions = {};
        snapshot.forEach(doc => {
          sessions[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        setProjectSessions(prev => ({
          ...prev,
          [project.id]: sessions
        }));
      });

      // Listen to queues
      const queueQuery = query(
        collection(db, 'project_queues'),
        where('projectId', '==', project.id),
        orderBy('joinedAt', 'asc')
      );
      
      queueUnsubscribes.current[project.id] = onSnapshot(queueQuery, (snapshot) => {
        const queueItems = [];
        snapshot.forEach(doc => {
          queueItems.push({ id: doc.id, ...doc.data() });
        });
        
        setQueues(prev => ({
          ...prev,
          [project.id]: queueItems
        }));

        // Update queue position if user is in queue
        const userInQueue = queueItems.find(item => item.userId === currentUser.id);
        if (userInQueue) {
          const position = queueItems.findIndex(item => item.userId === currentUser.id) + 1;
          setQueuePosition(position);
        }
      });
    });
  };

  const cleanupListeners = () => {
    Object.values(sessionUnsubscribes.current).forEach(unsub => unsub());
    Object.values(queueUnsubscribes.current).forEach(unsub => unsub());
    sessionUnsubscribes.current = {};
    queueUnsubscribes.current = {};
    
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
  };

  const getDevicesFromProject = (project) => {
    try {
      if (project.devices) return Object.entries(project.devices).map(([id, device]) => ({ id, ...device }));
      if (project.vehicles) return Object.entries(project.vehicles).map(([id, vehicle]) => ({ id, type: 'vehicle', ...vehicle }));
      if (project.sensors) return Object.entries(project.sensors).map(([id, sensor]) => ({ id, type: 'sensor', ...sensor }));
      return [];
    } catch (error) {
      console.error("Error extracting devices:", error);
      return [];
    }
  };

  const filteredProjects = projects.filter(project => {
    try {
      if (!currentUser || !currentUser.role) return false;
      if (!project.access) return true;
      return project.access[currentUser.role] || project.access.guest;
    } catch (error) {
      console.error("Error filtering projects:", error);
      return false;
    }
  });

  const getProjectStatus = (projectId) => {
    const sessions = projectSessions[projectId] || {};
    const activeSession = Object.values(sessions).find(session => session.status === 'active');
    const queue = queues[projectId] || [];
    
    return {
      isOccupied: !!activeSession,
      activeSession,
      queueLength: queue.length,
      queue
    };
  };

  const canBypassQueue = (userRole) => {
    return ['superadmin', 'admin', 'user'].includes(userRole);
  };

  const startGuestSession = async (projectId) => {
    try {
      const sessionData = {
        projectId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        status: 'active',
        startTime: serverTimestamp(),
        endTime: new Date(Date.now() + 60000), // 60 seconds
        sessionType: 'guest'
      };

      const docRef = await addDoc(collection(db, 'project_sessions'), sessionData);
      setActiveSession({ id: docRef.id, ...sessionData });
      setCountdown(60);
      
      // Start countdown
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            endSession(docRef.id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting guest session:', error);
      setError('Failed to start session');
    }
  };

  const startRegularSession = async (projectId) => {
    try {
      const sessionData = {
        projectId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        status: 'active',
        startTime: serverTimestamp(),
        sessionType: 'regular'
      };

      const docRef = await addDoc(collection(db, 'project_sessions'), sessionData);
      setActiveSession({ id: docRef.id, ...sessionData });
    } catch (error) {
      console.error('Error starting regular session:', error);
      setError('Failed to start session');
    }
  };

  const endSession = async (sessionId) => {
    try {
      if (sessionId) {
        await deleteDoc(doc(db, 'project_sessions', sessionId));
      }
      
      setActiveSession(null);
      setSelectedProject(null);
      setCountdown(0);
      
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }

      // Process queue for next user
      if (pendingProjectAccess) {
        processQueue(pendingProjectAccess);
        setPendingProjectAccess(null);
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const joinQueue = async (projectId) => {
    try {
      const queueData = {
        projectId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        joinedAt: serverTimestamp(),
        status: 'waiting'
      };

      await addDoc(collection(db, 'project_queues'), queueData);
      setShowQueueModal(false);
    } catch (error) {
      console.error('Error joining queue:', error);
      setError('Failed to join queue');
    }
  };

  const processQueue = async (projectId) => {
    try {
      const queue = queues[projectId] || [];
      if (queue.length === 0) return;

      // Sort by priority: superadmin > admin > user > guest
      const priorityOrder = { superadmin: 1, admin: 2, user: 3, guest: 4 };
      const sortedQueue = [...queue].sort((a, b) => {
        const priorityA = priorityOrder[a.userRole] || 5;
        const priorityB = priorityOrder[b.userRole] || 5;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(a.joinedAt) - new Date(b.joinedAt);
      });

      const nextUser = sortedQueue[0];
      
      // Remove from queue
      await deleteDoc(doc(db, 'project_queues', nextUser.id));
      
      // If it's the current user, start their session
      if (nextUser.userId === currentUser.id) {
        if (nextUser.userRole === 'guest') {
          await startGuestSession(projectId);
        } else {
          await startRegularSession(projectId);
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  };

  const requestExtendedTime = async (additionalMinutes) => {
    try {
      const requestData = {
        projectId: activeSession.projectId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        requestedTime: additionalMinutes,
        currentSessionId: activeSession.id,
        status: 'pending',
        requestedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'time_extension_requests'), requestData);
      alert('Time extension request sent to administrators');
    } catch (error) {
      console.error('Error requesting time extension:', error);
    }
  };

  const terminateSession = async (sessionId) => {
    if (['superadmin', 'admin'].includes(currentUser.role)) {
      try {
        await deleteDoc(doc(db, 'project_sessions', sessionId));
        alert('Session terminated successfully');
      } catch (error) {
        console.error('Error terminating session:', error);
      }
    }
  };

  const handleProjectAccess = async (project) => {
    const status = getProjectStatus(project.id);
    
    if (!status.isOccupied) {
      // Project is free
      if (currentUser.role === 'guest') {
        await startGuestSession(project.id);
      } else {
        await startRegularSession(project.id);
      }
      setSelectedProject(project);
    } else {
      // Project is occupied
      const activeSession = status.activeSession;
      
      if (currentUser.role === 'guest') {
        if (activeSession.userRole === 'guest') {
          // Another guest is active, show queue option
          setShowQueueModal(true);
          setPendingProjectAccess(project.id);
        } else {
          // Higher priority user is active
          alert('Dashboard is under maintenance. Please try again later.');
        }
      } else {
        // Current user can bypass guest sessions
        if (activeSession.userRole === 'guest') {
          alert('Waiting for current guest session to end...');
          setPendingProjectAccess(project.id);
        } else {
          // Another regular user is active
          setShowQueueModal(true);
          setPendingProjectAccess(project.id);
        }
      }
    }
  };

  const handleBackToList = () => {
    if (activeSession) {
      endSession(activeSession.id);
    }
    setSelectedProject(null);
  };

  if (loading) return (
    <div className="content-card">
      <h2>Loading IoT Projects...</h2>
      <p>Please wait while we fetch your devices.</p>
    </div>
  );

  if (error) return (
    <div className="content-card error">
      <h2>Error Loading Devices</h2>
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </div>
  );

  // Queue Modal
  if (showQueueModal) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Dashboard is Busy</h3>
          <p>The project dashboard is currently being used by another user.</p>
          <p>Do you want to join the queue?</p>
          {queuePosition && (
            <div className="queue-info">
              <p>Your position in queue: {queuePosition}</p>
              <p>Estimated wait time: {queuePosition * 2} minutes</p>
            </div>
          )}
          <div className="modal-actions">
            <button onClick={() => joinQueue(pendingProjectAccess)} className="btn-primary">
              Join Queue
            </button>
            <button onClick={() => setShowQueueModal(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render detailed view if a project is selected
  if (selectedProject) {
    return (
      <div className="content-card">
        <div className="project-header">
          <button onClick={handleBackToList} className="back-button">
            &larr; Back to Projects
          </button>
          
          {activeSession && currentUser.role === 'guest' && (
            <div className="session-timer">
              <span className="timer-text">Time remaining: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
              <button 
                onClick={() => requestExtendedTime(5)} 
                className="extend-time-btn"
                disabled={countdown < 10}
              >
                Request +5 min
              </button>
            </div>
          )}
        </div>
        
        <h2>{selectedProject.name}</h2>
        <p className="project-description">{selectedProject.description}</p>
        
        <div className="project-details">
          <h3>Devices ({selectedProject.devices.length})</h3>
          <div className="devices-grid">
            {selectedProject.devices.map(device => (
              <div key={device.id} className="device-card">
                <h4>{device.id}</h4>
                <p>Type: {device.type || 'device'}</p>
                <p>Status: {device.status || 'no status'}</p>
                {device.lastSeen && <p>Last seen: {device.lastSeen}</p>}
              </div>
            ))}
          </div>
          
          {selectedProject.alerts.length > 0 && (
            <>
              <h3>Alerts ({selectedProject.alerts.length})</h3>
              <div className="alerts-grid">
                {selectedProject.alerts.map((alert, index) => (
                  <div key={index} className={`alert-card alert-${alert.priority || 'medium'}`}>
                    <h4>{alert.title || 'Alert'}</h4>
                    <p>{alert.message}</p>
                    {alert.timestamp && <p>Time: {alert.timestamp}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render projects list
  return (
    <div className="content-card">
      <h2>IoT Projects</h2>
      
      {filteredProjects.length === 0 ? (
        <div>
          <p>No IoT projects found that match your access level.</p>
          {projects.length > 0 && (
            <p>Found {projects.length} total projects, but none match your access permissions.</p>
          )}
          <button onClick={() => {
            setLoading(true);
            setError(null);
            window.location.reload();
          }}>
            Refresh Data
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map(project => {
            const status = getProjectStatus(project.id);
            return (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <p className="project-description">{project.description}</p>
                
                <div className="project-status">
                  {status.isOccupied ? (
                    <div className="status-occupied">
                      <span className="status-indicator busy"></span>
                      <span>In use by {status.activeSession.userEmail}</span>
                      {['superadmin', 'admin'].includes(currentUser.role) && (
                        <button 
                          onClick={() => terminateSession(status.activeSession.id)}
                          className="terminate-btn"
                        >
                          Terminate
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="status-free">
                      <span className="status-indicator free"></span>
                      <span>Available</span>
                    </div>
                  )}
                  
                  {status.queueLength > 0 && (
                    <div className="queue-status">
                      <span>Queue: {status.queueLength} users</span>
                    </div>
                  )}
                </div>
                
                <div className="project-access">
                  <span>Access: {Object.keys(project.access || {}).filter(k => project.access[k]).join(', ') || 'All users'}</span>
                </div>
                
                {project.devices.length > 0 && (
                  <div className="devices-section">
                    <h4>Devices ({project.devices.length})</h4>
                    <ul className="devices-list">
                      {project.devices.slice(0, 3).map(device => (
                        <li key={device.id}>
                          <strong>{device.id}</strong>: {device.type || 'device'} - {device.status || 'no status'}
                        </li>
                      ))}
                      {project.devices.length > 3 && <li>+{project.devices.length - 3} more...</li>}
                    </ul>
                  </div>
                )}
                
                {project.alerts.length > 0 && (
                  <div className="alerts-section">
                    <h4>Alerts ({project.alerts.length})</h4>
                    <ul className="alerts-list">
                      {project.alerts.slice(0, 2).map((alert, index) => (
                        <li key={index} className={`alert-${alert.priority || 'medium'}`}>
                          {alert.message}
                        </li>
                      ))}
                      {project.alerts.length > 2 && <li>+{project.alerts.length - 2} more alerts...</li>}
                    </ul>
                  </div>
                )}
                
                <button 
                  className="view-details-btn"
                  onClick={() => handleProjectAccess(project)}
                  disabled={status.isOccupied && !canBypassQueue(currentUser.role) && status.activeSession.userRole !== 'guest'}
                >
                  {status.isOccupied ? 'Join/Wait' : 'View Details'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Devices;