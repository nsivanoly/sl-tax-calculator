import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Popconfirm, message, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { getUsers, createUser, updateUser, deleteUser } from '../api/client';
import type { AuthUser } from '../types';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: AuthUser) => {
    setEditing(record);
    form.setFieldsValue({ name: record.name, email: record.email });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateUser(editing.id, values);
        message.success('User updated');
      } else {
        await createUser(values);
        message.success('User created');
      }
      setModalOpen(false);
      fetchData();
    } catch {
      // validation error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('User deleted');
      fetchData();
    } catch {
      message.error('Failed to delete user');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => (
        <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{v}</span>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (v: string | null) =>
        v ? (
          <span style={{ color: '#595959', fontSize: 13 }}>{v}</span>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: 13 }}>—</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, record: AuthUser) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: 14 }} />}
              onClick={() => openEdit(record)}
              style={{ color: '#8c8c8c' }}
            />
          </Tooltip>
          <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: '#1a7a3a', fontSize: 15 }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>Users</span>
            <Tag style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>{users.length}</Tag>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 500 }}
          >
            Add User
          </Button>
        </div>

        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#e6f7ed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserOutlined style={{ color: '#1a7a3a', fontSize: 16 }} />
            </div>
            <span>{editing ? 'Edit User' : 'Add User'}</span>
          </div>
        }
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Save' : 'Create'}
        okButtonProps={{ style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        styles={{ body: { paddingTop: 20 } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Enter name" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="Enter email (optional)" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          color: #8c8c8c !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }
        .ant-table-tbody > tr:hover > td {
          background: #f6ffed !important;
        }
      `}</style>
    </div>
  );
};

export default UsersPage;
