import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Spin,
  Button,
  Table,
  Tag,
  message,
  Empty,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  FolderOpenOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  PercentageOutlined,
  BankOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getUserDashboard } from '../api/client';
import type { UserDashboard, FilingSnapshot } from '../types';

// Typography destructuring not needed

const formatLKR = (v: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const formatLKR2 = (v: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const INCOME_COLORS: Record<string, string> = {
  Salary: '#1a7a3a',
  Interest: '#52c41a',
  Foreign: '#0891b2',
  Other: '#f59e0b',
};

const CHART_COLORS = ['#1a7a3a', '#52c41a', '#0891b2', '#f59e0b'];

const UserDashboardPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getUserDashboard(userId);
        setDashboard(data);
      } catch {
        message.error('Failed to load user dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fb' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', background: '#f8f9fb', minHeight: '100vh' }}>
        <Empty description="No data available" />
        <Button onClick={() => navigate('/')} style={{ marginTop: 16 }}>Back to Home</Button>
      </div>
    );
  }

  const filings = dashboard.filings.filter((f) => f.gross_income > 0);

  // Chart data
  const incomeOverTime = filings.map((f) => ({
    fy: f.fiscal_year,
    Salary: f.salary,
    Interest: f.interest,
    Foreign: f.foreign_employment,
    Other: f.other,
  }));

  const taxTrend = filings.map((f) => ({
    fy: f.fiscal_year,
    gross_tax: f.gross_tax,
    credits: f.total_credits,
    net_tax: f.net_tax_payable,
  }));

  // Aggregate income by category
  const totalSalary = filings.reduce((s, f) => s + f.salary, 0);
  const totalInterest = filings.reduce((s, f) => s + f.interest, 0);
  const totalForeign = filings.reduce((s, f) => s + f.foreign_employment, 0);
  const totalOther = filings.reduce((s, f) => s + f.other, 0);
  const grandTotal = totalSalary + totalInterest + totalForeign + totalOther;

  const categoryPie = [
    { name: 'Salary', value: totalSalary },
    { name: 'Interest', value: totalInterest },
    { name: 'Foreign', value: totalForeign },
    { name: 'Other', value: totalOther },
  ].filter((d) => d.value > 0);

  // YoY change
  const latestTax = filings.length > 0 ? filings[filings.length - 1].net_tax_payable : 0;
  const prevTax = filings.length > 1 ? filings[filings.length - 2].net_tax_payable : 0;
  const taxChange = prevTax > 0 ? ((latestTax - prevTax) / prevTax) * 100 : 0;

  const initials = dashboard.user_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const columns = [
    {
      title: 'Year',
      dataIndex: 'fiscal_year',
      key: 'fiscal_year',
      width: 100,
      render: (fy: string) => (
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>
          {fy}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag
          color={s === 'calculated' ? 'success' : 'warning'}
          style={{ borderRadius: 12, margin: 0, fontSize: 11 }}
        >
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Gross Income',
      dataIndex: 'gross_income',
      key: 'gross_income',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
          {formatLKR(v)}
        </span>
      ),
    },
    {
      title: 'Gross Tax',
      dataIndex: 'gross_tax',
      key: 'gross_tax',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#8c8c8c' }}>
          {formatLKR(v)}
        </span>
      ),
    },
    {
      title: 'Credits',
      dataIndex: 'total_credits',
      key: 'total_credits',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#52c41a' }}>
          −{formatLKR(v)}
        </span>
      ),
    },
    {
      title: 'Net Tax',
      dataIndex: 'net_tax_payable',
      key: 'net_tax_payable',
      align: 'right' as const,
      render: (v: number) => (
        <span
          style={{
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            color: v > 0 ? '#cf1322' : '#1a7a3a',
          }}
        >
          {formatLKR2(v)}
        </span>
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'effective_rate_pct',
      key: 'effective_rate_pct',
      align: 'right' as const,
      width: 80,
      render: (v: number) => (
        <div
          style={{
            display: 'inline-block',
            background: '#f5f5f5',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {v.toFixed(1)}%
        </div>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: unknown, record: FilingSnapshot) => (
        <Tooltip title="Open filing">
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined style={{ fontSize: 15 }} />}
            onClick={() => navigate(`/filing/${record.filing_id}`)}
            style={{ color: '#8c8c8c' }}
          />
        </Tooltip>
      ),
    },
  ];

  // Tick formatter for Y axes
  const yTickFmt = (v: number) =>
    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;

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
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', lineHeight: '20px' }}>
                {dashboard.user_name}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: '16px' }}>
                Tax History · {dashboard.filings.length} filing{dashboard.filings.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 48px' }}>
        {/* ====== METRIC CARDS ====== */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Total Income */}
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #f0f0f0',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#1a7a3a' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <BankOutlined style={{ fontSize: 13, color: '#1a7a3a' }} />
              <span style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                Total Income
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a7a3a', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
              {formatLKR(dashboard.total_income_earned)}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 6 }}>LKR across all years</div>
          </div>

          {/* Total Tax */}
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #f0f0f0',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#cf1322' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <DollarOutlined style={{ fontSize: 13, color: '#cf1322' }} />
              <span style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                Total Tax Paid
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#cf1322', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
              {formatLKR(dashboard.total_tax_paid)}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 6 }}>LKR net payable</div>
          </div>

          {/* Avg Rate */}
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #f0f0f0',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#fa8c16' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <PercentageOutlined style={{ fontSize: 13, color: '#fa8c16' }} />
              <span style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                Avg. Eff. Rate
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fa8c16', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
              {dashboard.avg_effective_rate.toFixed(2)}%
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 6 }}>weighted average</div>
          </div>

          {/* YoY Change */}
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #f0f0f0',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: taxChange >= 0 ? '#cf1322' : '#1a7a3a' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <SwapOutlined style={{ fontSize: 13, color: '#595959' }} />
              <span style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                YoY Change
              </span>
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: taxChange >= 0 ? '#cf1322' : '#1a7a3a',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {taxChange >= 0 ? <RiseOutlined style={{ fontSize: 18 }} /> : <FallOutlined style={{ fontSize: 18 }} />}
              {Math.abs(taxChange).toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 6 }}>vs previous year</div>
          </div>
        </div>

        {filings.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #f0f0f0',
              padding: '64px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e', marginBottom: 4 }}>
              No filing data yet
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 20 }}>
              Create filings and add income to see your tax history.
            </div>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </div>
        ) : (
          <>
            {/* ====== CHARTS ROW ====== */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              {/* Income Breakdown */}
              <Col xs={24} md={8}>
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #f0f0f0',
                    padding: '20px',
                    height: '100%',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', marginBottom: 16 }}>
                    Income Breakdown
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={45}
                        strokeWidth={2}
                        stroke="#fff"
                      >
                        {categoryPie.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ReTooltip
                        formatter={(value: number) => `LKR ${formatLKR(value)}`}
                        contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #f0f0f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8 }}>
                    {categoryPie.map((item) => (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: INCOME_COLORS[item.name] || '#8c8c8c',
                          }}
                        />
                        <span style={{ color: '#595959' }}>{item.name}</span>
                        <span style={{ color: '#bfbfbf' }}>
                          {grandTotal > 0 ? `${((item.value / grandTotal) * 100).toFixed(0)}%` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Col>

              {/* Income Over Time */}
              <Col xs={24} md={16}>
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #f0f0f0',
                    padding: '20px',
                    height: '100%',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', marginBottom: 16 }}>
                    Income Over Time
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={incomeOverTime} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="fy"
                        tick={{ fontSize: 12, fill: '#8c8c8c' }}
                        axisLine={{ stroke: '#f0f0f0' }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={yTickFmt}
                        tick={{ fontSize: 11, fill: '#8c8c8c' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReTooltip
                        formatter={(value: number, name: string) => [`LKR ${formatLKR(value)}`, name]}
                        contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #f0f0f0' }}
                      />
                      <Legend
                        iconType="square"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      />
                      <Bar dataKey="Salary" fill="#1a7a3a" stackId="income" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Interest" fill="#52c41a" stackId="income" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Foreign" fill="#0891b2" stackId="income" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Other" fill="#f59e0b" stackId="income" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Col>
            </Row>

            {/* Tax Trend */}
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #f0f0f0',
                padding: '20px',
                marginBottom: 24,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', marginBottom: 16 }}>
                Tax Trend
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={taxTrend} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fa8c16" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#fa8c16" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#cf1322" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#cf1322" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCredits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1890ff" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="fy"
                    tick={{ fontSize: 12, fill: '#8c8c8c' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={yTickFmt}
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReTooltip
                    formatter={(value: number, name: string) => [`LKR ${formatLKR(value)}`, name]}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #f0f0f0' }}
                  />
                  <Legend
                    iconType="line"
                    iconSize={12}
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="gross_tax"
                    name="Gross Tax"
                    stroke="#fa8c16"
                    strokeWidth={2}
                    fill="url(#gradGross)"
                    dot={{ r: 4, fill: '#fa8c16' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="credits"
                    name="Credits"
                    stroke="#1890ff"
                    strokeWidth={2}
                    fill="url(#gradCredits)"
                    dot={{ r: 4, fill: '#1890ff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="net_tax"
                    name="Net Tax"
                    stroke="#cf1322"
                    strokeWidth={2.5}
                    fill="url(#gradNet)"
                    dot={{ r: 5, fill: '#cf1322' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ====== FILING HISTORY TABLE ====== */}
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
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>Filing History</span>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                  {dashboard.filings.length} filing{dashboard.filings.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Table
                dataSource={dashboard.filings}
                columns={columns}
                rowKey="filing_id"
                pagination={false}
                size="middle"
                onRow={(record) => ({
                  onClick: () => navigate(`/filing/${record.filing_id}`),
                  style: { cursor: 'pointer' },
                })}
                rowClassName="filing-row"
                summary={() => {
                  const totalGross = dashboard.filings.reduce((s, f) => s + f.gross_income, 0);
                  const totalGrossTax = dashboard.filings.reduce((s, f) => s + f.gross_tax, 0);
                  const totalCredits = dashboard.filings.reduce((s, f) => s + f.total_credits, 0);
                  const totalNet = dashboard.filings.reduce((s, f) => s + f.net_tax_payable, 0);
                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ background: '#fafafa' }}>
                        <Table.Summary.Cell index={0} colSpan={2}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c' }}>Total</span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                            {formatLKR(totalGross)}
                          </span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#8c8c8c', fontWeight: 600 }}>
                            {formatLKR(totalGrossTax)}
                          </span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#52c41a', fontWeight: 600 }}>
                            −{formatLKR(totalCredits)}
                          </span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right">
                          <span
                            style={{
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 14,
                              color: totalNet > 0 ? '#cf1322' : '#1a7a3a',
                            }}
                          >
                            {formatLKR2(totalNet)}
                          </span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6} />
                        <Table.Summary.Cell index={7} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </div>
          </>
        )}
      </div>

      <style>{`
        .filing-row:hover td {
          background: #f6ffed !important;
        }
        .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-size: 11px !important;
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

export default UserDashboardPage;
