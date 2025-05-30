import React from 'react';
import { Form, Input, Button, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import '../styles/login.css';
import { Link } from 'react-router-dom';
import LoginImage from '../assets/Loginimage.jpg';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();

  const onFinish = (values) => {
    console.log('Login values:', values);
    // Handle login logic here
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-content">
          {/* Left side - Login Form */}
          <div className="login-form-section">
            <div className="login-header">
              <Title level={2} className="login-title">
                Welcome Back
              </Title>
              <Text className="login-subtitle">
                Please sign in to your account
              </Text>
            </div>

            <Form
              form={form}
              name="login"
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

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  {
                    required: true,
                    message: 'Please input your password!',
                  },
                  {
                    min: 6,
                    message: 'Password must be at least 6 characters!',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter your password"
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  className="login-button"
                  block
                >
                  Sign In
                </Button>
              </Form.Item>
            </Form>

            <div className="login-footer">
              <Text>
                Need temporary access? <Link to="/guestlogin">Guest login</Link>
              </Text>
            </div>
          </div>

          {/* Right side - Image */}
          <div className="login-image-section">
            <div className="image-container">
              <img
                src={LoginImage}
                alt="Login illustration"
                className="login-image"
                />
              <div className="image-overlay">
                <Title level={3} className="overlay-title">
                  Join Our Community
                </Title>
                <Text className="overlay-text">
                  Connect with millions of users worldwide and discover amazing experiences.
                </Text>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;