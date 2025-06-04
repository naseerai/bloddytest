import React, { useState, useEffect, useRef } from 'react';
import { realtimeDb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
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
  getDoc,
  limit
} from 'firebase/firestore';
import '../styles/Devices.css';

const Devices = ({ currentUser }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [processedRequests, setProcessedRequests] = useState(new Set());
  
  // Project access control states
  const [projectSessions, setProjectSessions] = useState({});
  const [queues, setQueues] = useState({});
  const [activeSession, setActiveSession] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [userQueueInfo, setUserQueueInfo] = useState({});
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [pendingProjectAccess, setPendingProjectAccess] = useState(null);
  
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
  
  // Monitor active session in real-time
  useEffect(() => {
  if (!selectedProject || !currentUser) return;

  const sessionQuery = query(
    collection(db, 'project_sessions'),
    where('userId', '==', currentUser.id),
    where('projectId', '==', selectedProject.id),
    where('status', '==', 'active'),
    orderBy('startTime', 'desc'),
    limit(1)
  );

  const unsubscribe = onSnapshot(sessionQuery, (snapshot) => {
    if (!snapshot.empty) {
      const sessionDoc = snapshot.docs[0];
      const sessionData = sessionDoc.data();
      
      console.log('Session data updated from Firestore:', sessionData);
      
      const processedSessionData = {
        id: sessionDoc.id,
        ...sessionData,
        startTime: sessionData.startTime?.toDate ? sessionData.startTime.toDate() : sessionData.startTime,
        endTime: sessionData.endTime?.toDate ? sessionData.endTime.toDate() : sessionData.endTime
      };
      
      // Force update the active session
      setActiveSession(processedSessionData);
      
      console.log('Active session updated:', processedSessionData);
    } else {
      console.log('No active session found');
      setActiveSession(null);
    }
  }, (error) => {
    console.error('Error in session listener:', error);
  });

  return () => unsubscribe();
}, [selectedProject, currentUser]);

useEffect(() => {
  if (!activeSession?.id) return;

  console.log('Setting up direct session listener for:', activeSession.id);

  const sessionDocRef = doc(db, 'project_sessions', activeSession.id);
  
  const unsubscribe = onSnapshot(sessionDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const sessionData = docSnapshot.data();
      
      console.log('Direct session update received:', sessionData);
      
      const updatedSession = {
        id: docSnapshot.id,
        ...sessionData,
        startTime: sessionData.startTime?.toDate ? sessionData.startTime.toDate() : sessionData.startTime,
        endTime: sessionData.endTime?.toDate ? sessionData.endTime.toDate() : sessionData.endTime
      };
      
      // Update the active session state
      setActiveSession(updatedSession);
      
      console.log('Session state updated with new data:', updatedSession);
    } else {
      console.log('Session document no longer exists');
      setActiveSession(null);
    }
  }, (error) => {
    console.error('Error in direct session listener:', error);
  });

  return () => {
    console.log('Cleaning up direct session listener');
    unsubscribe();
  };
}, [activeSession?.id]);
  // Update countdown timer based on session endTime
  useEffect(() => {
  if (!activeSession || !activeSession.endTime) {
    setCountdown(0);
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    return;
  }

  const updateCountdown = () => {
    const now = new Date();
    let endTime;
    
    // Handle different timestamp formats
    if (activeSession.endTime?.toDate) {
      endTime = activeSession.endTime.toDate();
    } else if (activeSession.endTime instanceof Date) {
      endTime = activeSession.endTime;
    } else {
      endTime = new Date(activeSession.endTime);
    }
    
    const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
    
    console.log('Countdown update:', {
      endTime: endTime,
      now: now,
      timeLeft: timeLeft
    });
    
    setCountdown(timeLeft);
    
    if (timeLeft <= 0 && activeSession.status === 'active') {
      console.log('Session expired, ending session');
      endSession(activeSession.id);
    }
  };

  // Update immediately
  updateCountdown();
  
  // Clear any existing interval
  if (countdownInterval.current) {
    clearInterval(countdownInterval.current);
  }
  
  // Set new interval
  const interval = setInterval(updateCountdown, 1000);
  countdownInterval.current = interval;

  return () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  };
}, [activeSession]); // Add activeSession as dependency

  // Notification listener
  useEffect(() => {
    if (!currentUser) return;

    const processedNotifications = new Set();

    const notificationsQuery = query(
      collection(db, 'user_notifications'),
      where('targetUserId', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const notification = { id: change.doc.id, ...change.doc.data() };
          
          if (processedNotifications.has(notification.id)) {
            return;
          }
          
          processedNotifications.add(notification.id);
          
          if (notification.type === 'session_started') {
            if (currentUser.role === 'guest' && notification.autoRedirect) {
              alert('Your session has started! Redirecting to project dashboard...');
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
            
            try {
              await deleteDoc(doc(db, 'user_notifications', notification.id));
            } catch (error) {
              console.error('Error deleting session_started notification:', error);
            }
          }
          
          if (notification.type === 'session_terminated') {
            alert('Your session has been terminated by an administrator.');
            setActiveSession(null);
            setSelectedProject(null);
            setCountdown(0);
            
            if (countdownInterval.current) {
              clearInterval(countdownInterval.current);
            }
            
            try {
              await deleteDoc(doc(db, 'user_notifications', notification.id));
            } catch (error) {
              console.error('Error deleting session_terminated notification:', error);
            }
            
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
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
        }
      }
    } catch (error) {
      console.error('Error checking for existing user session:', error);
    }
  };

  const setupProjectListeners = () => {
    projects.forEach(project => {
      const sessionQuery = query(
        collection(db, 'project_sessions'),
        where('projectId', '==', project.id)
      );
      
      sessionUnsubscribes.current[project.id] = onSnapshot(sessionQuery, (snapshot) => {
        const sessions = {};
        const changes = snapshot.docChanges();
        
        snapshot.forEach(doc => {
          sessions[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        changes.forEach(change => {
          if (change.type === 'removed') {
            console.log('Session ended for project:', project.id);
          }
          if (change.type === 'added') {
            console.log('New session started for project:', project.id);
            const newSession = { id: change.doc.id, ...change.doc.data() };
            
            if (newSession.userId === currentUser.id) {
              setActiveSession(newSession);
              const projectData = projects.find(p => p.id === project.id);
              if (projectData && !selectedProject) {
                setSelectedProject(projectData);
              }
            }
          }
        });
        
        setProjectSessions(prev => ({
          ...prev,
          [project.id]: sessions
        }));
      });

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
          
          // Update per-user, per-project queue info
          setUserQueueInfo(prev => ({
            ...prev,
            [project.id]: {
              position: usersAhead + 1,
              estimated: (usersAhead + 1) * 60
            }
          }));
        } else {
          setUserQueueInfo(prev => ({
            ...prev,
            [project.id]: null
          }));
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
      const endTime = new Date(Date.now() + 60000);
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

      await addDoc(collection(db, 'project_sessions'), sessionData);
    } catch (error) {
      console.error('Error starting guest session:', error);
      setError('Failed to start session');
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

      await addDoc(collection(db, 'project_sessions'), sessionData);
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
        sessionData.endTime = new Date(Date.now() + 60000);
      }

      const docRef = await addDoc(collection(db, 'project_sessions'), sessionData);
      
      if (nextUser.userId === currentUser.id) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setSelectedProject(project);
          setActiveSession({ id: docRef.id, ...sessionData });
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

useEffect(() => {
  if (!currentUser || !activeSession) return;

  const extensionQuery = query(
    collection(db, 'time_extension_requests'),
    where('userId', '==', currentUser.id),
    where('currentSessionId', '==', activeSession.id),
    where('status', '==', 'approved')
  );

  const unsubscribe = onSnapshot(extensionQuery, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const approvedRequest = change.doc;
        const requestData = approvedRequest.data();
        
        // Prevent processing the same request multiple times
        if (processedRequests.has(approvedRequest.id)) {
          return;
        }
        
        // Only process if status is approved and not already processed
        if (requestData.status === 'approved' && !requestData.processedAt) {
          setProcessedRequests(prev => new Set([...prev, approvedRequest.id]));
          
          try {
            // Get the current session document from Firestore to ensure we have the latest data
            const sessionDoc = await getDoc(doc(db, 'project_sessions', activeSession.id));
            
            if (!sessionDoc.exists()) {
              console.error('Session document not found');
              return;
            }
            
            const currentSessionData = sessionDoc.data();
            
            // Calculate new end time based on the current session's endTime
            let currentEndTime;
            if (currentSessionData.endTime?.toDate) {
              currentEndTime = currentSessionData.endTime.toDate();
            } else if (currentSessionData.endTime instanceof Date) {
              currentEndTime = currentSessionData.endTime;
            } else {
              currentEndTime = new Date(currentSessionData.endTime);
            }
            
            const newEndTime = new Date(currentEndTime.getTime() + (requestData.requestedTime * 60 * 1000));
            
            console.log('Extending session time:', {
              sessionId: activeSession.id,
              currentEndTime: currentEndTime,
              newEndTime: newEndTime,
              extensionMinutes: requestData.requestedTime
            });
            
            // Update the session document in Firestore
            await updateDoc(doc(db, 'project_sessions', activeSession.id), {
              endTime: newEndTime,
              lastUpdated: serverTimestamp()
            });
            
            // Mark the request as processed
            await updateDoc(doc(db, 'time_extension_requests', approvedRequest.id), {
              status: 'processed',
              processedAt: serverTimestamp()
            });
            
            console.log('Session time extension processed successfully');
            alert(`Your session has been extended by ${requestData.requestedTime} minutes!`);
            
          } catch (error) {
            console.error('Error processing time extension:', error);
            // Remove from processed set if there was an error
            setProcessedRequests(prev => {
              const newSet = new Set(prev);
              newSet.delete(approvedRequest.id);
              return newSet;
            });
          }
        }
      }
    });
  });

  return () => unsubscribe();
}, [currentUser, activeSession, processedRequests]);

// 3. Updated requestExtendedTime function with better error handling
const requestExtendedTime = async (additionalMinutes) => {
  if (!activeSession) return;

  try {
    // Check if there's already a pending request
    const existingRequestQuery = query(
      collection(db, 'time_extension_requests'),
      where('userId', '==', currentUser.id),
      where('currentSessionId', '==', activeSession.id),
      where('status', 'in', ['pending', 'approved'])
    );
    
    const existingSnapshot = await getDocs(existingRequestQuery);
    
    if (!existingSnapshot.empty) {
      alert('You already have a pending time extension request.');
      return;
    }

    await addDoc(collection(db, 'time_extension_requests'), {
      userId: currentUser.id,
      userEmail: currentUser.email,
      projectId: selectedProject.id,
      currentSessionId: activeSession.id,
      requestedTime: additionalMinutes,
      status: 'pending',
      requestedAt: serverTimestamp()
    });
    
    alert('Time extension request submitted!');
  } catch (error) {
    console.error('Error requesting time extension:', error);
    alert('Failed to submit request');
  }
};
  const terminateSession = async (sessionId) => {
    if (!['superadmin', 'admin'].includes(currentUser.role)) {
      alert('You do not have permission to terminate sessions.');
      return;
    }

    try {
      const sessionDoc = await getDoc(doc(db, 'project_sessions', sessionId));
      
      if (!sessionDoc.exists()) {
        alert('Session not found.');
        return;
      }
      
      const sessionData = sessionDoc.data();
      const terminatedUserId = sessionData.userId;
      const projectId = sessionData.projectId;
      
      await deleteDoc(doc(db, 'project_sessions', sessionId));
      
      const notificationData = {
        targetUserId: terminatedUserId,
        projectId: projectId,
        message: `Your session has been terminated by ${currentUser.role}: ${currentUser.email}`,
        priority: 'high',
        type: 'session_terminated',
        createdAt: serverTimestamp(),
        terminatedBy: currentUser.id,
        terminatedByRole: currentUser.role
      };
      
      await addDoc(collection(db, 'user_notifications'), notificationData);
      
      alert(`Session terminated successfully for user: ${sessionData.userEmail}`);
      
      await processQueue(projectId);
    } catch (error) {
      console.error('Error terminating session:', error);
      alert('Failed to terminate session. Please try again.');
    }
  };

  const handleProjectAccess = async (project) => {
    const existingQueueQuery = query(
      collection(db, 'project_queues'),
      where('projectId', '==', project.id),
      where('userId', '==', currentUser.id)
    );
    
    const existingQueueSnapshot = await getDocs(existingQueueQuery);
    
    if (!existingQueueSnapshot.empty) {
      const deletePromises = existingQueueSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    
    const userActiveSession = Object.values(projectSessions[project.id] || {})
      .find(session => session.userId === currentUser.id && session.status === 'active');
    
    if (userActiveSession) {
      setActiveSession(userActiveSession);
      setSelectedProject(project);
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
              <span className="timer-text">
                Time remaining: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </span>
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
                  {userHasActiveSession ? 'Continue Session' : (status.isOccupied ? 'Join/Wait' : 'View Details')}
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