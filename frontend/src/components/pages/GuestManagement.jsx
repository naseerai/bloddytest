import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Card, 
  Tag, 
  Space, 
  Select, 
  Typography, 
  Spin, 
  Empty, 
  message,
  Popconfirm,
  Badge,
  Row,
  Col
} from 'antd';
import { 
  DeleteOutlined, 
  ArrowUpOutlined, 
  CheckOutlined, 
  CloseOutlined,
  ClockCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
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

const { Title, Text } = Typography;
const { Option } = Select;

// Active Guests Component with Real-time Timer
export const ActiveGuests = ({ currentUser }) => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for expired sessions and clean them up
  const checkAndCleanExpiredSessions = useCallback(async () => {
    const now = new Date();
    const expiredSessions = activeSessions.filter(session => 
      session.sessionType === 'guest' && 
      session.endTime && 
      now > session.endTime
    );

    for (const session of expiredSessions) {
      try {
        // Update session status to expired instead of deleting
        await updateDoc(doc(db, 'project_sessions', session.id), {
          status: 'expired',
          actualEndTime: serverTimestamp()
        });

        // Log the expiration
        await addDoc(collection(db, 'session_logs'), {
          action: 'expired',
          sessionId: session.id,
          expiredAt: serverTimestamp(),
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating expired session:', error);
      }
    }
  }, [activeSessions]);

  // Check for expired sessions every 30 seconds
  useEffect(() => {
    if (activeSessions.length > 0) {
      const expiredCheckInterval = setInterval(checkAndCleanExpiredSessions, 30000);
      return () => clearInterval(expiredCheckInterval);
    }
  }, [activeSessions, checkAndCleanExpiredSessions]);

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
      // Update status instead of deleting
      await updateDoc(doc(db, 'project_sessions', sessionId), {
        status: 'terminated',
        actualEndTime: serverTimestamp()
      });
      
      // Log the termination
      await addDoc(collection(db, 'session_logs'), {
        action: 'terminated',
        sessionId,
        terminatedBy: currentUser.email,
        timestamp: serverTimestamp()
      });
      
      message.success('Session terminated successfully');
    } catch (error) {
      console.error('Error terminating session:', error);
      message.error('Failed to terminate session');
    }
  };

  const getRemainingTime = (session) => {
    if (session.sessionType !== 'guest' || !session.endTime) return null;
    
    const remaining = Math.max(0, Math.floor((session.endTime - currentTime) / 1000));
    
    if (remaining === 0) {
      return 'Expired';
    }
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRemainingTimeColor = (session) => {
    if (session.sessionType !== 'guest' || !session.endTime) return 'gold';
    
    const remaining = Math.max(0, Math.floor((session.endTime - currentTime) / 1000));
    
    if (remaining === 0) return 'red';
    if (remaining < 300) return 'orange'; // Less than 5 minutes
    if (remaining < 900) return 'yellow'; // Less than 15 minutes
    return 'blue';
  };

  const getRoleColor = (role) => {
    const colors = {
      'superadmin': 'red',
      'admin': 'orange',
      'user': 'blue',
      'guest': 'green'
    };
    return colors[role] || 'default';
  };

  const columns = [
    {
      title: 'User',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email) => (
        <Space>
          <UserOutlined />
          <Text strong>{email}</Text>
        </Space>
      ),
      responsive: ['md']
    },
    {
      title: 'Project',
      dataIndex: 'projectId',
      key: 'projectId',
      render: (projectId) => <Text code>{projectId}</Text>
    },
    {
      title: 'Role',
      dataIndex: 'userRole',
      key: 'userRole',
      render: (role) => (
        <Tag color={getRoleColor(role)} style={{ textTransform: 'capitalize' }}>
          {role}
        </Tag>
      )
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (startTime) => startTime?.toLocaleString(),
      responsive: ['lg']
    },
    {
      title: 'Remaining',
      key: 'remaining',
      render: (_, session) => {
        if (session.sessionType === 'guest') {
          const remaining = getRemainingTime(session);
          const color = getRemainingTimeColor(session);
          
          return (
            <Tag 
              icon={<ClockCircleOutlined />} 
              color={color}
              style={{ 
                fontWeight: remaining === 'Expired' ? 'bold' : 'normal',
                animation: color === 'orange' ? 'blink 1s infinite' : 'none'
              }}
            >
              {remaining}
            </Tag>
          );
        }
        return <Tag color="gold">Unlimited</Tag>;
      }
    }
    // {
    //   title: 'Actions',
    //   key: 'actions',
    //   render: (_, session) => (
    //     ['superadmin', 'admin'].includes(currentUser.role) && (
    //       <Popconfirm
    //         title="Are you sure you want to terminate this session?"
    //         onConfirm={() => terminateSession(session.id)}
    //         okText="Yes"
    //         cancelText="No"
    //       >
    //         <Button 
    //           type="primary" 
    //           danger 
    //           size="small"
    //           icon={<DeleteOutlined />}
    //         >
    //           Terminate
    //         </Button>
    //       </Popconfirm>
    //     )
    //   ),
    //   width: 120
    // }
  ];

  // Add CSS for blinking animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <Card title={<Title level={3}>Active Guest Sessions</Title>} loading={loading}>
      {activeSessions.length === 0 ? (
        <Empty description="No active sessions found" />
      ) : (
        <Table
          columns={columns}
          dataSource={activeSessions}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} sessions`
          }}
          scroll={{ x: 800 }}
          size="small"
        />
      )}
    </Card>
  );
};

// Guest Queues Component (Enhanced with real-time wait time)
export const GuestQueues = ({ currentUser }) => {
  const [queues, setQueues] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for wait time calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

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
      message.success('User removed from queue');
    } catch (error) {
      console.error('Error removing from queue:', error);
      message.error('Failed to remove user from queue');
    }
  };

  const moveToFront = async (queueItem) => {
    try {
      await updateDoc(doc(db, 'project_queues', queueItem.id), {
        joinedAt: new Date(Date.now() - 1000000)
      });
      message.success('User moved to front of queue');
    } catch (error) {
      console.error('Error moving to front:', error);
      message.error('Failed to move user to front');
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'superadmin': 'red',
      'admin': 'orange',
      'user': 'blue',
      'guest': 'green'
    };
    return colors[role] || 'default';
  };

  const getQueueColumns = (projectId) => [
    {
      title: 'Position',
      key: 'position',
      render: (_, __, index) => (
        <Badge count={index + 1} style={{ backgroundColor: '#52c41a' }} />
      ),
      width: 80
    },
    {
      title: 'User',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email) => (
        <Space>
          <UserOutlined />
          <Text strong>{email}</Text>
        </Space>
      )
    },
    {
      title: 'Role',
      dataIndex: 'userRole',
      key: 'userRole',
      render: (role) => (
        <Tag color={getRoleColor(role)} style={{ textTransform: 'capitalize' }}>
          {role}
        </Tag>
      )
    },
    {
      title: 'Joined At',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (joinedAt) => joinedAt?.toLocaleString(),
      responsive: ['lg']
    },
    {
      title: 'Wait Time',
      key: 'waitTime',
      render: (_, item) => {
        const waitTime = Math.floor((currentTime - item.joinedAt) / 60000);
        return (
          <Tag icon={<ClockCircleOutlined />} color={waitTime > 10 ? 'red' : 'blue'}>
            {waitTime} min
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, item, index) => (
        <Space>
          {['superadmin', 'admin'].includes(currentUser.role) ? (
            <>
              <Button 
                type="primary"
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => moveToFront(item)}
              >
                Move to Front
              </Button>
              <Popconfirm
                title="Remove user from queue?"
                onConfirm={() => removeFromQueue(item.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button 
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                >
                  Remove
                </Button>
              </Popconfirm>
            </>
          ) : (
            <Tag color="processing">
              Est. wait: {(index + 1) * 2} min
            </Tag>
          )}
        </Space>
      ),
      width: 200
    }
  ];

  if (loading) {
    return (
      <Card title={<Title level={3}>Project Queues</Title>}>
        <Spin size="large" />
      </Card>
    );
  }

  return (
    <Card title={<Title level={3}>Project Queues</Title>}>
      {Object.keys(queues).length === 0 ? (
        <Empty description="No users in queue for any projects" />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {Object.entries(queues).map(([projectId, queueItems]) => (
            <Card
              key={projectId}
              type="inner"
              title={
                <Space>
                  <Text strong>Project: </Text>
                  <Text code>{projectId}</Text>
                  <Badge count={queueItems.length} style={{ backgroundColor: '#1890ff' }} />
                </Space>
              }
              size="small"
            >
              <Table
                columns={getQueueColumns(projectId)}
                dataSource={queueItems}
                rowKey="id"
                pagination={false}
                scroll={{ x: 600 }}
                size="small"
              />
            </Card>
          ))}
        </Space>
      )}
    </Card>
  );
};

// Session Logs Component (Superadmin only)
export const SessionLogs = ({ currentUser }) => {
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
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

  const getRoleColor = (role) => {
    const colors = {
      'superadmin': 'red',
      'admin': 'orange',
      'user': 'blue',
      'guest': 'green'
    };
    return colors[role] || 'default';
  };

  const getActionColor = (action) => {
    const colors = {
      'terminated': 'red',
      'started': 'green',
      'completed': 'blue',
      'expired': 'orange'
    };
    return colors[action] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'green',
      'completed': 'blue',
      'terminated': 'red',
      'expired': 'orange'
    };
    return colors[status] || 'default';
  };

  const logsColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => timestamp?.toLocaleString(),
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action) => (
        <Tag color={getActionColor(action)} style={{ textTransform: 'capitalize' }}>
          {action}
        </Tag>
      )
    },
    {
      title: 'Session ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      render: (sessionId) => <Text code>{sessionId}</Text>,
      responsive: ['lg']
    },
    {
      title: 'Performed By',
      key: 'performedBy',
      render: (_, log) => log.terminatedBy || log.performedBy || 'System'
    }
  ];

  const sessionsColumns = [
    {
      title: 'User',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email) => (
        <Space>
          <UserOutlined />
          <Text strong>{email}</Text>
        </Space>
      )
    },
    {
      title: 'Project',
      dataIndex: 'projectId',
      key: 'projectId',
      render: (projectId) => <Text code>{projectId}</Text>
    },
    {
      title: 'Role',
      dataIndex: 'userRole',
      key: 'userRole',
      render: (role) => (
        <Tag color={getRoleColor(role)} style={{ textTransform: 'capitalize' }}>
          {role}
        </Tag>
      )
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (startTime) => startTime?.toLocaleString(),
      responsive: ['lg']
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, session) => {
        if (session.endTime && session.startTime) {
          const duration = Math.floor((session.endTime - session.startTime) / 60000);
          return <Tag icon={<ClockCircleOutlined />}>{duration} min</Tag>;
        }
        return session.status === 'active' ? 
          <Tag color="processing">Ongoing</Tag> : 
          <Tag color="default">N/A</Tag>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} style={{ textTransform: 'capitalize' }}>
          {status}
        </Tag>
      )
    }
  ];

  if (loading) {
    return (
      <Card title={<Title level={3}>Session Logs</Title>}>
        <Spin size="large" />
      </Card>
    );
  }

  return (
    <Card title={<Title level={3}>Session Logs</Title>}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              type="inner"
              title={<Title level={4}>Recent Actions</Title>}
              size="small"
            >
              <Table
                columns={logsColumns}
                dataSource={logs.slice(0, 10)}
                rowKey="id"
                pagination={false}
                scroll={{ x: 600 }}
                size="small"
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card
              type="inner"
              title={<Title level={4}>Session History</Title>}
              size="small"
            >
              <Table
                columns={sessionsColumns}
                dataSource={filteredSessions.slice(0, 20)}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `Total ${total} sessions`
                }}
                scroll={{ x: 800 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </Card>
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
        const sessionRef = doc(db, 'project_sessions', request.currentSessionId);
        const newEndTime = new Date(Date.now() + (additionalTime * 60000));
        
        await updateDoc(sessionRef, {
          endTime: newEndTime
        });
      }

      await updateDoc(doc(db, 'time_extension_requests', requestId), {
        status: action,
        processedBy: currentUser.email,
        processedAt: serverTimestamp(),
        approvedTime: additionalTime
      });

      message.success(`Request ${action}d successfully`);
    } catch (error) {
      console.error('Error processing request:', error);
      message.error('Failed to process request');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'approve': 'green',
      'reject': 'red'
    };
    return colors[status] || 'default';
  };

  const pendingColumns = [
    {
      title: 'User',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email) => (
        <Space>
          <UserOutlined />
          <Text strong>{email}</Text>
        </Space>
      )
    },
    {
      title: 'Project',
      dataIndex: 'projectId',
      key: 'projectId',
      render: (projectId) => <Text code>{projectId}</Text>
    },
    {
      title: 'Requested Time',
      dataIndex: 'requestedTime',
      key: 'requestedTime',
      render: (time) => (
        <Tag icon={<ClockCircleOutlined />} color="blue">
          {time} minutes
        </Tag>
      )
    },
    {
      title: 'Request Time',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      render: (requestedAt) => requestedAt?.toLocaleString(),
      responsive: ['lg']
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, request) => (
        ['superadmin', 'admin'].includes(currentUser.role) && (
          <Space>
            <Popconfirm
              title="Approve this time extension request?"
              onConfirm={() => handleRequest(request.id, 'approve', request.requestedTime)}
              okText="Yes"
              cancelText="No"
            >
              <Button 
                type="primary"
                size="small"
                icon={<CheckOutlined />}
              >
                Approve
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Reject this time extension request?"
              onConfirm={() => handleRequest(request.id, 'reject')}
              okText="Yes"
              cancelText="No"
            >
              <Button 
                danger
                size="small"
                icon={<CloseOutlined />}
              >
                Reject
              </Button>
            </Popconfirm>
          </Space>
        )
      ),
      width: 150
    }
  ];

  const processedColumns = [
    {
      title: 'User',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email) => (
        <Space>
          <UserOutlined />
          <Text strong>{email}</Text>
        </Space>
      )
    },
    {
      title: 'Project',
      dataIndex: 'projectId',
      key: 'projectId',
      render: (projectId) => <Text code>{projectId}</Text>
    },
    {
      title: 'Requested',
      dataIndex: 'requestedTime',
      key: 'requestedTime',
      render: (time) => `${time} min`
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, request) => (
        <Tag color={getStatusColor(request.status)} style={{ textTransform: 'capitalize' }}>
          {request.status}
          {request.status === 'approve' && request.approvedTime && 
            ` (${request.approvedTime}min)`
          }
        </Tag>
      )
    },
    {
      title: 'Processed By',
      dataIndex: 'processedBy',
      key: 'processedBy',
      responsive: ['lg']
    },
    {
      title: 'Processed At',
      key: 'processedAt',
      render: (_, request) => request.processedAt?.toDate()?.toLocaleString(),
      responsive: ['lg']
    }
  ];

  if (loading) {
    return (
      <Card title={<Title level={3}>Time Extension Requests</Title>}>
        <Spin size="large" />
      </Card>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <Card title={<Title level={3}>Time Extension Requests</Title>}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card
          type="inner"
          title={
            <Space>
              <Title level={4} style={{ margin: 0 }}>Pending Requests</Title>
              <Badge count={pendingRequests.length} style={{ backgroundColor: '#ff7875' }} />
            </Space>
          }
          size="small"
        >
          {pendingRequests.length === 0 ? (
            <Empty description="No pending requests" />
          ) : (
            <Table
              columns={pendingColumns}
              dataSource={pendingRequests}
              rowKey="id"
              pagination={false}
              scroll={{ x: 600 }}
              size="small"
            />
          )}
        </Card>

        <Card
          type="inner"
          title={<Title level={4} style={{ margin: 0 }}>Recent Processed Requests</Title>}
          size="small"
        >
          <Table
            columns={processedColumns}
            dataSource={processedRequests.slice(0, 10)}
            rowKey="id"
            pagination={{
              pageSize: 5,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Total ${total} requests`
            }}
            scroll={{ x: 700 }}
            size="small"
          />
        </Card>
      </Space>
    </Card>
  );
};