import React, { useEffect, useState, useMemo } from 'react';
import {
  Button,
  Modal,
  Select,
  Form,
  message,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  SettingOutlined,
  CalendarOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  RightOutlined,
  BankOutlined,
  DollarOutlined,
  CreditCardOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getFilings, createFiling, getUsers, getFiscalYears, exportTaxHistoryPdf } from '../api/client';
import type { TaxFiling, AuthUser, FiscalYearEntry } from '../types';

const formatNum = (v: number, decimals = 0) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

const AVATAR_COLORS = [
  '#1a7a3a', '#0958d9', '#531dab', '#c41d7f', '#d46b08',
  '#08979c', '#389e0d', '#cf1322', '#1d39c4', '#7c3aed',
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#8c8c8c', bg: '#f5f5f5' },
  calculated: { label: 'Calculated', color: '#d48806', bg: '#fffbe6' },
  paying: { label: 'Paying', color: '#fa8c16', bg: '#fff7e6' },
  paid: { label: 'Paid', color: '#389e0d', bg: '#f6ffed' },
  filed: { label: 'Filed', color: '#1890ff', bg: '#e6f7ff' },
  assessed: { label: 'Assessed', color: '#722ed1', bg: '#f9f0ff' },
};

interface UserSummary {
  userId: string;
  name: string;
  filings: TaxFiling[];
  totalFilings: number;
  calculatedCount: number;
  latestFiling: TaxFiling | null;
  totalGrossIncome: number;
  totalGrossTax: number;
  totalPayments: number;    // self-assessment + net payable (what you pay)
  totalWhtCredits: number;  // WHT + PAYE (deducted at source)
  avgRate: number;
}

