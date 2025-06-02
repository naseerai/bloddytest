import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';

// Active Guests Component
export const ActiveGuests = ({ currentUser }) => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'project_sessions'),
      where('status', '==', 'active'),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate(),
          endTime: data.endTime?.toDate()
        });
      });
      setActiveSessions(sessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const terminateSession = async (sessionId) => {
    try {
      await deleteDoc(doc(db, 'project_sessions', sessionId));
      
      // Log the termination
      await addDoc(collection(db, 'session_logs'), {
        action: 'terminated',
        sessionId,
        terminatedBy: currentUser.email,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error terminating session:', error);
    }
  };

  const getRemainingTime = (session) => {
    if (session.sessionType !== 'guest' || !session.endTime) return null;
    const now = new Date();
    const remaining = Math.max(0, Math.floor((session.endTime - now) / 1000));
    return `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="content-card">Loading active sessions...</div>;

  return (
    <div className="content-card">
      <h2>Active Guest Sessions</h2>
      
      {activeSessions.length === 0 ? (
        <p>No active sessions found.</p>
      ) : (
        <div className="sessions-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Project</th>
                <th>Role</th>
                <th>Start Time</th>
                <th>Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map(session => (
                <tr key={session.id}>
                  <td>{session.userEmail}</td>
                  <td>{session.projectId}</td>
                  <td>
                    <span className={`role-badge role-${session.userRole}`}>
                      {session.userRole}
                    </span>
                  </td>
                  <td>{session.startTime?.toLocaleString()}</td>
                  <td>
                    {session.sessionType === 'guest' ? (
                      <span className="timer-display">
                        {getRemainingTime(session) || 'Expired'}
                      </span>
                    ) : (
                      <span>Unlimited</span>
                    )}
                  </td>
                  <td>
                    {['superadmin', 'admin'].includes(currentUser.role) && (
                      <button 
                        onClick={() => terminateSession(session.id)}
                        className="btn-danger btn-sm"
                      >
                        Terminate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Guest Queues Component
export const GuestQueues = ({ currentUser }) => {
  const [queues, setQueues] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'project_queues'),
      orderBy('joinedAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const queuesByProject = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const projectId = data.projectId;
        
        if (!queuesByProject[projectId]) {
          queuesByProject[projectId] = [];
        }
        
        queuesByProject[projectId].push({
          id: doc.id,
          ...data,
          joinedAt: data.joinedAt?.toDate()
        });
      });
      
      setQueues(queuesByProject);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const removeFromQueue = async (queueItemId) => {
    try {
      await deleteDoc(doc(db, 'project_queues', queueItemId));
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  };

  const moveToFront = async (queueItem) => {
    try {
      // Update joinedAt to current time to move to front
      await updateDoc(doc(db, 'project_queues', queueItem.id), {
        joinedAt: new Date(Date.now() - 1000000) // Set to past time to ensure it's first
      });
    } catch (error) {
      console.error('Error moving to front:', error);
    }
  };

  if (loading) return <div className="content-card">Loading queues...</div>;

  return (
    <div className="content-card">
      <h2>Project Queues</h2>
      
      {Object.keys(queues).length === 0 ? (
        <p>No users in queue for any projects.</p>
      ) : (
        Object.entries(queues).map(([projectId, queueItems]) => (
          <div key={projectId} className="queue-section">
            <h3>Project: {projectId}</h3>
            <div className="queue-table">
              <table>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Joined At</th>
                    <th>Wait Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.userEmail}</td>
                      <td>
                        <span className={`role-badge role-${item.userRole}`}>
                          {item.userRole}
                        </span>
                      </td>
                      <td>{item.joinedAt?.toLocaleString()}</td>
                      <td>
                        {Math.floor((new Date() - item.joinedAt) / 60000)} minutes
                      </td>
                      <td>
                        <div className="action-buttons">
                          {['superadmin', 'admin'].includes(currentUser.role) && (
                            <>
                              <button 
                                onClick={() => moveToFront(item)}
                                className="btn-primary btn-sm"
                              >
                                Move to Front
                              </button>
                              <button 
                                onClick={() => removeFromQueue(item.id)}
                                className="btn-danger btn-sm"
                              >
                                Remove
                              </button>
                            </>
                          )}
                          {currentUser.role === 'user' && (
                            <span className="queue-info">
                              Est. wait: {(index + 1) * 2} min
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// Session Logs Component (Superadmin only)
export const SessionLogs = ({ currentUser }) => {
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Listen to session logs
    const logsQuery = query(
      collection(db, 'session_logs'),
      orderBy('timestamp', 'desc')
    );

    const logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        logsData.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate()
        });
      });
      setLogs(logsData);
    });

    // Listen to all sessions (active and completed)
    const sessionsQuery = query(
      collection(db, 'project_sessions'),
      orderBy('startTime', 'desc')
    );

    const sessionsUnsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        sessionsData.push({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate(),
          endTime: data.endTime?.toDate()
        });
      });
      setSessions(sessionsData);
      setLoading(false);
    });

    return () => {
      logsUnsubscribe();
      sessionsUnsubscribe();
    };
  }, []);

  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    if (filter === 'active') return session.status === 'active';
    if (filter === 'guest') return session.userRole === 'guest';
    if (filter === 'completed') return session.status !== 'active';
    return true;
  });

  if (loading) return <div className="content-card">Loading session logs...</div>;

  return (
    <div className="content-card">
      <h2>Session Logs</h2>
      
      <div className="filter-controls">
        <label>Filter: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Sessions</option>
          <option value="active">Active Sessions</option>
          <option value="guest">Guest Sessions</option>
          <option value="completed">Completed Sessions</option>
        </select>
      </div>

      <div className="logs-section">
        <h3>Recent Actions</h3>
        <div className="logs-table">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Session ID</th>
                <th>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 10).map(log => (
                <tr key={log.id}>
                  <td>{log.timestamp?.toLocaleString()}</td>
                  <td>
                    <span className={`action-badge action-${log.action}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.sessionId}</td>
                  <td>{log.terminatedBy || log.performedBy || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sessions-section">
        <h3>Session History</h3>
        <div className="sessions-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Project</th>
                <th>Role</th>
                <th>Start Time</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.slice(0, 20).map(session => (
                <tr key={session.id}>
                  <td>{session.userEmail}</td>
                  <td>{session.projectId}</td>
                  <td>
                    <span className={`role-badge role-${session.userRole}`}>
                      {session.userRole}
                    </span>
                  </td>
                  <td>{session.startTime?.toLocaleString()}</td>
                  <td>
                    {session.endTime && session.startTime ? (
                      `${Math.floor((session.endTime - session.startTime) / 60000)} min`
                    ) : (
                      session.status === 'active' ? 'Ongoing' : 'N/A'
                    )}
                  </td>
                  <td>
                    <span className={`status-badge status-${session.status}`}>
                      {session.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Time Extension Requests Component
export const TimeRequests = ({ currentUser }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'time_extension_requests'),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        requestsData.push({
          id: doc.id,
          ...data,
          requestedAt: data.requestedAt?.toDate()
        });
      });
      setRequests(requestsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRequest = async (requestId, action, additionalTime = 0) => {
    try {
      const request = requests.find(r => r.id === requestId);
      
      if (action === 'approve' && additionalTime > 0) {
        // Extend the session
        const sessionRef = doc(db, 'project_sessions', request.currentSessionId);
        const newEndTime = new Date(Date.now() + (additionalTime * 60000));
        
        await updateDoc(sessionRef, {
          endTime: newEndTime
        });
      }

      // Update request status
      await updateDoc(doc(db, 'time_extension_requests', requestId), {
        status: action,
        processedBy: currentUser.email,
        processedAt: serverTimestamp(),
        approvedTime: additionalTime
      });

    } catch (error) {
      console.error('Error processing request:', error);
    }
  };

  if (loading) return <div className="content-card">Loading time requests...</div>;

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="content-card">
      <h2>Time Extension Requests</h2>
      
      <div className="requests-section">
        <h3>Pending Requests ({pendingRequests.length})</h3>
        {pendingRequests.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <div className="requests-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Project</th>
                  <th>Requested Time</th>
                  <th>Request Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(request => (
                  <tr key={request.id}>
                    <td>{request.userEmail}</td>
                    <td>{request.projectId}</td>
                    <td>{request.requestedTime} minutes</td>
                    <td>{request.requestedAt?.toLocaleString()}</td>
                    <td>
                      {['superadmin', 'admin'].includes(currentUser.role) && (
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleRequest(request.id, 'approve', request.requestedTime)}
                            className="btn-success btn-sm"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRequest(request.id, 'reject')}
                            className="btn-danger btn-sm"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="requests-section">
        <h3>Recent Processed Requests</h3>
        <div className="requests-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Project</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Processed By</th>
                <th>Processed At</th>
              </tr>
            </thead>
            <tbody>
              {processedRequests.slice(0, 10).map(request => (
                <tr key={request.id}>
                  <td>{request.userEmail}</td>
                  <td>{request.projectId}</td>
                  <td>{request.requestedTime} min</td>
                  <td>
                    <span className={`status-badge status-${request.status}`}>
                      {request.status}
                      {request.status === 'approve' && request.approvedTime && 
                        ` (${request.approvedTime}min)`
                      }
                    </span>
                  </td>
                  <td>{request.processedBy}</td>
                  <td>{request.processedAt?.toDate()?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};