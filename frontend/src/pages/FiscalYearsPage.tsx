import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, Switch, Space, Popconfirm, Tag, message, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFiscalYears, createFiscalYear, updateFiscalYear, deleteFiscalYear } from '../api/client';
import type { FiscalYearEntry } from '../types';

const FiscalYearsPage: React.FC = () => {
  const [fiscalYears, setFiscalYears] = useState<FiscalYearEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FiscalYearEntry | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getFiscalYears();
      setFiscalYears(data);
    } catch {
      message.error('Failed to fetch fiscal years');
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
    form.setFieldsValue({ is_active: true, is_default: false });
    setModalOpen(true);
  };

  const openEdit = (record: FiscalYearEntry) => {
    setEditing(record);
    form.setFieldsValue({
      year_code: record.year_code,
      start_date: dayjs(record.start_date),
      end_date: dayjs(record.end_date),
      is_active: record.is_active,
      is_default: record.is_default,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        year_code: values.year_code,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        is_active: values.is_active,
        is_default: values.is_default,
      };

      if (editing) {
        await updateFiscalYear(editing.id, payload);
        message.success('Fiscal year updated');
      } else {
        await createFiscalYear(payload);
        message.success('Fiscal year created');
      }
      setModalOpen(false);
      fetchData();
    } catch {
      // validation error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFiscalYear(id);
      message.success('Fiscal year deleted');
      fetchData();
    } catch {
      message.error('Failed to delete fiscal year');
    }
  };

  const columns = [
    {
      title: 'Year Code',
      dataIndex: 'year_code',
      key: 'year_code',
      render: (v: string) => (
        <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', fontFamily: "'JetBrains Mono', monospace" }}>
          FY {v}
        </span>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (v: string) => <span style={{ fontSize: 13, color: '#595959' }}>{v}</span>,
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (v: string) => <span style={{ fontSize: 13, color: '#595959' }}>{v}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: FiscalYearEntry) => (
        <Space size={6}>
          {record.is_active ? (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>
              Active
            </Tag>
          ) : (
            <Tag style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>Inactive</Tag>
          )}
          {record.is_default && (
            <Tag color="blue" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>
              Default
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, record: FiscalYearEntry) => (
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
          <Popconfirm title="Delete this fiscal year?" onConfirm={() => handleDelete(record.id)}>
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
            <CalendarOutlined style={{ color: '#1a7a3a', fontSize: 15 }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>Fiscal Years</span>
            <Tag style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>{fiscalYears.length}</Tag>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 500 }}
          >
            Add Fiscal Year
          </Button>
        </div>

        <Table
          dataSource={fiscalYears}
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
              <CalendarOutlined style={{ color: '#1a7a3a', fontSize: 16 }} />
            </div>
            <span>{editing ? 'Edit Fiscal Year' : 'Add Fiscal Year'}</span>
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
          <Form.Item name="year_code" label="Year Code" rules={[{ required: true, message: 'Year code is required (e.g. 2025/26)' }]}>
            <Input placeholder="e.g. 2025/26" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="start_date" label="Start Date" rules={[{ required: true, message: 'Start date is required' }]}>
            <DatePicker style={{ width: '100%', borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="end_date" label="End Date" rules={[{ required: true, message: 'End date is required' }]}>
            <DatePicker style={{ width: '100%', borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_default" label="Default" valuePropName="checked">
            <Switch />
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

export default FiscalYearsPage;
