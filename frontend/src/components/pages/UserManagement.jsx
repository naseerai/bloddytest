import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Tag, 
  Space, 
  Popconfirm, 
  Card,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Drawer
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

const { Title } = Typography;
const { Option } = Select;

const UserManagement = ({ currentUser, userType = 'user' }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, 'users');
      
      if (userType === 'admin') {
        q = query(usersRef, where('role', '==', 'admin'));
      } else {
        q = query(usersRef, where('role', '==', 'user'));
      }
      
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs.map(doc => ({
        key: doc.id,
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userType]);

  const handleSubmit = async (values) => {
    try {
      const usersRef = collection(db, 'users');
      const userData = {
        ...values,
        role: userType === 'admin' ? 'admin' : values.role,
        createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
        isGuest: false
      };

      if (editingUser) {
        const userRef = doc(db, 'users', editingUser.id);
        // Don't update password if it's empty during edit
        if (!values.password) {
          delete userData.password;
        }
        await updateDoc(userRef, userData);
        message.success(`${userType === 'admin' ? 'Admin' : 'User'} updated successfully`);
      } else {
        await addDoc(usersRef, userData);
        message.success(`${userType === 'admin' ? 'Admin' : 'User'} added successfully`);
      }

      fetchUsers();
      handleCancel();
    } catch (error) {
      console.error('Error saving user:', error);
      message.error(`Failed to save ${userType === 'admin' ? 'admin' : 'user'}`);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      role: user.role,
      password: '' // Don't pre-fill password
    });
    
    if (isMobile) {
      setIsDrawerVisible(true);
    } else {
      setIsModalVisible(true);
    }
  };

  const handleDelete = async (id) => {
    try {
      const userRef = doc(db, 'users', id);
      await deleteDoc(userRef);
      message.success(`${userType === 'admin' ? 'Admin' : 'User'} deleted successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error(`Failed to delete ${userType === 'admin' ? 'admin' : 'user'}`);
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setIsDrawerVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      role: userType === 'admin' ? 'admin' : 'user'
    });
    
    if (isMobile) {
      setIsDrawerVisible(true);
    } else {
      setIsModalVisible(true);
    }
  };

  const canManage = () => {
    if (userType === 'admin') {
      return currentUser.role === 'superadmin';
    }
    return ['superadmin', 'admin'].includes(currentUser.role);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'green';
      case 'admin':
        return 'orange';
      case 'user':
        return 'blue';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      width: isMobile ? 200 : 300,
      render: (email) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontSize: isMobile ? '12px' : '14px' }}>{email}</span>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: isMobile ? 80 : 120,
      responsive: ['sm', 'md', 'lg', 'xl'],
      render: (role) => (
        <Tag 
          color={getRoleColor(role)} 
          style={{ 
            textTransform: 'uppercase',
            fontSize: isMobile ? '10px' : '12px',
            padding: isMobile ? '2px 6px' : '4px 8px'
          }}
        >
          {role}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: isMobile ? 100 : 140,
      responsive: ['md', 'lg', 'xl'],
      render: (createdAt) => (
        <span style={{ fontSize: isMobile ? '11px' : '13px' }}>
          {createdAt ? new Date(createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
          }) : 'N/A'}
        </span>
      ),
    },
  ];

  if (canManage()) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 120 : 160,
      fixed: isMobile ? 'right' : false,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="primary"
            ghost
            size={isMobile ? 'small' : 'middle'}
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ fontSize: isMobile ? '11px' : '13px' }}
          >
            {!isMobile && 'Edit'}
          </Button>
          <Popconfirm
            title={`Delete ${userType === 'admin' ? 'admin' : 'user'}?`}
            description={`Are you sure you want to delete this ${userType === 'admin' ? 'admin' : 'user'}?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            placement={isMobile ? 'topRight' : 'top'}
          >
            <Button
              type="primary"
              danger
              size={isMobile ? 'small' : 'middle'}
              icon={<DeleteOutlined />}
              style={{ fontSize: isMobile ? '11px' : '13px' }}
            >
              {!isMobile && 'Delete'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    });
  }

  const formItems = (
    <>
      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Please input email!' },
          { type: 'email', message: 'Please enter a valid email!' }
        ]}
      >
        <Input prefix={<UserOutlined />} placeholder="Enter email address" />
      </Form.Item>

      <Form.Item
        name="password"
        label="Password"
        rules={[
          { 
            required: !editingUser, 
            message: 'Please input password!' 
          },
          { 
            min: 6, 
            message: 'Password must be at least 6 characters!' 
          }
        ]}
      >
        <Input.Password 
          placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
        />
      </Form.Item>

      <Form.Item
        name="role"
        label="Role"
        rules={[{ required: true, message: 'Please select role!' }]}
      >
        <Select 
          placeholder="Select role"
          disabled={userType === 'admin'}
        >
          {userType === 'admin' ? (
            <Option value="admin">Admin</Option>
          ) : (
            <>
              <Option value="user">User</Option>
              {currentUser.role === 'superadmin' && (
                <Option value="admin">Admin</Option>
              )}
            </>
          )}
        </Select>
      </Form.Item>
    </>
  );

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card 
        style={{ 
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        {/* Header Section with proper alignment */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {userType === 'admin' ? <SettingOutlined style={{ fontSize: '20px', color: '#1890ff' }} /> : <UserOutlined style={{ fontSize: '20px', color: '#1890ff' }} />}
            <Title 
              level={isMobile ? 3 : 2} 
              style={{ 
                margin: 0,
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: 600,
                color: '#262626'
              }}
            >
              {userType === 'admin' ? 'Admin Management' : 'User Management'}
            </Title>
          </div>
          
          {canManage() && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              size={isMobile ? 'middle' : 'large'}
              style={{
                borderRadius: 6,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              Add {userType === 'admin' ? 'Admin' : 'User'}
            </Button>
          )}
        </div>

        {/* Table Section with proper alignment */}
        <div style={{ 
          width: '100%',
          overflow: 'hidden'
        }}>
          <Table
            columns={columns}
            dataSource={users}
            loading={loading}
            pagination={{
              showSizeChanger: !isMobile,
              showQuickJumper: !isMobile,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} ${
                  userType === 'admin' ? 'admins' : 'users'
                }`,
              responsive: true,
              size: isMobile ? 'small' : 'default',
              pageSize: isMobile ? 5 : 10,
              showLessItems: isMobile,
            }}
            scroll={{ 
              x: isMobile ? 400 : 800,
              y: isMobile ? 400 : undefined
            }}
            size={isMobile ? 'small' : 'middle'}
            locale={{
              emptyText: `No ${userType === 'admin' ? 'admins' : 'users'} found`
            }}
            style={{
              background: '#fff',
            }}
            className="responsive-table"
          />
        </div>

        {/* Desktop Modal */}
        <Modal
          title={`${editingUser ? 'Edit' : 'Add'} ${userType === 'admin' ? 'Admin' : 'User'}`}
          open={isModalVisible}
          onCancel={handleCancel}
          footer={null}
          width={isMobile ? '90%' : 500}
          centered
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            style={{ marginTop: 16 }}
          >
            {formItems}
            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit">
                  {editingUser ? 'Update' : 'Add'} {userType === 'admin' ? 'Admin' : 'User'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Mobile Drawer */}
        <Drawer
          title={`${editingUser ? 'Edit' : 'Add'} ${userType === 'admin' ? 'Admin' : 'User'}`}
          placement="bottom"
          onClose={handleCancel}
          open={isDrawerVisible}
          height="80%"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {formItems}
            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit">
                  {editingUser ? 'Update' : 'Add'} {userType === 'admin' ? 'Admin' : 'User'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Drawer>
      </Card>

      <style jsx>{`
        .responsive-table .ant-table-thead > tr > th {
          background-color: #fafafa;
          font-weight: 600;
          border-bottom: 2px solid #f0f0f0;
        }
        
        .responsive-table .ant-table-tbody > tr:hover > td {
          background-color: #f5f5f5;
        }
        
        @media (max-width: 768px) {
          .responsive-table .ant-table-thead > tr > th {
            padding: 8px 12px;
            font-size: 12px;
          }
          
          .responsive-table .ant-table-tbody > tr > td {
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;