import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import GLI from '../assets/GuestLoginimage.jpg';
import { guestLogin } from '../services/authService';

const { Title, Text } = Typography;

const GuestLogin = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const { email } = values;
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      const guestUser = await guestLogin(email);
      
      localStorage.setItem('currentUser', JSON.stringify({
        id: guestUser.id,
        email: guestUser.email,
        role: guestUser.role,
        isGuest: true
      }));
      
      navigate('/dashboard');
      
      message.success(`Welcome${guestUser.createdAt === guestUser.lastLogin ? '' : ' back'}, Guest!`);
    } catch (error) {
      if (error.message.includes('already registered')) {
        message.error(error.message);
        form.setFields([
          {
            name: 'email',
            errors: [error.message],
          },
        ]);
      } else {
        message.error(error.message || 'Guest login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
    message.error('Please enter a valid email.');
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-content">
          {/* Left side - Guest Login Form */}
          <div className="login-form-section">
            <div className="login-header">
              <Title level={2} className="login-title">
                Guest Access
              </Title>
              <Text className="login-subtitle">
                Enter your email to continue as guest
              </Text>
            </div>

            <Form
              form={form}
              name="guestLogin"
              layout="vertical"
              onFinish={onFinish}
              onFinishFailed={onFinishFailed}
              autoComplete="off"
              className="login-form"
            >
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    required: true,
                    message: 'Please input your email!',
                  },
                  {
                    type: 'email',
                    message: 'Please enter a valid email!',
                  },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Enter your email"
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  className="login-button"
                  loading={loading}
                  block
                >
                  {loading ? 'Entering...' : 'Continue as Guest'}
                </Button>
              </Form.Item>
            </Form>

            <div className="login-footer">
              <Text>
                Have an account? <Link to="/">Sign in here</Link>
              </Text>
            </div>
          </div>

          {/* Right side - Image */}
          <div className="login-image-section">
            <div className="image-container">
              <img
                src={GLI}
                alt="Login illustration"
                className="login-image"
                />
              <div className="image-overlay">
                <Title level={3} className="overlay-title">
                  Quick Access
                </Title>
                <Text className="overlay-text">
                  Get started immediately with guest access. No registration required.
                </Text>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GuestLogin;