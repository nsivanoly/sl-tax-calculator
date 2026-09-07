import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Popconfirm,
  Tabs,
  message,
  Spin,
  Space,
  Switch,
  Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import {
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
  toggleIncome,
  getTaxConfig,
} from '../api/client';
import { IncomeEntry, IncomeCreate, TaxConfig } from '../types';
import { useFilingContext } from '../context/AuthContext';
import IncomeForm from '../components/IncomeForm';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US').format(Math.round(v));

const categoryColors: Record<string, string> = {
  salary: '#1a7a3a',
  interest: '#1890ff',
  foreign_employment: '#722ed1',
  other: '#fa8c16',
};

const categoryLabels: Record<string, string> = {
  salary: 'Salary',
  interest: 'Interest',
  foreign_employment: 'Foreign Currency Income',
  other: 'Other',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  color: '#1a1a2e',
};

const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

const IncomePage: React.FC = () => {
  const { currentFiling } = useFilingContext();
  const filingId = currentFiling!.id;
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null);

  const whtRate = taxConfig?.wht_rate_resident ?? 0;

  const getWhtStatus = (entry: IncomeEntry): 'ok' | 'under' | 'over' => {
    if (entry.category !== 'interest' || whtRate <= 0 || entry.amount_lkr <= 0) return 'ok';
    const expected = entry.amount_lkr * whtRate;
    const diff = entry.wht_deducted - expected;
    if (Math.abs(diff) <= 1) return 'ok';
    return diff < 0 ? 'under' : 'over';
  };

  const getWhtWarning = (entry: IncomeEntry): string | null => {
    const status = getWhtStatus(entry);
    if (status === 'ok') return null;
    const expected = entry.amount_lkr * whtRate;
    const ratePct = (whtRate * 100).toFixed(0);
    if (status === 'under') {
      return `Under-deducted: ${formatLKR(entry.wht_deducted)} vs expected ${formatLKR(expected)} (${ratePct}%)`;
    }
    return `Over-deducted: ${formatLKR(entry.wht_deducted)} vs expected ${formatLKR(expected)} (${ratePct}%)`;
  };

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [data, config] = await Promise.all([
        getIncome(filingId),
        getTaxConfig(currentFiling!.fiscal_year),
      ]);
      setEntries(data);
      setTaxConfig(config);
    } catch (error) {
      message.error('Failed to load income entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (values: IncomeCreate) => {
    setSubmitting(true);
    try {
      await createIncome(filingId, values);
      message.success('Income entry created');
      setModalOpen(false);
      setEditingEntry(null);
      await fetchEntries();
    } catch (error) {
      message.error('Failed to create income entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: IncomeCreate) => {
    if (!editingEntry) return;
    setSubmitting(true);
    try {
      await updateIncome(filingId, editingEntry.id, values);
      message.success('Income entry updated');
      setModalOpen(false);
      setEditingEntry(null);
      await fetchEntries();
    } catch (error) {
      message.error('Failed to update income entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIncome(filingId, id);
      message.success('Income entry deleted');
      await fetchEntries();
    } catch (error) {
      message.error('Failed to delete income entry');
    }
  };

  const handleToggle = async (record: IncomeEntry) => {
    try {
      await toggleIncome(filingId, record.id);
      setEntries((prev) =>
        prev.map((e) => (e.id === record.id ? { ...e, is_active: !e.is_active } : e))
      );
      message.success(`Entry ${record.is_active ? 'disabled' : 'enabled'}`);
    } catch {
      message.error('Failed to toggle entry');
    }
  };

  const handleSubmit = (values: IncomeCreate) => {
    if (editingEntry) {
      return handleUpdate(values);
    }
    return handleCreate(values);
  };

  const columns: ColumnsType<IncomeEntry> = [
    {
      title: 'Source',
      dataIndex: 'source_name',
      key: 'source_name',
      render: (value: string | null) => value || '—',
    },
    {
      title: 'Account #',
      dataIndex: 'account_number',
      key: 'account_number',
      render: (value: string | null) => <span style={monoStyle}>{value || '—'}</span>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag
          color={categoryColors[category]}
          style={{ borderRadius: 12, border: 'none', fontWeight: 500 }}
        >
          {categoryLabels[category]}
        </Tag>
      ),
    },
    {
      title: 'Amount (LKR)',
      dataIndex: 'amount_lkr',
      key: 'amount_lkr',
      align: 'right',
      sorter: (a, b) => a.amount_lkr - b.amount_lkr,
      defaultSortOrder: 'descend',
      render: (value: number) => <span style={monoStyle}>{formatLKR(value)}</span>,
    },
    {
      title: 'WHT Deducted',
      dataIndex: 'wht_deducted',
      key: 'wht_deducted',
      align: 'right',
      render: (value: number, record: IncomeEntry) => {
        const warning = getWhtWarning(record);
        return (
          <span style={monoStyle}>
            {formatLKR(value)}
            {warning && (
              <Tooltip title={warning}>
                <WarningOutlined style={{ color: '#faad14', marginLeft: 6, fontSize: 13 }} />
              </Tooltip>
            )}
          </span>
        );
      },
    },
    {
      title: 'Date',
      dataIndex: 'received_date',
      key: 'received_date',
      render: (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD') : '—'),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      align: 'center',
      render: (isActive: boolean, record) => (
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
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit entry">
            <Button
              type="text"
              shape="circle"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingEntry(record);
                setModalOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this entry?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete entry">
              <Button type="text" shape="circle" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredEntries =
    activeTab === 'all' ? entries : entries.filter((e) => e.category === activeTab);

  const totalAmount = filteredEntries.reduce((sum, e) => sum + e.amount_lkr, 0);

  return (
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
          alignItems: 'center',
          padding: '18px 20px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={sectionHeaderStyle}>Income Entries</div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ borderRadius: 8 }}
          onClick={() => {
            setEditingEntry(null);
            setModalOpen(true);
          }}
        >
          Add Income
        </Button>
      </div>

      <div style={{ padding: '8px 20px 0' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={[
            { key: 'all', label: 'All' },
            { key: 'salary', label: 'Salary' },
            { key: 'interest', label: 'Interest' },
            { key: 'foreign_employment', label: 'Foreign Currency Income' },
            { key: 'other', label: 'Other' },
          ]}
        />
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <Spin spinning={loading}>
          <Table
            className="filing-table"
            dataSource={filteredEntries}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
            rowClassName={(record) => {
              const classes = ['filing-row'];
              if (!record.is_active) classes.push('row-inactive');
              const whtStatus = getWhtStatus(record);
              if (whtStatus === 'under') classes.push('row-wht-under');
              if (whtStatus === 'over') classes.push('row-wht-over');
              return classes.join(' ');
            }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa' }}>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong style={monoStyle}>{formatLKR(totalAmount)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} colSpan={3} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Spin>
      </div>

      <IncomeForm
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingEntry(null);
        }}
        onSubmit={handleSubmit}
        whtRate={whtRate}
        initialValues={
          editingEntry
            ? {
                category: editingEntry.category,
                source_name: editingEntry.source_name,
                account_number: editingEntry.account_number,
                amount_lkr: editingEntry.amount_lkr,
                amount_foreign: editingEntry.amount_foreign,
                foreign_currency: editingEntry.foreign_currency,
                exchange_rate: editingEntry.exchange_rate,
                received_date: editingEntry.received_date,
                wht_deducted: editingEntry.wht_deducted,
                paye_deducted: editingEntry.paye_deducted,
                description: editingEntry.description,
              }
            : undefined
        }
        loading={submitting}
      />

      <style>{`
        .filing-row:hover td {
          background: #f6ffed !important;
        }
        .row-wht-under td {
          background: #fffbe6 !important;
        }
        .row-wht-under:hover td {
          background: #fff1b8 !important;
        }
        .row-wht-over td {
          background: #fff0f0 !important;
        }
        .row-wht-over:hover td {
          background: #ffccc7 !important;
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

export default IncomePage;
