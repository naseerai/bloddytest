import React, { useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Checkbox,
  Form,
  Space,
  Typography,
  message
} from 'antd';
import { update, ref as dbRef } from 'firebase/database';
import { realtimeDb } from '../firebase';

const { Title } = Typography;
const roles = ['superadmin', 'admin', 'user', 'guest'];
const defaultImage = 'https://i.pinimg.com/736x/7f/5c/48/7f5c48b1112427bce292d0b06b4cafb5.jpg';

const ProjectFormManager = ({ currentUser }) => {
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  if (!['superadmin', 'admin'].includes(currentUser?.role)) return null;

  const showModal = () => setVisible(true);
  const handleCancel = () => {
    form.resetFields();
    setVisible(false);
  };

  const handleAdd = async (values) => {
    try {
      const { id, name, description, access, devices, image } = values;
      if (!id || /[.#$\[\]/]/.test(id)) {
        return message.error("Invalid Project ID.");
      }

      const devicesObj = {};
      devices?.forEach((device) => {
        devicesObj[device.id] = {
          type: device.type,
          status: device.status,
          value: device.value
        };
      });

      const payload = {
        name,
        description,
        image: image?.trim() || null,
        access: access.reduce((acc, role) => {
          acc[role] = true;
          return acc;
        }, {}),
        devices: devicesObj
      };

      await update(dbRef(realtimeDb), {
        [`projects/${id}`]: payload
      });

      message.success("Added project successfully.");
      form.resetFields();
      setVisible(false);
    } catch (error) {
      console.error(error);
      message.error("Failed to add project.");
    }
  };

  return (
    <>
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Button type="primary" onClick={showModal}>Add New Project</Button>
      </div>

      <Modal
        open={visible}
        onCancel={handleCancel}
        footer={null}
        title={<Title level={4}>Add New Project</Title>}
        width={800}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={handleAdd}
        >
          <Form.Item label="Project ID" name="id" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item label="Project Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label="Image URL" name="image">
            <Input placeholder="https://example.com/image.jpg" />
          </Form.Item>

          <Form.Item label="Access Roles" name="access" rules={[{ required: true }]}>
            <Checkbox.Group options={roles} />
          </Form.Item>

          {/* Live Image Preview */}
          <Form.Item shouldUpdate>
            {() => {
              const imageUrl = form.getFieldValue('image') || defaultImage;
              return (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img
                    src={imageUrl}
                    alt="Project Preview"
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                    onError={(e) => { e.target.src = defaultImage; }}
                  />
                </div>
              );
            }}
          </Form.Item>

          <Form.List name="devices">
            {(fields, { add, remove }) => (
              <>
                <Title level={5}>Devices</Title>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={[name, 'id']} rules={[{ required: true }]}>
                      <Input placeholder="Device ID" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'type']}>
                      <Input placeholder="Type" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'status']}>
                      <Input placeholder="Status" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'value']}>
                      <Input placeholder="Value" />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)}>Delete</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>Add Device</Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              Add Project
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ProjectFormManager;
