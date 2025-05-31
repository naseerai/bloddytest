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
  Drawer,
  Upload,
  Avatar
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  SettingOutlined,
  UploadOutlined,
  ReloadOutlined,
  PhoneOutlined,
  MailOutlined
} from '@ant-design/icons';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

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
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // EmailJS configuration - Replace with your actual values
  const EMAIL_SERVICE_ID = 'service_yzg8o0c';
  const EMAIL_TEMPLATE_ID = 'template_dhmdo1g';
  const EMAIL_PUBLIC_KEY = 'jW2qEXXMeqrR_0nB7';

  // Initialize EmailJS
  useEffect(() => {
    emailjs.init(EMAIL_PUBLIC_KEY);
  }, []);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate random password
  const generateRandomPassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  // Send email with credentials
  const sendCredentialsEmail = async (userEmail, userName, password, userRole) => {
    setEmailSending(true);
    try {
      const templateParams = {
        to_email: userEmail,
        to_name: userName,
        user_email: userEmail,
        user_password: password,
        user_role: userRole,
        from_name: currentUser.name || 'Admin'
      };

      await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams
      );

      message.success('Login credentials sent to user via email');
    } catch (error) {
      console.error('Failed to send email:', error);
      message.error('Failed to send email with credentials');
      
      // Show credentials in modal as fallback
      Modal.info({
        title: 'Email Failed - Please Share Manually',
        content: (
          <div>
            <p>Login credentials for {userEmail}:</p>
            <div style={{ 
              background: '#f5f5f5', 
              padding: '8px 12px', 
              borderRadius: '4px', 
              fontFamily: 'monospace',
              fontSize: '14px',
              margin: '8px 0'
            }}>
              <strong>Email:</strong> {userEmail}<br/>
              <strong>Password:</strong> {password}
            </div>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Please share these credentials with the user manually.
            </p>
          </div>
        ),
      });
    } finally {
      setEmailSending(false);
    }
  };

  // Upload image to Cloudinary
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'unsigned_preset'); // Replace with your Cloudinary upload preset
    formData.append('cloud_name', 'dlycx8dw3'); // Replace with your Cloudinary cloud name

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/dlycx8dw3/image/upload`, // Replace with your cloud name
        {
          method: 'POST',
          body: formData,
        }
      );
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  };

  // Handle image upload
  const handleImageUpload = async (info) => {
    if (info.file.status === 'uploading') {
      setUploadLoading(true);
      return;
    }

    if (info.file.status === 'done' || info.file.originFileObj) {
      try {
        setUploadLoading(true);
        const imageUrl = await uploadToCloudinary(info.file.originFileObj || info.file);
        form.setFieldsValue({ photo: imageUrl });
        message.success('Photo uploaded successfully!');
      } catch (error) {
        message.error('Failed to upload photo');
      } finally {
        setUploadLoading(false);
      }
    }
  };

  // Custom upload function
  const customUpload = ({ file, onSuccess, onError }) => {
    uploadToCloudinary(file)
      .then((url) => {
        onSuccess(url);
      })
      .catch((error) => {
        onError(error);
      });
  };

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
      
      // Clean the values object to remove undefined fields
      const cleanedValues = Object.entries(values).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {});

      // Generate password for new users only
      const password = editingUser ? 
        (cleanedValues.password || editingUser.password) : 
        generateRandomPassword();

      const userData = {
        ...cleanedValues,
        role: userType === 'admin' ? 'admin' : cleanedValues.role,
        createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
        isGuest: false,
        password: password
      };

      if (editingUser) {
        const userRef = doc(db, 'users', editingUser.id);
        // Remove password from update if it wasn't changed
        if (!cleanedValues.password) {
          delete userData.password;
        }
        await updateDoc(userRef, userData);
        message.success(`${userType === 'admin' ? 'Admin' : 'User'} updated successfully`);
      } else {
        await addDoc(usersRef, userData);
        message.success(`${userType === 'admin' ? 'Admin' : 'User'} added successfully`);
        
        // Send email with credentials for new users
        await sendCredentialsEmail(
          cleanedValues.email,
          cleanedValues.name,
          password,
          userData.role
        );
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
      name: user.name || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      photo: user.photo || '',
      role: user.role || 'user'
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
    setGeneratedPassword('');
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

  const handleGenerateNewPassword = () => {
    const newPassword = generateRandomPassword();
    setGeneratedPassword(newPassword);
    form.setFieldsValue({ password: newPassword });
    message.success('New password generated!');
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
      title: 'User',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: isMobile ? 150 : 200,
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar 
            size={isMobile ? 32 : 40}
            src={record.photo}
            icon={<UserOutlined />}
            style={{ 
              backgroundColor: record.photo ? 'transparent' : '#1890ff',
              flexShrink: 0
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ 
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 500,
              color: '#262626',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {name || 'N/A'}
            </div>
            <div style={{ 
              fontSize: isMobile ? '10px' : '12px',
              color: '#8c8c8c',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {record.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: isMobile ? 120 : 150,
      responsive: ['sm', 'md', 'lg', 'xl'],
      render: (phoneNumber) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PhoneOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
          <span style={{ fontSize: isMobile ? '11px' : '13px' }}>
            {phoneNumber || 'N/A'}
          </span>
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
        name="name"
        label="Full Name"
        rules={[
          { required: true, message: 'Please input full name!' },
          { min: 2, message: 'Name must be at least 2 characters!' }
        ]}
      >
        <Input prefix={<UserOutlined />} placeholder="Enter full name" />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Please input email!' },
          { type: 'email', message: 'Please enter a valid email!' }
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="Enter email address" />
      </Form.Item>

      <Form.Item
        name="phoneNumber"
        label="Phone Number"
        rules={[
          { required: true, message: 'Please input phone number!' },
          { pattern: /^[\+]?[1-9][\d]{0,15}$/, message: 'Please enter a valid phone number!' }
        ]}
      >
        <Input prefix={<PhoneOutlined />} placeholder="Enter phone number" />
      </Form.Item>

      <Form.Item
        name="photo"
        label="Profile Photo"
      >
        <div>
          <Upload
            name="photo"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={customUpload}
            beforeUpload={(file) => {
              const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
              if (!isJpgOrPng) {
                message.error('You can only upload JPG/PNG/WEBP files!');
                return false;
              }
              const isLt2M = file.size / 1024 / 1024 < 2;
              if (!isLt2M) {
                message.error('Image must be smaller than 2MB!');
                return false;
              }
              return true;
            }}
            onChange={handleImageUpload}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
              {uploadLoading ? (
                <Spin />
              ) : form.getFieldValue('photo') ? (
                <img 
                  src={form.getFieldValue('photo')} 
                  alt="avatar" 
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} 
                />
              ) : (
                <div>
                  <PlusOutlined style={{ fontSize: '16px', marginBottom: '8px' }} />
                  <div style={{ marginTop: 8, fontSize: '12px' }}>Upload Photo</div>
                </div>
              )}
            </div>
          </Upload>
          {form.getFieldValue('photo') && (
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              <Button 
                size="small" 
                type="link" 
                onClick={() => form.setFieldsValue({ photo: '' })}
              >
                Remove Photo
              </Button>
            </div>
          )}
        </div>
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
              loading={emailSending}
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
          width={isMobile ? '90%' : 600}
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
                <Button onClick={handleCancel} disabled={emailSending}>
                  Cancel
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={emailSending}
                >
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
          height="90%"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            style={{ paddingBottom: 24 }}
          >
            {formItems}
            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={handleCancel} disabled={emailSending}>
                  Cancel
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={emailSending}
                >
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
        
        .avatar-uploader .ant-upload {
          border: 1px dashed #d9d9d9;
          border-radius: 6px;
        }
        
        .avatar-uploader .ant-upload:hover {
          border-color: #1890ff;
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