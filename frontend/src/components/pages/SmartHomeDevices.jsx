import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Tag, 
  Typography, 
  Space, 
  Statistic, 
  Badge,
  Alert,
  Divider,
  Tooltip
} from 'antd';
import {
  BulbOutlined,
  ThunderboltOutlined,
  FireOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  WarningOutlined
} from '@ant-design/icons';
import '../styles/Devices.css';
const { Title, Text } = Typography;

const SmartHomeDevices = ({ selectedProject }) => {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    if (selectedProject?.devices) {
      // Convert devices object to array with proper structure
      const deviceArray = Object.entries(selectedProject.devices).map(([deviceId, deviceData]) => ({
        id: deviceId,
        ...deviceData
      }));
      
      setDevices(deviceArray);
    }
  }, [selectedProject]);

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'light':
        return <BulbOutlined />;
      case 'air_conditioner':
        return <FireOutlined />;
      default:
        return <HomeOutlined />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'on':
        return 'success';
      case 'off':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'processing';
    }
  };

  const formatDeviceId = (id) => {
    return id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!selectedProject) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header Section */}
      <Card style={{ marginBottom: '24px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Title level={2} style={{ margin: 0 }}>
            <HomeOutlined style={{ marginRight: '8px' }} />
            {selectedProject.name}
          </Title>
          <Text type="secondary">{selectedProject.description}</Text>
          <Space>
            <Badge count={devices.length} showZero>
              <Tag icon={<HomeOutlined />} color="blue">Devices</Tag>
            </Badge>
            <Badge count={Object.keys(selectedProject.alerts || {}).length} showZero>
              <Tag icon={<WarningOutlined />} color="orange">Alerts</Tag>
            </Badge>
          </Space>
        </Space>
      </Card>

      {/* Alerts Section */}
      {selectedProject.alerts && Object.keys(selectedProject.alerts).length > 0 && (
        <Alert
          message="System Alert"
          description={Object.values(selectedProject.alerts)[0].message}
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Devices Section */}
      <Card>
        <Title level={3} style={{ marginBottom: '24px' }}>
          Devices ({devices.length})
        </Title>
        
        <Row gutter={[16, 16]}>
          {devices.map(device => (
            <Col xs={24} sm={12} md={8} lg={6} key={device.id}>
              <Card
                size="small"
                hoverable
                style={{
                  borderLeft: `4px solid ${
                    device.status?.toLowerCase() === 'on' ? '#52c41a' : '#d9d9d9'
                  }`,
                  height: '100%'
                }}
                bodyStyle={{ padding: '16px' }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {/* Device Header */}
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      {getDeviceIcon(device.type)}
                      <Text strong>{formatDeviceId(device.id)}</Text>
                    </Space>
                    <Tag color={getStatusColor(device.status)}>
                      {device.status}
                    </Tag>
                  </Space>

                  <Divider style={{ margin: '8px 0' }} />

                  {/* Device Type */}
                  <Space>
                    <Text type="secondary">Type:</Text>
                    <Text>{device.type.replace(/_/g, ' ')}</Text>
                  </Space>

                  {/* Device Metrics */}
                  <Row gutter={8}>
                    {device.temperature && (
                      <Col span={12}>
                        <Statistic
                          title="Temperature"
                          value={device.temperature}
                          prefix={<FireOutlined />}
                          valueStyle={{ fontSize: '14px' }}
                        />
                      </Col>
                    )}
                    {device.energy_usage && (
                      <Col span={12}>
                        <Statistic
                          title="Energy"
                          value={device.energy_usage}
                          prefix={<ThunderboltOutlined />}
                          valueStyle={{ 
                            fontSize: '14px',
                            color: device.energy_usage === '0W' ? '#999' : '#1890ff'
                          }}
                        />
                      </Col>
                    )}
                  </Row>

                  {/* Last Updated */}
                  {device.last_updated && (
                    <Tooltip title={new Date(device.last_updated).toLocaleString()}>
                      <Space size="small" style={{ marginTop: '8px' }}>
                        <ClockCircleOutlined style={{ color: '#999' }} />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Updated: {new Date(device.last_updated).toLocaleTimeString()}
                        </Text>
                      </Space>
                    </Tooltip>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        {devices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <HomeOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
            <Title level={4} type="secondary">No Devices Found</Title>
            <Text type="secondary">Connect your smart home devices to get started</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SmartHomeDevices;