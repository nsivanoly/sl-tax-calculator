import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  message,
  Spin,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  getAdjustments,
  createAdjustment,
  updateAdjustment,
  deleteAdjustment,
  toggleAdjustment,
} from '../api/client';
import type { TaxAdjustment, AdjustmentCreate } from '../types';
import { useFilingContext } from '../context/AuthContext';

const ADJUSTMENT_TYPES = [
  { value: 'paye_deducted', label: 'PAYE Deducted', color: '#1890ff' },
  { value: 'self_assessment', label: 'Self-Assessment Paid', color: '#1a7a3a' },
  { value: 'wht_credit', label: 'WHT Credit', color: '#0891b2' },
  { value: 'other_credit', label: 'Other Credit', color: '#722ed1' },
  { value: 'other_deduction', label: 'Other Deduction', color: '#cf1322' },
];

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US').format(Math.round(v));
const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

const QUARTER_OPTIONS = [
  { value: 'Q1', label: 'Q1 (Apr–Jun)' },
  { value: 'Q2', label: 'Q2 (Jul–Sep)' },
  { value: 'Q3', label: 'Q3 (Oct–Dec)' },
  { value: 'Q4', label: 'Q4 (Jan–Mar)' },
];

const AdjustmentsPage: React.FC = () => {
  const { currentFiling } = useFilingContext();
  const filingId = currentFiling!.id;
  const [adjustments, setAdjustments] = useState<TaxAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const adjustmentType = Form.useWatch('adjustment_type', form);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const data = await getAdjustments(filingId);
      setAdjustments(data);
    } catch {
      message.error('Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const handleToggle = async (record: TaxAdjustment) => {
    try {
      await toggleAdjustment(filingId, record.id);
      setAdjustments((prev) =>
        prev.map((a) => (a.id === record.id ? { ...a, is_active: !a.is_active } : a))
      );
      message.success(`Adjustment ${record.is_active ? 'disabled' : 'enabled'}`);
    } catch {
      message.error('Failed to toggle adjustment');
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: TaxAdjustment) => {
    setEditingId(record.id);
    form.setFieldsValue({
      label: record.label,
      adjustment_type: record.adjustment_type,
      quarter: record.quarter,
      amount: record.amount,
      description: record.description,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAdjustment(filingId, id);
      message.success('Adjustment deleted');
      fetchAdjustments();
    } catch {
      message.error('Failed to delete adjustment');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const isSA = values.adjustment_type === 'self_assessment';
      const quarter = isSA ? values.quarter || null : null;
      const label = isSA && values.quarter
        ? `${values.quarter} Self-Assessment`
        : values.label;

      const payload: AdjustmentCreate = {
        label,
        adjustment_type: values.adjustment_type,
        quarter,
        amount: values.amount,
        description: values.description || null,
      };

      if (editingId) {
        await updateAdjustment(filingId, editingId, payload);
        message.success('Adjustment updated');
      } else {
        await createAdjustment(filingId, payload);
        message.success('Adjustment created');
      }

      setModalOpen(false);
      fetchAdjustments();
    } catch {
      // validation error or API error
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: 'Type',
      dataIndex: 'adjustment_type',
      key: 'adjustment_type',
      render: (type: string, record: TaxAdjustment) => {
        const typeInfo = ADJUSTMENT_TYPES.find((t) => t.value === type);
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag
              color={typeInfo?.color ?? 'default'}
              style={{ borderRadius: 12, border: 'none', fontWeight: 500, margin: 0 }}
            >
              {typeInfo?.label ?? type}
            </Tag>
            {record.quarter && (
              <Tag style={{ borderRadius: 12, fontWeight: 600, fontSize: 11, margin: 0 }}>
                {record.quarter}
              </Tag>
            )}
          </span>
        );
      },
    },
    {
      title: 'Amount (LKR)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => <span style={monoStyle}>{formatLKR(v)}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (isActive: boolean, record: TaxAdjustment) => (
        <Tooltip title={isActive ? 'Included in calculation' : 'Excluded from calculation'}>
          <Switch
            size="small"
            checked={isActive}
            onChange={() => handleToggle(record)}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: TaxAdjustment) => (
        <Space size={4}>
          <Tooltip title="Edit adjustment">
            <Button
              type="text"
              shape="circle"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="Delete this adjustment?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete adjustment">
              <Button type="text" shape="circle" danger icon={<DeleteOutlined />} />
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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '18px 20px',
            borderBottom: '1px solid #f0f0f0',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e', marginBottom: 4 }}>
              Tax Adjustments
            </div>
            <div style={{ fontSize: 13, color: '#8c8c8c', maxWidth: 560 }}>
              Add or edit tax credits and deductions for the fiscal year. These include PAYE
              deducted, self-assessment payments, WHT credits, and any other adjustments that
              affect your net tax payable.
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 8, flexShrink: 0 }}
            onClick={handleAdd}
          >
            Add Adjustment
          </Button>
        </div>

        <div style={{ padding: 20 }}>
          <Spin spinning={loading}>
            <Table
              className="filing-table"
              dataSource={adjustments.map((a) => ({ ...a, key: a.id }))}
              columns={columns}
              pagination={false}
              size="middle"
              rowClassName={(record) => `filing-row${record.is_active ? '' : ' row-inactive'}`}
              locale={{ emptyText: 'No adjustments yet. Click "Add Adjustment" to get started.' }}
            />
          </Spin>
        </div>
      </div>

      <Modal
        title={editingId ? 'Edit Adjustment' : 'Add Adjustment'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editingId ? 'Update' : 'Create'}
        okButtonProps={{ style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Type"
            name="adjustment_type"
            rules={[{ required: true, message: 'Please select a type' }]}
          >
            <Select placeholder="Select adjustment type">
              {ADJUSTMENT_TYPES.map((t) => (
                <Select.Option key={t.value} value={t.value}>
                  {t.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Quarter selector — shown only for self-assessment */}
          {adjustmentType === 'self_assessment' && (
            <Form.Item
              label="Quarter"
              name="quarter"
              rules={[{ required: true, message: 'Please select a quarter' }]}
            >
              <Select placeholder="Select quarter">
                {QUARTER_OPTIONS.map((q) => (
                  <Select.Option key={q.value} value={q.value}>
                    {q.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* Label — hidden for self-assessment (auto-generated from quarter) */}
          {adjustmentType !== 'self_assessment' && (
            <Form.Item
              label="Label"
              name="label"
              rules={[{ required: adjustmentType !== 'self_assessment', message: 'Please enter a label' }]}
            >
              <Input placeholder="e.g., PAYE Deducted from Salary" />
            </Form.Item>
          )}

          <Form.Item
            label="Amount (LKR)"
            name="amount"
            rules={[{ required: true, message: 'Please enter an amount' }]}
          >
            <InputNumber<number>
              min={0}
              style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => Number(v!.replace(/,/g, ''))}
              placeholder="0"
            />
          </Form.Item>

          <Form.Item label="Description (optional)" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .filing-row:hover td {
          background: #f6ffed !important;
        }
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
      `}</style>
    </div>
  );
};

export default AdjustmentsPage;
