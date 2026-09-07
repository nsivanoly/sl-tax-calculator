import React, { useEffect, useState, useMemo } from 'react';
import { Tabs, Button, Spin, message, Tag, Dropdown } from 'antd';
import { ArrowLeftOutlined, DownOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getFiling, updateFiling, getAdjustments } from '../api/client';
import { useFilingContext } from '../context/AuthContext';
import TaxCalendarBar from '../components/TaxCalendarBar';
import type { QuarterPayments } from '../components/TaxCalendarBar';
import type { TaxAdjustment } from '../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#8c8c8c', bg: '#f5f5f5' },
  calculated: { label: 'Calculated', color: '#d48806', bg: '#fffbe6' },
  paying: { label: 'Paying', color: '#fa8c16', bg: '#fff7e6' },
  paid: { label: 'Paid', color: '#389e0d', bg: '#f6ffed' },
  filed: { label: 'Filed', color: '#1890ff', bg: '#e6f7ff' },
  assessed: { label: 'Assessed', color: '#722ed1', bg: '#f9f0ff' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['calculated'],
  calculated: ['paying', 'paid', 'filed', 'draft'],
  paying: ['paid', 'filed', 'calculated', 'draft'],
  paid: ['filed', 'calculated', 'draft'],
  filed: ['assessed', 'draft'],
  assessed: ['filed', 'draft'],
};

import DashboardPage from './DashboardPage';
import IncomePage from './IncomePage';
import UploadPage from './UploadPage';
import CalculationPage from './CalculationPage';
import AdjustmentsPage from './AdjustmentsPage';
import OptimizerPage from './OptimizerPage';

const FilingWorkspace: React.FC = () => {
  const { filingId } = useParams<{ filingId: string }>();
  const navigate = useNavigate();
  const { currentFiling, setCurrentFiling } = useFilingContext();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [adjustments, setAdjustments] = useState<TaxAdjustment[]>([]);

  useEffect(() => {
    if (!filingId) return;

    const loadFiling = async () => {
      try {
        const [filing, adjs] = await Promise.all([
          getFiling(filingId),
          getAdjustments(filingId),
        ]);
        setCurrentFiling(filing);
        setAdjustments(adjs);
      } catch {
        message.error('Filing not found');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadFiling();

    return () => {
      setCurrentFiling(null);
    };
  }, [filingId]);

  // Derive quarterly payment amounts from self-assessment adjustments
  const quarterPayments: QuarterPayments = useMemo(() => {
    const payments: QuarterPayments = {};
    for (const adj of adjustments) {
      if (adj.adjustment_type === 'self_assessment' && adj.quarter && adj.is_active) {
        const q = adj.quarter as keyof QuarterPayments;
        payments[q] = (payments[q] || 0) + adj.amount;
      }
    }
    return payments;
  }, [adjustments]);

  if (loading || !currentFiling) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fb' }}>
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'summary',
      label: '📊 Summary',
      children: <DashboardPage />,
    },
    {
      key: 'income',
      label: '💰 Income',
      children: <IncomePage />,
    },
    {
      key: 'upload',
      label: '📤 Upload CSV',
      children: <UploadPage />,
    },
    {
      key: 'calculate',
      label: '🧮 Calculate',
      children: <CalculationPage />,
    },
    {
      key: 'adjustments',
      label: '🔧 Adjustments',
      children: <AdjustmentsPage />,
    },
    {
      key: 'optimize',
      label: '⚡ Optimize',
      children: <OptimizerPage />,
    },
  ];

  const initials = currentFiling.user_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const statusCfg = STATUS_CONFIG[currentFiling.status] || STATUS_CONFIG.draft;
  const allowedTransitions = STATUS_TRANSITIONS[currentFiling.status] || [];

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await updateFiling(currentFiling.id, { status: newStatus });
      setCurrentFiling(updated);
      message.success(`Status changed to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to update status';
      message.error(detail);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* ====== TOP BAR ====== */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '14px 32px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ borderRadius: 8, color: '#595959' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1a7a3a 0%, #52c41a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', lineHeight: '20px' }}>
                {currentFiling.user_name}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: '16px' }}>
                FY {currentFiling.fiscal_year}
              </div>
            </div>
          </div>
          <Dropdown
            menu={{
              items: allowedTransitions.map((s) => {
                const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.draft;
                return {
                  key: s,
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: cfg.color,
                          display: 'inline-block',
                        }}
                      />
                      {cfg.label}
                    </span>
                  ),
                };
              }),
              onClick: ({ key }) => handleStatusChange(key),
            }}
            trigger={['click']}
          >
            <Tag
              style={{
                borderRadius: 12,
                margin: 0,
                fontSize: 12,
                fontWeight: 500,
                color: statusCfg.color,
                background: statusCfg.bg,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 12px',
              }}
            >
              {statusCfg.label}
              <DownOutlined style={{ fontSize: 9 }} />
            </Tag>
          </Dropdown>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px 48px' }}>
        {/* Tax calendar bar */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #f0f0f0',
            padding: '10px 16px',
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500 }}>
            FY {currentFiling.fiscal_year} Tax Dates
          </span>
          <TaxCalendarBar
            fiscalYear={currentFiling.fiscal_year}
            quarterPayments={quarterPayments}
            filingStatus={currentFiling.status}
          />
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ marginTop: 8 }}
        />
      </div>
    </div>
  );
};

export default FilingWorkspace;
