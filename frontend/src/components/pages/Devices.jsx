import React, { useState, useEffect, useRef } from 'react';
import { Card,Row,Col, Space, Tag, Progress, Typography } from "antd";
import { InfoOutlined,DashboardOutlined, CarOutlined,EnvironmentOutlined, ToolOutlined } from "@ant-design/icons";
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
  getDoc,
  limit
} from 'firebase/firestore';
import '../styles/Devices.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// const { Text } = Typography;
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
  const [flippedCards, setFlippedCards] = useState(new Set());
  // Refs for cleanup
  const sessionUnsubscribes = useRef({});
  const queueUnsubscribes = useRef({});
  const countdownInterval = useRef(null);

  const handleCardFlip = (projectId, e) => {
  e.stopPropagation(); // Prevent triggering other click events
  setFlippedCards(prev => {
    const newSet = new Set(prev);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    return newSet;
  });
};
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
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
  
useEffect(() => {
  if (!currentUser) return;

  // Keep track of processed notifications to avoid duplicates
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
        
        // Skip if we've already processed this notification
        if (processedNotifications.has(notification.id)) {
          return;
        }
        
        // Mark as processed
        processedNotifications.add(notification.id);
        
        if (notification.type === 'session_started') {
          // For guests, always auto-redirect
          if (currentUser.role === 'guest' && notification.autoRedirect) {
            alert('Your session has started! Redirecting to project dashboard...');
            
            // Force a page reload to ensure proper state sync
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
          
          // Delete the notification after processing
          try {
            await deleteDoc(doc(db, 'user_notifications', notification.id));
          } catch (error) {
            console.error('Error deleting session_started notification:', error);
          }
        }
        
        // Handle session termination notifications
        if (notification.type === 'session_terminated') {
          alert('Your session has been terminated by an administrator.');
          
          // Clear local session state immediately
          setActiveSession(null);
          setSelectedProject(null);
          setCountdown(0);
          
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
          }
          
          // Delete the notification to prevent re-triggering
          try {
            await deleteDoc(doc(db, 'user_notifications', notification.id));
          } catch (error) {
            console.error('Error deleting session_terminated notification:', error);
          }
          
          // Force redirect back to devices list
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    });
  });

  return () => unsubscribe();
}, [currentUser, projects]);

  // Check for existing user sessions when component mounts or projects change
  useEffect(() => {
    if (currentUser && projects.length > 0) {
      checkForExistingUserSession();
    }
  }, [currentUser, projects]);

  const checkForExistingUserSession = async () => {
    try {
      // Query for active sessions belonging to current user
      const userSessionQuery = query(
        collection(db, 'project_sessions'),
        where('userId', '==', currentUser.id),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(userSessionQuery);
      
      if (!snapshot.empty) {
        const sessionDoc = snapshot.docs[0];
        const sessionData = { id: sessionDoc.id, ...sessionDoc.data() };
        
        // Find the project for this session
        const project = projects.find(p => p.id === sessionData.projectId);
        if (project) {
          setActiveSession(sessionData);
          setSelectedProject(project);
          
          // If it's a guest session with remaining time, restart countdown
          if (sessionData.sessionType === 'guest' && sessionData.endTime) {
            const endTime = sessionData.endTime.toDate ? sessionData.endTime.toDate() : new Date(sessionData.endTime);
            const remainingTime = Math.max(0, Math.floor((endTime - new Date()) / 1000));
            
            if (remainingTime > 0) {
              setCountdown(remainingTime);
              startCountdownTimer(sessionDoc.id);
            } else {
              // Session has expired, clean it up
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
        endSession(sessionId); // This will automatically process the queue
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
};

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
  
  // Project is occupied - everyone must join queue
  return 'Join Queue';
};


const isProjectButtonDisabled = (project, status, userHasActiveSession) => {
  // Disable if user has an active session for a DIFFERENT project
  if (userHasActiveSession && status.activeSession?.userId !== currentUser.id) {
    return true;
  }
  
  // Disable if user is already in queue for this project
  const userInQueue = (queues[project.id] || []).find(item => item.userId === currentUser.id);
  if (userInQueue) {
    return true;
  }
  
  return false;
};

// Add a function to leave queue (optional)
const leaveQueue = async (projectId) => {
  try {
    const userQueueItem = (queues[projectId] || []).find(item => item.userId === currentUser.id);
    if (userQueueItem) {
      await deleteDoc(doc(db, 'project_queues', userQueueItem.id));
      alert('You have left the queue.');
    }
  } catch (error) {
    console.error('Error leaving queue:', error);
  }
};

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



const setupProjectListeners = () => {
  projects.forEach(project => {
    // Listen to active sessions with change detection
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
      
      // Check for session removals (when someone exits)
      changes.forEach(change => {
        if (change.type === 'removed') {
          console.log('Session ended for project:', project.id);
          // Session was removed, queue should be processed automatically by endSession
        }
        if (change.type === 'added') {
          console.log('New session started for project:', project.id);
          const newSession = { id: change.doc.id, ...change.doc.data() };
          
          // If this is the current user's session, update local state
          if (newSession.userId === currentUser.id) {
            setActiveSession(newSession);
            const projectData = projects.find(p => p.id === project.id);
            if (projectData && !selectedProject) {
              setSelectedProject(projectData);
              
              // If it's a guest session, start countdown
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
      
      setProjectSessions(prev => ({
        ...prev,
        [project.id]: sessions
      }));
    });

    // Listen to queues with position updates
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
    let devices = [];
    
    // Handle vehicles (for fleet_tracking)
    if (project.vehicles) {
      devices = [...devices, ...Object.entries(project.vehicles).map(([id, vehicle]) => ({ 
        id, 
        type: 'vehicle', 
        ...vehicle 
      }))];
    }
    
    // Handle sensors (for industrial_monitoring)
    if (project.sensors) {
      devices = [...devices, ...Object.entries(project.sensors).map(([id, sensor]) => ({ 
        id, 
        type: 'sensor', 
        ...sensor 
      }))];
    }
    
    // Handle devices (for smart_home)
    if (project.devices) {
      devices = [...devices, ...Object.entries(project.devices).map(([id, device]) => ({ 
        id, 
        type: 'device', 
        ...device 
      }))];
    }
    
    return devices;
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
}, [activeSession]); 

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
      
      // Start countdown
      startCountdownTimer(docRef.id);

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

    // First, get the session data before deleting it
    if (sessionId) {
      const sessionDoc = await getDocs(query(
        collection(db, 'project_sessions'),
        where('__name__', '==', sessionId)
      ));
      
      if (!sessionDoc.empty) {
        sessionData = sessionDoc.docs[0].data();
        projectId = sessionData.projectId;
      }
      
      // Delete the session
      await deleteDoc(doc(db, 'project_sessions', sessionId));
    }
    
    // Clear local state
    setActiveSession(null);
    setSelectedProject(null);
    setCountdown(0);
    
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    // IMPORTANT: Process the queue for the project that was just freed
    if (projectId) {
      await processQueue(projectId);
    }

  } catch (error) {
    console.error('Error ending session:', error);
  }
};

const joinQueue = async (projectId) => {
  try {
    // First check if user is already in the queue
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
    console.log('User joined queue:', currentUser.email, 'for project:', projectId);
    setShowQueueModal(false);
    
    // Show confirmation message
    alert(`You have been added to the queue. You will be notified when it's your turn.`);
    
  } catch (error) {
    console.error('Error joining queue:', error);
    setError('Failed to join queue');
  }
};

  const processQueue = async (projectId) => {
  try {
    const queue = queues[projectId] || [];
    if (queue.length === 0) {
      console.log('No users in queue for project:', projectId);
      return;
    }

    console.log('Processing queue for project:', projectId, 'Queue length:', queue.length);

    // Sort by role hierarchy first, then by join time
    const roleHierarchy = { superadmin: 1, admin: 2, user: 3, guest: 4 };
    const sortedQueue = [...queue].sort((a, b) => {
      const priorityA = roleHierarchy[a.userRole] || 5;
      const priorityB = roleHierarchy[b.userRole] || 5;
      
      // First sort by role priority
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // If same role, sort by join time (earlier first)
      const timeA = a.joinedAt?.toDate ? a.joinedAt.toDate() : new Date(a.joinedAt);
      const timeB = b.joinedAt?.toDate ? b.joinedAt.toDate() : new Date(b.joinedAt);
      return timeA - timeB;
    });

    const nextUser = sortedQueue[0];
    console.log('Next user in queue:', nextUser);
    
    // Remove from queue first
    await deleteDoc(doc(db, 'project_queues', nextUser.id));
    console.log('Removed user from queue:', nextUser.id);
    
    // Start session for the next user
    const sessionData = {
      projectId: projectId,
      userId: nextUser.userId,
      userEmail: nextUser.userEmail,
      userRole: nextUser.userRole,
      status: 'active',
      startTime: serverTimestamp(),
      sessionType: nextUser.userRole === 'guest' ? 'guest' : 'regular'
    };

    // Add end time for guest sessions
    if (nextUser.userRole === 'guest') {
      sessionData.endTime = new Date(Date.now() + 60000); // 60 seconds
    }

    const docRef = await addDoc(collection(db, 'project_sessions'), sessionData);
    console.log('Started new session:', docRef.id, 'for user:', nextUser.userEmail);
    
    // If it's the current user, update local state
    if (nextUser.userId === currentUser.id) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setSelectedProject(project);
        setActiveSession({ id: docRef.id, ...sessionData });
        
        if (nextUser.userRole === 'guest') {
          setCountdown(60);
          startCountdownTimer(docRef.id);
        }
        
        console.log('Updated local state for current user');
      }
    } else {
      // Send notification to the user that their session has started
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
        console.log('Sent notification to user:', nextUser.userEmail);
      } catch (error) {
        console.error('Error sending session start notification:', error);
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
  if (!['superadmin', 'admin'].includes(currentUser.role)) {
    alert('You do not have permission to terminate sessions.');
    return;
  }

  try {
    // First, get the session data before deleting it
    const sessionDoc = await getDoc(doc(db, 'project_sessions', sessionId));
    
    if (!sessionDoc.exists()) {
      alert('Session not found.');
      return;
    }
    
    const sessionData = sessionDoc.data();
    const terminatedUserId = sessionData.userId;
    const terminatedUserEmail = sessionData.userEmail;
    const projectId = sessionData.projectId;
    
    // Delete the session
    await deleteDoc(doc(db, 'project_sessions', sessionId));
    
    // Send notification to the terminated user
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
    
    alert(`Session terminated successfully for user: ${terminatedUserEmail}`);
    
    // Process the queue for the freed project
    await processQueue(projectId);
    
  } catch (error) {
    console.error('Error terminating session:', error);
    alert('Failed to terminate session. Please try again.');
  }
};

// Enhanced session monitoring - add this new useEffect
useEffect(() => {
  if (!currentUser || !activeSession) return;

  // Monitor the current user's session for external termination
  const sessionDoc = doc(db, 'project_sessions', activeSession.id);
  
  const unsubscribe = onSnapshot(sessionDoc, (doc) => {
    if (!doc.exists()) {
      // Session was deleted (terminated)
      console.log('Current session was terminated externally');
      
      // Clear local state
      setActiveSession(null);
      setSelectedProject(null);
      setCountdown(0);
      
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      
      // Show alert and redirect
      alert('Your session has been terminated.');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, (error) => {
    console.error('Error monitoring session:', error);
  });

  return () => unsubscribe();
}, [activeSession, currentUser]);

// Enhanced handleProjectAccess with better queue management
const handleProjectAccess = async (project) => {
  console.log('handleProjectAccess called for project:', project.id, 'by user:', currentUser.email);
  
  // Check if user is already in queue for this project and remove duplicates
  const existingQueueQuery = query(
    collection(db, 'project_queues'),
    where('projectId', '==', project.id),
    where('userId', '==', currentUser.id)
  );
  
  const existingQueueSnapshot = await getDocs(existingQueueQuery);
  
  // Remove any existing queue entries for this user in this project
  if (!existingQueueSnapshot.empty) {
    const deletePromises = existingQueueSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log('Removed duplicate queue entries for user');
  }
  
  // First check if current user already has an active session for this project
  const userActiveSession = Object.values(projectSessions[project.id] || {})
    .find(session => session.userId === currentUser.id && session.status === 'active');
  
  if (userActiveSession) {
    console.log('User already has active session, continuing...');
    // User already has an active session, continue with that session
    setActiveSession(userActiveSession);
    setSelectedProject(project);
    
    // If it's a guest session, restart countdown if there's time remaining
    if (userActiveSession.sessionType === 'guest' && userActiveSession.endTime) {
      const endTime = userActiveSession.endTime.toDate ? userActiveSession.endTime.toDate() : new Date(userActiveSession.endTime);
      const remainingTime = Math.max(0, Math.floor((endTime - new Date()) / 1000));
      
      if (remainingTime > 0) {
        setCountdown(remainingTime);
        startCountdownTimer(userActiveSession.id);
      } else {
        // Session has expired, clean it up
        await endSession(userActiveSession.id);
        return;
      }
    }
    return;
  }

  const status = getProjectStatus(project.id);
  
  // ALWAYS allow users to view project details
  setSelectedProject(project);
  
  if (!status.isOccupied) {
    console.log('Project is free, starting session...');
    // Project is free - start session directly
    if (currentUser.role === 'guest') {
      await startGuestSession(project.id);
    } else {
      await startRegularSession(project.id);
    }
  } else {
    console.log('Project is occupied, user can view but needs to join queue for control...');
    // Project is occupied - show notification about queue requirement
    const activeSession = status.activeSession;
    const currentUserRole = currentUser.role;
    const activeUserRole = activeSession.userRole;
    
    // Define role hierarchy (lower number = higher priority)
    const roleHierarchy = {
      'superadmin': 1,
      'admin': 2,
      'user': 3,
      'guest': 4
    };
    
    const currentUserPriority = roleHierarchy[currentUserRole] || 5;
    const activeUserPriority = roleHierarchy[activeUserRole] || 5;
    
    // Show different messages based on priority
    if (currentUserRole === 'superadmin') {
      alert(`You can view the project details. To control the project (currently used by ${activeUserRole}), you'll be added to the priority queue.`);
      await notifyCurrentUser(activeSession, 'superadmin');
      await joinQueue(project.id);
    } else if (currentUserPriority < activeUserPriority) {
      alert(`You can view the project details. To control the project (currently used by ${activeUserRole}), you'll be added to the priority queue.`);
      await notifyCurrentUser(activeSession, currentUserRole);
      await joinQueue(project.id);
    } else {
      // Don't show queue modal immediately, just inform user
      alert(`You can view the project details. To control the project (currently used by ${activeUserRole}), you need to join the queue.`);
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
          {/* {userQueueInfo[pendingProjectAccess] ? (
  <div className="queue-info">
    <p>Your position in queue: {userQueueInfo[pendingProjectAccess].position}</p>
    <p>Estimated wait time: {userQueueInfo[pendingProjectAccess].estimated} seconds</p>
  </div>
) : (
  <p>A high-priority user is using the dashboard. It may take longer than usual.</p>
)} */}
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
      <div className="project-header" style={{ 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'space-between',
  marginBottom: '16px'
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <button onClick={handleBackToList} className="back-button">
      &larr; Back to Projects
    </button>
    
    {/* Control Status Badge */}
    <div style={{ 
      padding: '4px 10px', 
      borderRadius: '4px',
      backgroundColor: activeSession ? '#f6ffed' : '#fff2e8',
      border: activeSession ? '1px solid #b7eb8f' : '1px solid #ffbb96',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}>
      <span style={{ 
        width: '6px', 
        height: '6px', 
        borderRadius: '50%', 
        backgroundColor: activeSession ? '#52c41a' : '#fa541c'
      }}></span>
      <span style={{ 
        color: activeSession ? '#52c41a' : '#fa541c', 
        fontWeight: '500',
        fontSize: '12px'
      }}>
        {activeSession ? 'Control Access: Active' : 'View Only'}
      </span>
      {!activeSession && (
        <button 
          onClick={() => {
            setShowQueueModal(true);
            setPendingProjectAccess(selectedProject.id);
          }}
          style={{
            background: '#1890ff',
            color: 'white',
            border: 'none',
            padding: '2px 6px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: '500',
            marginLeft: '6px'
          }}
        >
          Get Control
        </button>
      )}
    </div>
  </div>
  
  {/* Keep your existing session timer on the right side */}
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
      {/* Debug info - remove in production */}
      <div style={{fontSize: '10px', color: '#666', marginTop: '5px'}}>
        Session ID: {activeSession.id}<br/>
        End Time: {activeSession.endTime ? new Date(activeSession.endTime).toLocaleTimeString() : 'None'}<br/>
        Countdown: {countdown}s
      </div>
    </div>
  )}
</div>
      
      <h2>{selectedProject.name}</h2>
      <p className="project-description">{selectedProject.description}</p>
      <div className="project-details">
        {selectedProject.id === 'fleet_tracking' && (
    <>
      <h3>Vehicle Locations</h3>
      <div style={{ height: '400px', marginBottom: '20px', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
        <MapContainer 
  center={[12.9716, 77.5946]} 
  zoom={10} 
  style={{ height: '100%', width: '100%' }}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  />
  {selectedProject.devices.map(vehicle => (
    vehicle.location && (
      <Marker key={vehicle.id} position={[vehicle.location.lat, vehicle.location.lng]}>
        <Popup>
          <div style={{ minWidth: '200px' }}>
            <Typography.Title level={5} style={{ margin: '0 0 12px 0' }}>{vehicle.id}</Typography.Title>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DashboardOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>Speed:</Typography.Text>
                <Tag color="blue">{vehicle.speed}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CarOutlined style={{ color: '#52c41a' }} />
                <Typography.Text strong>Fuel:</Typography.Text>
                <Progress 
                  percent={parseInt(vehicle.fuel)} 
                  size="small" 
                  style={{ flex: 1, margin: 0 }}
                  strokeColor={parseInt(vehicle.fuel) > 30 ? '#52c41a' : '#ff4d4f'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ToolOutlined style={{ color: vehicle.maintenance_due ? '#ff4d4f' : '#52c41a' }} />
                <Typography.Text strong>Maintenance:</Typography.Text>
                <Tag color={vehicle.maintenance_due ? 'red' : 'green'}>
                  {vehicle.maintenance_due ? 'Due' : 'OK'}
                </Tag>
              </div>
            </Space>
          </div>
        </Popup>
      </Marker>
    )
  ))}
</MapContainer>
      </div>
      
      <h3>Vehicle Details</h3>
      <div className="devices-grid">
  <Row gutter={[16, 16]}>
    {selectedProject.devices.map(vehicle => (
      <Col xs={24} sm={12} md={8} lg={16} key={vehicle.id}>
        <Card 
          hoverable
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CarOutlined style={{ color: '#1890ff' }} />
              <Typography.Text strong>{vehicle.id}</Typography.Text>
            </div>
          }
          style={{ height: '100%' }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Speed */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DashboardOutlined style={{ color: '#1890ff' }} />
                <Typography.Text>Speed:</Typography.Text>
              </div>
              <Tag color="blue" style={{ margin: 0 }}>
                {vehicle.speed}
              </Tag>
            </div>

            {/* Fuel */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <CarOutlined style={{ color: '#52c41a' }} />
                <Typography.Text>Fuel:</Typography.Text>
              </div>
              <Progress 
                percent={parseInt(vehicle.fuel)} 
                size="small"
                strokeColor={parseInt(vehicle.fuel) > 30 ? '#52c41a' : '#ff4d4f'}
                showInfo={true}
                format={() => `${vehicle.fuel}`}
              />
            </div>

            {/* Maintenance */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ToolOutlined style={{ color: vehicle.maintenance_due ? '#ff4d4f' : '#52c41a' }} />
                <Typography.Text>Maintenance:</Typography.Text>
              </div>
              <Tag color={vehicle.maintenance_due ? 'red' : 'green'} style={{ margin: 0 }}>
                {vehicle.maintenance_due ? 'Due' : 'OK'}
              </Tag>
            </div>

            {/* Location */}
            {vehicle.location && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <EnvironmentOutlined style={{ color: '#722ed1' }} />
                  <Typography.Text>Location:</Typography.Text>
                </div>
                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                  {vehicle.location.lat.toFixed(4)}, {vehicle.location.lng.toFixed(4)}
                </Typography.Text>
              </div>
            )}
          </Space>
        </Card>
      </Col>
    ))}
  </Row>
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
      <div className="projects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filteredProjects.map(project => {
          const status = getProjectStatus(project.id);
          const userHasActiveSession = Object.values(projectSessions[project.id] || {})
            .some(session => session.userId === currentUser.id && session.status === 'active');
          const info = userQueueInfo[project.id];
          const isFlipped = flippedCards.has(project.id);
          
          // Default fallback image
          const defaultImage = 'https://i.pinimg.com/736x/7f/5c/48/7f5c48b1112427bce292d0b06b4cafb5.jpg';
          const projectImage = project.image || defaultImage;
          
          return (
            <div key={project.id} style={{ perspective: '1000px', height: '300px' }}>
              <div 
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Front Side */}
                <Card
                  hoverable
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '120%',
                    backfaceVisibility: 'hidden',
                    border: '1px solid #d9d9d9'
                  }}
                  cover={
                    <div style={{ 
                      height: '200px', 
                      backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${projectImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      position: 'relative',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                    }}>
                      {project.name}
                      <InfoOutlined 
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          fontSize: '15px',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '5px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          backdropFilter: 'blur(10px)'
                        }}
                        onClick={(e) => handleCardFlip(project.id, e)}
                      />
                    </div>
                  }

                >
                  <div style={{ padding: '0 8px' }}>
                    <div className="project-status" style={{ marginBottom: '12px' }}>
                      {status.isOccupied ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: '#ff4d4f' 
                          }}></span>
                          <span style={{ fontSize: '12px' }}>In use by {status.activeSession.userEmail}</span>
                          {userHasActiveSession && (
                            <span style={{ fontSize: '10px', color: '#52c41a' }}> (Your Session)</span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: '#52c41a' 
                          }}></span>
                          <span style={{ fontSize: '12px' }}>Available</span>
                        </div>
                      )}
                      
                      {status.queueLength > 0 && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          Queue: {status.queueLength} users
                        </div>
                      )}
                    </div>

                    {info && currentUser.role === 'guest' && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#555', 
                        backgroundColor: '#f0f0f0', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        ⏳ You are <strong>#{info.position}</strong> in queue<br />
                        Est. Wait: <strong>{info.estimated} seconds</strong>
                      </div>
                    )}

                    {['superadmin', 'admin'].includes(currentUser.role) && status.isOccupied && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          terminateSession(status.activeSession.id);
                        }}
                        style={{
                          marginTop: '8px',
                          background: '#ff4d4f',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Terminate
                      </button>
                    )}

                    {/* Main Action Button */}
                    <button 
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        border: 'none',
                        background: userHasActiveSession ? '#52c41a' : (status.isOccupied ? '#faad14' : '#1890ff'),
                        color: 'white',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor: userHasActiveSession && status.activeSession?.userId !== currentUser.id ? 'not-allowed' : 'pointer',
                        opacity: userHasActiveSession && status.activeSession?.userId !== currentUser.id ? 0.6 : 1,
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                      onClick={() => handleProjectAccess(project)}
                      disabled={userHasActiveSession && status.activeSession?.userId !== currentUser.id}
                    >
                      {userHasActiveSession ? 'Continue Session' : 'View Project'}
                    </button>
                  </div>
                </Card>

                {/* Back Side */}
                <Card
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '120%',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    border: '1px solid #d9d9d9'
                  }}
                >
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px' }}>{project.name}</h3>
                      <InfoOutlined 
                        style={{
                          fontSize: '15px',
                          cursor: 'pointer',
                          padding: '5px',
                          borderRadius: '50%',
                          backgroundColor: '#f0f0f0'
                        }}
                        onClick={(e) => handleCardFlip(project.id, e)}
                      />
                    </div>
                    
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Description:</h4>
                      <p style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '16px' }}>
                        {project.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
      }

export default Devices;