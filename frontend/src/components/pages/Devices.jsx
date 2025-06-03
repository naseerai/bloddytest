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
  getDocs,
  getDoc 
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

  // Load projects from Realtime Database
  useEffect(() => {
    if (!currentUser) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

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

  // Notification listener
  useEffect(() => {
    if (!currentUser) return;

    const notificationsQuery = query(
      collection(db, 'user_notifications'),
      where('targetUserId', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const notification = { id: change.doc.id, ...change.doc.data() };
          
          if (notification.type === 'session_started') {
            if (currentUser.role === 'guest') {
              alert('Your session has started! Redirecting to project dashboard...');
              const project = projects.find(p => p.id === notification.projectId);
              if (project) setTimeout(() => window.location.reload(), 1000);
            } else {
              const shouldContinue = window.confirm('Your session has started! Would you like to continue to the project dashboard?');
              if (shouldContinue) window.location.reload();
            }
          }
          
          if (notification.type === 'terminated') {
            alert('You were terminated from the session.');
            setTimeout(() => window.location.reload(), 1000);
          }
          
          updateDoc(doc(db, 'user_notifications', notification.id), { 
            read: true 
          }).catch(console.error);
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser, projects]);

  // Check for existing user sessions
  useEffect(() => {
    if (currentUser && projects.length > 0) {
      checkForExistingUserSession();
    }
  }, [currentUser, projects]);

  // Handle beforeunload for guest sessions
  useEffect(() => {
    const handleUnload = () => {
      if (activeSession && currentUser.role === 'guest') {
        endSession(activeSession.id);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [activeSession, currentUser]);

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

        // Check if current user's session was added
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newSession = { id: change.doc.id, ...change.doc.data() };
            if (newSession.userId === currentUser.id) {
              setActiveSession(newSession);
              const projectData = projects.find(p => p.id === project.id);
              if (projectData && !selectedProject) {
                setSelectedProject(projectData);
                
                if (newSession.sessionType === 'guest' && newSession.endTime) {
                  const endTime = newSession.endTime.toDate ? newSession.endTime.toDate() : new Date(newSession.endTime);
                  const remainingTime = Math.max(0, Math.floor((endTime - new Date()) / 1000));
                  
                  if (remainingTime > 0) {
                    setCountdown(remainingTime);
                    startCountdownTimer(newSession.id);
                  }
                }
              }
            }
          }
        });
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
          const roleHierarchy = { superadmin: 1, admin: 2, user: 3, guest: 4 };
          const currentUserPriority = roleHierarchy[currentUser.role] || 5;
          
          const usersAhead = queueItems.filter(queueUser => {
            const queueUserPriority = roleHierarchy[queueUser.userRole] || 5;
            if (queueUserPriority < currentUserPriority) return true;
            if (queueUserPriority === currentUserPriority) {
              const queueUserTime = queueUser.joinedAt?.toDate ? queueUser.joinedAt.toDate() : new Date(queueUser.joinedAt);
              const userTime = userInQueue.joinedAt?.toDate ? userInQueue.joinedAt.toDate() : new Date(userInQueue.joinedAt);
              return queueUserTime < userTime;
            }
            return false;
          }).length;
          
          setQueuePosition(usersAhead + 1);
        } else {
          setQueuePosition(null);
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

  const checkForExistingUserSession = async () => {
    try {
      const userSessionQuery = query(
        collection(db, 'project_sessions'),
        where('userId', '==', currentUser.id),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(userSessionQuery);
      
      if (!snapshot.empty) {
        const sessionDoc = snapshot.docs[0];
        const sessionData = { id: sessionDoc.id, ...sessionDoc.data() };
        
        const project = projects.find(p => p.id === sessionData.projectId);
        if (project) {
          setActiveSession(sessionData);
          setSelectedProject(project);
          
          if (sessionData.sessionType === 'guest' && sessionData.endTime) {
            const endTime = sessionData.endTime.toDate ? sessionData.endTime.toDate() : new Date(sessionData.endTime);
            const remainingTime = Math.max(0, Math.floor((endTime - new Date()) / 1000));
            
            if (remainingTime > 0) {
              setCountdown(remainingTime);
              startCountdownTimer(sessionDoc.id);
            } else {
              await endSession(sessionDoc.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for existing user session:', error);
    }
  };

  const startCountdownTimer = (sessionId) => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          console.log('Guest session timeout, ending session...');
          endSession(sessionId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

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

  const startGuestSession = async (projectId) => {
    try {
      const endTime = new Date(Date.now() + 60000); // 60 seconds
      const sessionData = {
        projectId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        status: 'active',
        startTime: serverTimestamp(),
        endTime: endTime,
        sessionType: 'guest'
      };

      const docRef = await addDoc(collection(db, 'project_sessions'), sessionData);
      setActiveSession({ id: docRef.id, ...sessionData });
      setCountdown(60);
      startCountdownTimer(docRef.id);
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
      let sessionData = null;
      let projectId = null;

      if (sessionId) {
        const sessionDoc = await getDocs(query(
          collection(db, 'project_sessions'),
          where('__name__', '==', sessionId)
        ));
        
        if (!sessionDoc.empty) {
          sessionData = sessionDoc.docs[0].data();
          projectId = sessionData.projectId;
        }
        
        await deleteDoc(doc(db, 'project_sessions', sessionId));
      }
      
      setActiveSession(null);
      setSelectedProject(null);
      setCountdown(0);
      
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }

      if (projectId) {
        await processQueue(projectId);
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const joinQueue = async (projectId) => {
    try {
      const existingQueueQuery = query(
        collection(db, 'project_queues'),
        where('projectId', '==', projectId),
        where('userId', '==', currentUser.id)
      );
      
      const existingQueueSnapshot = await getDocs(existingQueueQuery);
      
      if (!existingQueueSnapshot.empty) {
        alert('You are already in the queue for this project.');
        setShowQueueModal(false);
        return;
      }

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
      alert(`You have been added to the queue. You will be notified when it's your turn.`);
    } catch (error) {
      console.error('Error joining queue:', error);
      setError('Failed to join queue');
    }
  };

  const processQueue = async (projectId) => {
    try {
      const queue = queues[projectId] || [];
      if (queue.length === 0) return;

      const roleHierarchy = { superadmin: 1, admin: 2, user: 3, guest: 4 };
      const sortedQueue = [...queue].sort((a, b) => {
        const priorityA = roleHierarchy[a.userRole] || 5;
        const priorityB = roleHierarchy[b.userRole] || 5;
        
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        const timeA = a.joinedAt?.toDate ? a.joinedAt.toDate() : new Date(a.joinedAt);
        const timeB = b.joinedAt?.toDate ? b.joinedAt.toDate() : new Date(b.joinedAt);
        return timeA - timeB;
      });

      const nextUser = sortedQueue[0];
      await deleteDoc(doc(db, 'project_queues', nextUser.id));
      
      const sessionData = {
        projectId: projectId,
        userId: nextUser.userId,
        userEmail: nextUser.userEmail,
        userRole: nextUser.userRole,
        status: 'active',
        startTime: serverTimestamp(),
        sessionType: nextUser.userRole === 'guest' ? 'guest' : 'regular'
      };

      if (nextUser.userRole === 'guest') {
        sessionData.endTime = new Date(Date.now() + 60000); // 60 seconds
      }

      const docRef = await addDoc(collection(db, 'project_sessions'), sessionData);
      
      if (nextUser.userId === currentUser.id) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setSelectedProject(project);
          setActiveSession({ id: docRef.id, ...sessionData });
          
          if (nextUser.userRole === 'guest') {
            setCountdown(60);
            startCountdownTimer(docRef.id);
          }
        }
      } else {
        try {
          const notificationData = {
            targetUserId: nextUser.userId,
            projectId: projectId,
            message: `Your session has started! You now have access to the project.`,
            priority: 'high',
            type: 'session_started',
            createdAt: serverTimestamp(),
            sessionId: docRef.id
          };
          
          await addDoc(collection(db, 'user_notifications'), notificationData);
        } catch (error) {
          console.error('Error sending session start notification:', error);
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  };

  const notifyCurrentUser = async (activeSession, waitingUserRole) => {
    try {
      const notificationData = {
        targetUserId: activeSession.userId,
        projectId: activeSession.projectId,
        message: `A ${waitingUserRole} is waiting to access this project. Please complete your session when convenient.`,
        priority: 'high',
        type: 'priority_waiting',
        createdAt: serverTimestamp(),
        waitingUserRole: waitingUserRole
      };
      
      await addDoc(collection(db, 'user_notifications'), notificationData);
    } catch (error) {
      console.error('Error sending notification:', error);
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
    const userActiveSession = Object.values(projectSessions[project.id] || {})
      .find(session => session.userId === currentUser.id && session.status === 'active');
    
    if (userActiveSession) {
      setActiveSession(userActiveSession);
      setSelectedProject(project);
      
      if (userActiveSession.sessionType === 'guest' && userActiveSession.endTime) {
        const endTime = userActiveSession.endTime.toDate ? userActiveSession.endTime.toDate() : new Date(userActiveSession.endTime);
        const remainingTime = Math.max(0, Math.floor((endTime - new Date()) / 1000));
        
        if (remainingTime > 0) {
          setCountdown(remainingTime);
          startCountdownTimer(userActiveSession.id);
        } else {
          await endSession(userActiveSession.id);
          return;
        }
      }
      return;
    }

    const userInQueue = (queues[project.id] || []).find(queueItem => queueItem.userId === currentUser.id);
    if (userInQueue) {
      alert('You are already in the queue for this project. Please wait for your turn.');
      return;
    }

    const status = getProjectStatus(project.id);
    
    if (!status.isOccupied) {
      if (currentUser.role === 'guest') {
        await startGuestSession(project.id);
      } else {
        await startRegularSession(project.id);
      }
      setSelectedProject(project);
    } else {
      const activeSession = status.activeSession;
      const currentUserRole = currentUser.role;
      const activeUserRole = activeSession.userRole;
      
      const roleHierarchy = {
        'superadmin': 1,
        'admin': 2,
        'user': 3,
        'guest': 4
      };
      
      const currentUserPriority = roleHierarchy[currentUserRole] || 5;
      const activeUserPriority = roleHierarchy[activeUserRole] || 5;
      
      if (currentUserRole === 'superadmin') {
        alert(`Project is currently in use by ${activeUserRole}. You will be added to the queue with priority access.`);
        await notifyCurrentUser(activeSession, 'superadmin');
        await joinQueue(project.id);
      } else if (currentUserPriority < activeUserPriority) {
        alert(`Project is currently in use by ${activeUserRole}. You will be added to the queue with priority access.`);
        await notifyCurrentUser(activeSession, currentUserRole);
        await joinQueue(project.id);
      } else {
        setShowQueueModal(true);
        setPendingProjectAccess(project.id);
      }
    }
  };

  const handleBackToList = () => {
    if (activeSession) {
      endSession(activeSession.id);
    }
    setSelectedProject(null);
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

  const getProjectButtonText = (project, status, userHasActiveSession) => {
    const userInQueue = (queues[project.id] || []).find(item => item.userId === currentUser.id);
    
    if (userInQueue) {
      return `In Queue (Position: ${queuePosition || '...'})`;
    }
    
    if (userHasActiveSession && status.activeSession?.userId === currentUser.id) {
      return 'Continue Session';
    }
    
    if (!status.isOccupied) {
      return 'Access Project';
    }
    
    return 'Join Queue';
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
            const userHasActiveSession = Object.values(projectSessions[project.id] || {})
              .some(session => session.userId === currentUser.id && session.status === 'active');
            
            return (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <p className="project-description">{project.description}</p>
                
                <div className="project-status">
                  {status.isOccupied ? (
                    <div className="status-occupied">
                      <span className="status-indicator busy"></span>
                      <span>In use by {status.activeSession.userEmail}</span>
                      {userHasActiveSession && (
                        <span className="user-session-indicator"> (Your Session)</span>
                      )}
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
                  disabled={
                    userHasActiveSession && status.activeSession?.userId !== currentUser.id
                  }
                >
                  {getProjectButtonText(project, status, userHasActiveSession)}
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