/* Small metric card used inside each user section */
const MiniStat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  description?: string;
}> = ({ icon, label, value, accent, description }) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 10,
      padding: '12px 14px',
      border: '1px solid #f0f0f0',
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
    }}
    title={description}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: accent }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      <span style={{ fontSize: 12, color: accent }}>{icon}</span>
      <span style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
        {label}
      </span>
    </div>
    {description && (
      <div style={{ fontSize: 9, color: '#bfbfbf', marginBottom: 4, lineHeight: '12px' }}>
        {description}
      </div>
    )}
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: accent,
        lineHeight: 1,
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value}
    </div>
  </div>
);

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearEntry[]>([]);
  const [, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [f, u, fy] = await Promise.all([getFilings(), getUsers(), getFiscalYears()]);
      setFilings(f);
      setUsers(u);
      setFiscalYears(fy);
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const filing = await createFiling(values);
      message.success('Filing created');
      setModalOpen(false);
      form.resetFields();
      navigate(`/filing/${filing.id}`);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        message.error('A filing already exists for this user and fiscal year');
      }
    }
  };

  // Current FY
  const activeFY = useMemo(() => {
    const def = fiscalYears.find((fy) => fy.is_default);
    if (def) return def.year_code;
    // Fall back to the latest active year
    const active = fiscalYears.filter((fy) => fy.is_active);
    if (active.length > 0) return active.sort((a, b) => b.year_code.localeCompare(a.year_code))[0].year_code;
    return '2025/26';
  }, [fiscalYears]);

  // Group filings by user
  const userSummaries: UserSummary[] = useMemo(() => {
    const map = new Map<string, TaxFiling[]>();
    for (const f of filings) {
      const existing = map.get(f.user_id) || [];
      existing.push(f);
      map.set(f.user_id, existing);
    }

    return Array.from(map.entries()).map(([userId, userFilings]) => {
      const sorted = [...userFilings].sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
      const totalGross = userFilings.reduce((s, f) => s + (f.gross_income ?? 0), 0);
      const totalGrossTax = userFilings.reduce((s, f) => s + (f.gross_tax ?? 0), 0);
      const totalWhtCredits = userFilings.reduce((s, f) => s + (f.wht_credits ?? 0), 0);
      // Payments = self-assessment quarterly + balance payable (net tax)
      const totalPayments = userFilings.reduce(
        (s, f) => s + (f.self_assessment_paid ?? 0) + Math.max(f.net_tax_payable ?? 0, 0),
        0
      );
      const avgRate = totalGross > 0 ? (totalGrossTax / totalGross) * 100 : 0;

      return {
        userId,
        name: userFilings[0].user_name,
        filings: sorted,
        totalFilings: userFilings.length,
        calculatedCount: userFilings.filter((f) => f.status === 'calculated').length,
        latestFiling: sorted[0] || null,
        totalGrossIncome: totalGross,
        totalGrossTax,
        totalPayments,
        totalWhtCredits,
        avgRate,
      };
    });
  }, [filings]);

  // Tax calendar: quarterly payments + final payment + filing deadline
  // FY "2025/26" → startYear=2025, endYear=2026
  // Q1 (Apr–Jun): due Aug 15 of startYear
  // Q2 (Jul–Sep): due Nov 15 of startYear
  // Q3 (Oct–Dec): due Feb 15 of endYear
  // Q4 (Jan–Mar): due May 15 of endYear
  // Final payment: due Sep 30 of endYear
  // RAMIS filing: due Nov 30 of endYear
  const taxDates = useMemo(() => {
    const parts = activeFY.split('/');
    const sy = Number(parts[0].length === 2 ? `20${parts[0]}` : parts[0]);
    const ey = Number(parts[1].length === 2 ? `20${parts[1]}` : parts[1]);
    const now = new Date();

    const items = [
      { label: 'Q1', date: new Date(sy, 7, 15) },       // Aug 15
      { label: 'Q2', date: new Date(sy, 10, 15) },      // Nov 15
      { label: 'Q3', date: new Date(ey, 1, 15) },       // Feb 15
      { label: 'Q4', date: new Date(ey, 4, 15) },       // May 15
      { label: 'Payment', date: new Date(ey, 8, 30) },  // Sep 30
      { label: 'Filing', date: new Date(ey, 10, 30) },  // Nov 30
    ];

    return items.map((item) => {
      const diffMs = item.date.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const dateStr = item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isPast = daysLeft < 0;
      const isUrgent = !isPast && daysLeft <= 30;
      const isSoon = !isPast && !isUrgent && daysLeft <= 90;
      return { ...item, daysLeft, dateStr, isPast, isUrgent, isSoon };
    });
  }, [activeFY]);

  // The next upcoming deadline
  const nextDeadline = useMemo(
    () => taxDates.find((d) => !d.isPast) || taxDates[taxDates.length - 1],
    [taxDates]
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* ====== TOP BAR ====== */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '16px 32px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1a7a3a 0%, #52c41a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🇱🇰
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', lineHeight: '20px' }}>
                SL Tax Calculator
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: '16px' }}>
                Personal Income Tax · Sri Lanka
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
              style={{ borderRadius: 8 }}
            >
              Settings
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              style={{ borderRadius: 8, fontWeight: 500 }}
            >
              New Filing
            </Button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 48px' }}>
        {/* ====== SLIM CONTEXT BAR + TAX CALENDAR ====== */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #f0f0f0',
            padding: '14px 20px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Left: FY + summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: '#1a7a3a',
                background: '#e6f7ed',
                padding: '3px 10px',
                borderRadius: 6,
              }}
            >
              FY {activeFY}
            </span>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {userSummaries.length} taxpayer{userSummaries.length !== 1 ? 's' : ''}
              <span style={{ color: '#d9d9d9', margin: '0 6px' }}>·</span>
              {filings.length} filing{filings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Right: Tax payment timeline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarOutlined style={{ fontSize: 12, color: '#8c8c8c', marginRight: 4 }} />
            {taxDates.map((d, i) => {
              const color = d.isPast ? '#8c8c8c' : d.isUrgent ? '#cf1322' : d.isSoon ? '#d48806' : '#389e0d';
              const bg = d.isPast ? '#f5f5f5' : d.isUrgent ? '#fff2f0' : d.isSoon ? '#fffbe6' : '#f6ffed';
              const borderColor = d.isPast ? '#e8e8e8' : d.isUrgent ? '#ffccc7' : d.isSoon ? '#ffe58f' : '#b7eb8f';
              const isNext = d === nextDeadline && !d.isPast;

              return (
                <React.Fragment key={d.label}>
                  {i > 0 && (
                    <div
                      style={{
                        width: 12,
                        height: 1.5,
                        background: d.isPast ? '#d9d9d9' : '#e8e8e8',
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: bg,
                      border: isNext ? `1.5px solid ${borderColor}` : `1px solid ${borderColor}`,
                      minWidth: ['Payment', 'Filing'].includes(d.label) ? 68 : 52,
                      opacity: d.isPast ? 0.6 : 1,
                    }}
                    title={`${d.label === 'Filing' ? 'RAMIS return filing' : d.label === 'Payment' ? 'Final balance payment' : `${d.label} self-assessment`}: ${d.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${d.isPast ? ' (past)' : ` — ${d.daysLeft}d left`}`}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {d.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#595959', whiteSpace: 'nowrap' }}>
                      {d.dateStr}
                    </span>
                    {!d.isPast ? (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {d.daysLeft}d
                      </span>
                    ) : (
                      <span style={{ fontSize: 9, color: '#bfbfbf' }}>—</span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ====== USER CARDS ====== */}
        {userSummaries.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {userSummaries.map((user) => {
              const color = getAvatarColor(user.name);
              const initials = user.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <div
                  key={user.userId}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #f0f0f0',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                  className="user-card"
                >
                  {/* User header — clickable to dashboard */}
                  <div
                    onClick={() => navigate(`/user/${user.userId}/dashboard`)}
                    style={{
                      padding: '20px 24px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 17,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e', lineHeight: '24px' }}>
                          {user.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                            <FileTextOutlined style={{ marginRight: 4, fontSize: 11 }} />
                            {user.totalFilings} filing{user.totalFilings !== 1 ? 's' : ''}
                          </span>
                          {(() => {
                            // Group filings by status and show counts
                            const statusCounts: Record<string, number> = {};
                            user.filings.forEach((f) => {
                              statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
                            });
                            return Object.entries(statusCounts).map(([status, count]) => {
                              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
                              return (
                                <Tag
                                  key={status}
                                  style={{
                                    borderRadius: 12,
                                    margin: 0,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: cfg.color,
                                    background: cfg.bg,
                                    border: 'none',
                                  }}
                                >
                                  {count} {cfg.label.toLowerCase()}
                                </Tag>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button
                        type="text"
                        size="small"
                        icon={<FilePdfOutlined />}
                        title="Export Tax History PDF"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportTaxHistoryPdf(user.userId)
                            .then(() => message.success('Tax History PDF downloaded'))
                            .catch(() => message.error('Failed to export PDF'));
                        }}
                        style={{ color: '#cf1322', borderRadius: 6 }}
                      />
                      <div style={{ color: '#bfbfbf', fontSize: 18 }}>
                        <RightOutlined />
                      </div>
                    </div>
                  </div>

                  {/* Per-user metric strip */}
                  <div style={{ padding: '0 24px 16px', display: 'flex', gap: 10 }}>
                    <MiniStat
                      icon={<BankOutlined />}
                      label="Gross Income"
                      description="Total from all sources"
                      value={`LKR ${formatNum(user.totalGrossIncome)}`}
                      accent="#1a7a3a"
                    />
                    <MiniStat
                      icon={<DollarOutlined />}
                      label="Gross Tax"
                      description="Tax before credits"
                      value={`LKR ${formatNum(user.totalGrossTax, 2)}`}
                      accent="#cf1322"
                    />
                    <MiniStat
                      icon={<CreditCardOutlined />}
                      label="Gross Payment"
                      description="Self-assessment + balance due"
                      value={`LKR ${formatNum(user.totalPayments, 2)}`}
                      accent="#fa8c16"
                    />
                    <MiniStat
                      icon={<BankOutlined />}
                      label="Gross Credits"
                      description="WHT + PAYE deducted at source"
                      value={`LKR ${formatNum(user.totalWhtCredits, 2)}`}
                      accent="#1890ff"
                    />
                    <MiniStat
                      icon={<PercentageOutlined />}
                      label="Eff. Rate"
                      description="Gross tax ÷ gross income"
                      value={`${user.avgRate.toFixed(1)}%`}
                      accent="#722ed1"
                    />
                  </div>

                  {/* Filing cards row */}
                  <div
                    style={{
                      padding: '0 24px 20px',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(user.filings.length, 4)}, 1fr)`,
                      gap: 12,
                    }}
                  >
                    {user.filings.slice(0, 4).map((filing, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <div
                          key={filing.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/filing/${filing.id}`);
                          }}
                          style={{
                            background: isLatest ? '#f6ffed' : '#fafafa',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: isLatest ? `1.5px solid ${color}40` : '1px solid #f0f0f0',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            position: 'relative',
                          }}
                          className="filing-mini-card"
                        >
                          {/* Status badge */}
                          {(() => {
                            const cfg = STATUS_CONFIG[filing.status] || STATUS_CONFIG.draft;
                            return (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  color: cfg.color,
                                  background: cfg.bg,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {cfg.label}
                              </div>
                            );
                          })()}
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CalendarOutlined style={{ fontSize: 10 }} />
                            FY {filing.fiscal_year}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#8c8c8c',
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                              fontWeight: 500,
                              marginBottom: 2,
                            }}
                          >
                            Net Tax
                          </div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                              fontFamily: "'JetBrains Mono', monospace",
                              color: (filing.net_tax_payable ?? 0) > 0 ? '#cf1322' : '#1a7a3a',
                              lineHeight: '20px',
                            }}
                          >
                            {filing.net_tax_payable != null
                              ? `LKR ${formatNum(filing.net_tax_payable, 2)}`
                              : '—'}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
                            Gross: LKR {filing.gross_income != null ? formatNum(filing.gross_income) : '—'}
                          </div>
                          {filing.effective_rate_pct != null && (
                            <div
                              style={{
                                marginTop: 6,
                                display: 'inline-block',
                                background: '#f5f5f5',
                                borderRadius: 6,
                                padding: '1px 6px',
                                fontSize: 11,
                                fontWeight: 500,
                                fontFamily: "'JetBrains Mono', monospace",
                                color: '#595959',
                              }}
                            >
                              {filing.effective_rate_pct.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #f0f0f0',
              padding: '64px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e', marginBottom: 4 }}>
              No filings yet
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 20 }}>
              Create your first tax filing to get started
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ borderRadius: 8 }}>
              New Filing
            </Button>
          </div>
        )}
      </div>

      {/* Create Modal */}
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
              <PlusOutlined style={{ color: '#1a7a3a', fontSize: 16 }} />
            </div>
            <span>New Tax Filing</span>
          </div>
        }
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        okText="Create & Open"
        okButtonProps={{ style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        styles={{ body: { paddingTop: 20 } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label="User" rules={[{ required: true, message: 'Select a user' }]}>
            <Select
              placeholder="Choose a user..."
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              showSearch
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item name="fiscal_year" label="Fiscal Year" rules={[{ required: true, message: 'Select a fiscal year' }]}>
            <Select
              placeholder="Choose a fiscal year..."
              options={fiscalYears.filter((fy) => fy.is_active).map((fy) => ({ value: fy.year_code, label: `FY ${fy.year_code}` }))}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .user-card:hover {
          border-color: #d9d9d9 !important;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }
        .filing-mini-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  );
};

export default HomePage;
