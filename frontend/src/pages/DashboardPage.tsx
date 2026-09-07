import React, { useState, useEffect } from 'react';
import { Row, Col, Spin, Typography, message, Tag, Button, Space } from 'antd';
import {
  ArrowDownOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  ExportOutlined,
  FilePdfOutlined,
  GiftOutlined,
  GlobalOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  PieChartOutlined,
  SafetyOutlined,
  SmileOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getIncomeSummary, compareTax, optimizeTax, getTaxConfig, exportIncomeCsv, exportFilingVisualPdf } from '../api/client';
import { useFilingContext } from '../context/AuthContext';
import type { IncomeSummary, TaxBreakdown, OptimizationResult, TaxConfig } from '../types';

const { Title, Text, Paragraph } = Typography;

const formatLKR = (v: number) =>
  'LKR ' +
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const formatLKR2 = (v: number) =>
  'LKR ' +
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const PIE_COLORS = ['#1a7a3a', '#52c41a', '#13c2c2', '#faad14'];
const CREDIT_COLORS = ['#1890ff', '#722ed1', '#0891b2', '#fa8c16'];

// ---- Shared design tokens ----
const container: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #f0f0f0',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#8c8c8c',
  fontWeight: 500,
};

const monoStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  color: '#1a1a2e',
};

const chartTooltipStyle = {
  contentStyle: { borderRadius: 8, fontSize: 12, border: '1px solid #f0f0f0' },
};

const SectionHeader: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '14px 20px',
      borderBottom: '1px solid #f0f0f0',
      ...sectionHeaderStyle,
    }}
  >
    {icon}
    {children}
  </div>
);

const AccentBar: React.FC<{ color: string }> = ({ color }) => (
  <div style={{ height: 3, width: '100%', background: color, borderRadius: '12px 12px 0 0' }} />
);

const DashboardPage: React.FC = () => {
  const { currentFiling } = useFilingContext();
  const filingId = currentFiling!.id;
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [localBreakdown, setLocalBreakdown] = useState<TaxBreakdown | null>(null);
  const [foreignBreakdown, setForeignBreakdown] = useState<TaxBreakdown | null>(null);
  const [optimized, setOptimized] = useState<OptimizationResult | null>(null);
  const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, compareRes, optRes, configRes] = await Promise.all([
          getIncomeSummary(filingId),
          compareTax(filingId),
          optimizeTax(filingId),
          getTaxConfig(currentFiling!.fiscal_year),
        ]);
        setSummary(summaryRes);
        setLocalBreakdown(compareRes.local);
        setForeignBreakdown(compareRes.foreign);
        setOptimized(optRes);
        setTaxConfig(configRes);
      } catch {
        message.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filingId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!summary || !optimized || !localBreakdown || !foreignBreakdown) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <ThunderboltOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
        <Title level={4}>No data available yet</Title>
        <Paragraph type="secondary">
          Add some income entries to see your optimized tax summary.
        </Paragraph>
      </div>
    );
  }

  const best = optimized.optimized;
  const savings = optimized.tax_savings;
  const recommended = optimized.recommended_relief_on;
  const hasForeign = best.gross_income.foreign_employment > 0;
  const hasDomestic = (best.gross_income.salary + best.gross_income.interest + best.gross_income.other) > 0;

  // Waterfall data for the optimized breakdown
  const waterfallSteps = [
    {
      title: 'Gross Income',
      value: best.gross_income.total,
      color: '#1a7a3a',
      icon: <WalletOutlined />,
      desc: 'Total from all sources',
    },
    // Interest exemption is irrelevant when there's no domestic income
    ...(hasDomestic ? [{
      title: 'Interest Exemption',
      value: -best.exemptions.interest_exempt_amount,
      color: '#52c41a',
      icon: <SafetyOutlined />,
      desc: best.exemptions.interest_exempt_amount > 0
        ? `${formatLKR(best.exemptions.interest_exempt_amount)} exempted`
        : 'No interest exempted',
    }] : []),
    {
      title: 'Tax-Free Relief',
      value: -best.tax_free_allowance,
      color: '#0891b2',
      icon: <GiftOutlined />,
      desc: hasForeign ? `Applied to ${recommended === 'local' ? 'local' : 'foreign'} income` : 'Tax-free allowance',
    },
    {
      title: 'Gross Tax',
      value: best.gross_tax,
      color: '#fa8c16',
      icon: <BankOutlined />,
      desc: hasForeign && hasDomestic ? `Domestic ${formatLKR(best.domestic_tax.tax)} + Foreign ${formatLKR(best.foreign_tax.tax)}` : `From progressive slabs`,
    },
    {
      title: 'Tax Credits',
      value: -best.credits.total_credits,
      color: '#1890ff',
      icon: <CreditCardOutlined />,
      desc: 'WHT + PAYE + Self Assessment',
    },
    {
      title: 'Net Payable',
      value: best.net_tax_payable,
      color: best.net_tax_payable > 0 ? '#cf1322' : '#1a7a3a',
      icon: best.net_tax_payable > 0 ? <FilePdfOutlined /> : <SmileOutlined />,
      desc: best.net_tax_payable <= 0 ? 'You get a refund!' : 'Amount due to IRD',
    },
  ];

  const pieData = [
    { name: 'Salary', value: summary.salary_total },
    { name: 'Interest', value: summary.interest_total },
    { name: 'Foreign', value: summary.foreign_total },
    { name: 'Other', value: summary.other_total },
  ].filter((d) => d.value > 0);

  const slabSource = hasDomestic ? best.domestic_tax.slab_breakdown : best.foreign_tax.slab_breakdown;
  const domesticBarData = slabSource.map((slab) => ({
    name: slab.label,
    taxable: slab.taxable_in_slab,
    tax: slab.tax,
  }));

  // Credit breakdown for the donut
  const creditData = [
    { name: 'WHT', value: best.credits.wht_on_interest },
    { name: 'PAYE', value: best.credits.paye_deducted },
    { name: 'Self Assessment', value: best.credits.self_assessment_paid },
    ...best.credits.adjustments
      .filter((a) => a.adjustment_type !== 'other_deduction')
      .map((a) => ({ name: a.label, value: a.amount })),
  ].filter((d) => d.value > 0);

  return (
    <div>
      {/* ====== HERO BANNER ====== */}
      <div style={{ ...container, marginBottom: 16, overflow: 'hidden' }}>
        <AccentBar color="#1a7a3a" />
        <div style={{ padding: '28px 32px' }}>
          <Row align="middle" gutter={[32, 16]}>
            <Col xs={24} md={8}>
              <Text style={labelStyle}>Optimized Net Tax Payable</Text>
              <div
                style={{
                  ...monoStyle,
                  color: best.net_tax_payable > 0 ? '#cf1322' : '#1a7a3a',
                  fontSize: 34,
                  fontWeight: 700,
                  margin: '4px 0 0',
                  lineHeight: 1.2,
                }}
              >
                {formatLKR2(best.net_tax_payable)}
              </div>
              <Text style={{ color: '#8c8c8c', fontSize: 13 }}>
                Effective Rate: <span style={monoStyle}>{best.effective_rate_pct.toFixed(2)}%</span>
              </Text>
            </Col>

            <Col xs={24} md={8}>
              <div
                style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 12,
                  padding: '14px 18px',
                }}
              >
                <Text style={labelStyle}>Gross Income</Text>
                <div style={{ ...monoStyle, color: '#1a1a2e', fontSize: 20, fontWeight: 600 }}>
                  {formatLKR(best.gross_income.total)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text style={labelStyle}>Gross Tax</Text>
                  <div style={{ ...monoStyle, color: '#fa8c16', fontSize: 17, fontWeight: 600 }}>
                    {formatLKR(best.gross_tax)}
                  </div>
                </div>
              </div>
            </Col>

            <Col xs={24} md={8}>
              {savings > 0 && hasForeign ? (
                <div
                  style={{
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: 12,
                    padding: '14px 18px',
                    textAlign: 'center',
                  }}
                >
                  <ThunderboltOutlined style={{ fontSize: 22, color: '#1a7a3a' }} />
                  <div style={{ ...monoStyle, color: '#1a7a3a', fontSize: 20, fontWeight: 700, margin: '4px 0' }}>
                    Save {formatLKR(savings)}
                  </div>
                  <Text style={{ color: '#595959', fontSize: 13 }}>
                    by applying relief to{' '}
                    <Tag color="green" style={{ margin: 0 }}>
                      {recommended === 'local' ? 'Local Income' : 'Foreign Income'}
                    </Tag>
                  </Text>
                </div>
              ) : (
                <div
                  style={{
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 12,
                    padding: '14px 18px',
                    textAlign: 'center',
                  }}
                >
                  <CheckCircleOutlined style={{ fontSize: 22, color: '#1a7a3a' }} />
                  <div style={{ color: '#1a1a2e', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                    Both options equal
                  </div>
                  <Text style={{ color: '#8c8c8c', fontSize: 13 }}>
                    No savings from switching relief
                  </Text>
                </div>
              )}
            </Col>
          </Row>
        </div>
      </div>

      {/* ====== TAX WATERFALL FLOW ====== */}
      <div style={{ ...container, marginBottom: 16 }}>
        <SectionHeader icon={<ArrowDownOutlined />}>Your Tax Journey — Step by Step</SectionHeader>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0' }}>
            {waterfallSteps.map((step, i) => (
              <React.Fragment key={step.title}>
                <div
                  style={{
                    flex: '0 0 auto',
                    minWidth: 150,
                    background: i === waterfallSteps.length - 1
                      ? (step.value > 0 ? '#fff2f0' : '#f6ffed')
                      : '#fafafa',
                    border: i === waterfallSteps.length - 1
                      ? `1px solid ${step.color}`
                      : '1px solid #f0f0f0',
                    borderTop: `3px solid ${step.color}`,
                    borderRadius: 10,
                    padding: '14px 14px',
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4, color: step.color }}>{step.icon}</div>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ ...monoStyle, fontSize: 17, fontWeight: 700, color: step.color }}>
                    {step.value < 0 ? '−' : ''}{formatLKR(Math.abs(step.value))}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>{step.desc}</div>
                </div>
                {i < waterfallSteps.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
                    <ArrowDownOutlined
                      style={{ fontSize: 16, color: '#d9d9d9', transform: 'rotate(-90deg)' }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ====== RELIEF COMPARISON (only shown when FY has foreign tax AND user has foreign income) ====== */}
      {taxConfig?.has_foreign_tax !== false && hasForeign && (
      <div style={{ ...container, marginBottom: 16 }}>
        <SectionHeader icon={<SwapOutlined />}>
          Relief Comparison — Where to Apply {formatLKR(best.tax_free_allowance)}?
        </SectionHeader>
        <div style={{ padding: '20px' }}>
        <Row gutter={[24, 16]}>
          {/* Local Relief Option */}
          <Col xs={24} md={12}>
            <div
              style={{
                border: recommended === 'local' ? '1px solid #b7eb8f' : '1px solid #f0f0f0',
                borderTop: recommended === 'local' ? '3px solid #1a7a3a' : '3px solid #d9d9d9',
                borderRadius: 10,
                padding: 20,
                background: recommended === 'local' ? '#f6ffed' : '#fff',
                position: 'relative',
              }}
            >
              {recommended === 'local' && (
                <Tag
                  color="green"
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    fontSize: 12,
                    padding: '2px 12px',
                  }}
                >
                  <CheckCircleOutlined /> BEST
                </Tag>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <HomeOutlined style={{ fontSize: 22, color: '#1a7a3a' }} />
                <div>
                  <Text strong style={{ fontSize: 16 }}>Relief on Local Income</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Local: Progressive Slabs • Foreign: Flat {((localBreakdown.foreign_tax.slab_breakdown[localBreakdown.foreign_tax.slab_breakdown.length - 1]?.rate ?? 0) * 100).toFixed(0)}%
                  </Text>
                </div>
              </div>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text style={labelStyle}>Domestic Tax</Text>
                  <div style={{ ...monoStyle, fontWeight: 600 }}>{formatLKR(localBreakdown.domestic_tax.tax)}</div>
                </Col>
                <Col span={12}>
                  <Text style={labelStyle}>Foreign Tax</Text>
                  <div style={{ ...monoStyle, fontWeight: 600 }}>{formatLKR(localBreakdown.foreign_tax.tax)}</div>
                </Col>
                <Col span={12}>
                  <Text style={labelStyle}>Gross Tax</Text>
                  <div style={{ ...monoStyle, fontWeight: 600 }}>{formatLKR(localBreakdown.gross_tax)}</div>
                </Col>
                <Col span={12}>
                  <Text style={labelStyle}>Credits</Text>
                  <div style={{ ...monoStyle, fontWeight: 600, color: '#1890ff' }}>
                    −{formatLKR(localBreakdown.credits.total_credits)}
                  </div>
                </Col>
              </Row>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #f0f0f0',
                  textAlign: 'center',
                }}
              >
                <Text style={labelStyle}>Net Payable</Text>
                <div
                  style={{
                    ...monoStyle,
                    fontSize: 22,
                    fontWeight: 700,
                    color: recommended === 'local' ? '#1a7a3a' : '#595959',
                  }}
                >
                  {formatLKR2(localBreakdown.net_tax_payable)}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Effective: {localBreakdown.effective_rate_pct.toFixed(2)}%
                </Text>
              </div>
            </div>
          </Col>

          {/* Foreign Relief Option */}
          <Col xs={24} md={12}>
            <div
              style={{
                border: recommended === 'foreign' ? '1px solid #b7eb8f' : '1px solid #f0f0f0',
                borderTop: recommended === 'foreign' ? '3px solid #1a7a3a' : '3px solid #d9d9d9',
                borderRadius: 10,
                padding: 20,
                background: recommended === 'foreign' ? '#f6ffed' : '#fff',
                position: 'relative',
              }}
            >
              {recommended === 'foreign' && (
                <Tag
                  color="green"
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    fontSize: 12,
                    padding: '2px 12px',
                  }}
                >
                  <CheckCircleOutlined /> BEST
                </Tag>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <GlobalOutlined style={{ fontSize: 22, color: '#0891b2' }} />
                <div>
                  <Text strong style={{ fontSize: 16 }}>Relief on Foreign Income</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Local: Flat {((foreignBreakdown.domestic_tax.slab_breakdown[foreignBreakdown.domestic_tax.slab_breakdown.length - 1]?.rate ?? 0) * 100).toFixed(0)}% • Foreign: Progressive Brackets
                  </Text>
                </div>
              </div>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text style={labelStyle}>Domestic Tax</Text>
                  <div style={{ ...monoStyle, fontWeight: 600 }}>{formatLKR(foreignBreakdown.domestic_tax.tax)}</div>
                </Col>
                <Col span={12}>
                  <Text style={labelStyle}>Foreign Tax</Text>
                  <div style={{ ...monoStyle, fontWeight: 600 }}>{formatLKR(foreignBreakdown.foreign_tax.tax)}</div>
                </Col>
                <Col span={12}>
                  <Text style={labelStyle}>Gross Tax</Text>
                  <div style={{ ...monoStyle, fontWeight: 600 }}>{formatLKR(foreignBreakdown.gross_tax)}</div>
                </Col>
                <Col span={12}>
                  <Text style={labelStyle}>Credits</Text>
                  <div style={{ ...monoStyle, fontWeight: 600, color: '#1890ff' }}>
                    −{formatLKR(foreignBreakdown.credits.total_credits)}
                  </div>
                </Col>
              </Row>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #f0f0f0',
                  textAlign: 'center',
                }}
              >
                <Text style={labelStyle}>Net Payable</Text>
                <div
                  style={{
                    ...monoStyle,
                    fontSize: 22,
                    fontWeight: 700,
                    color: recommended === 'foreign' ? '#1a7a3a' : '#595959',
                  }}
                >
                  {formatLKR2(foreignBreakdown.net_tax_payable)}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Effective: {foreignBreakdown.effective_rate_pct.toFixed(2)}%
                </Text>
              </div>
            </div>
          </Col>
        </Row>

        {savings > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 20px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <ThunderboltOutlined style={{ color: '#1a7a3a', marginRight: 8 }} />
            <Text strong style={{ color: '#1a7a3a' }}>
              Applying relief to {recommended === 'local' ? 'Local' : 'Foreign'} Income saves you{' '}
              {formatLKR(savings)} per year
            </Text>
          </div>
        )}
        </div>
      </div>
      )}

      {/* ====== NO FOREIGN TAX NOTICE ====== */}
      {taxConfig?.has_foreign_tax === false && (
        <div style={{ ...container, marginBottom: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <InfoCircleOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
            <div>
              <Text strong>FY {taxConfig.fiscal_year} — No Separate Foreign Income Tax</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 13 }}>
                This fiscal year does not have a separate foreign income tax regime.
                All income (including foreign currency income) is taxed under a single set of progressive slabs.
              </Text>
            </div>
          </div>
        </div>
      )}

      {/* ====== INCOME + CREDITS BREAKDOWN ====== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <div style={{ ...container, height: '100%' }}>
            <SectionHeader icon={<PieChartOutlined />}>Income Breakdown</SectionHeader>
            <div style={{ padding: '16px 20px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(value: number) => formatLKR(value)} {...chartTooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 8 }}>
                {pieData.map((d, i) => (
                  <div
                    key={d.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: i < pieData.length - 1 ? '1px solid #fafafa' : 'none',
                    }}
                  >
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: PIE_COLORS[i % PIE_COLORS.length],
                          marginRight: 8,
                        }}
                      />
                      {d.name}
                    </span>
                    <Text strong style={monoStyle}>{formatLKR(d.value)}</Text>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0 0',
                    borderTop: '2px solid #f0f0f0',
                    marginTop: 4,
                  }}
                >
                  <Text strong>Total</Text>
                  <Text strong style={{ ...monoStyle, color: '#1a7a3a' }}>{formatLKR(summary.grand_total)}</Text>
                </div>
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} md={12}>
          <div style={{ ...container, height: '100%' }}>
            <SectionHeader icon={<CreditCardOutlined />}>Credits &amp; Deductions</SectionHeader>
            <div style={{ padding: '16px 20px' }}>
            {creditData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={creditData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {creditData.map((entry, index) => (
                        <Cell key={entry.name} fill={CREDIT_COLORS[index % CREDIT_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(value: number) => formatLKR(value)} {...chartTooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 8 }}>
                  {creditData.map((d, i) => (
                    <div
                      key={d.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        borderBottom: i < creditData.length - 1 ? '1px solid #fafafa' : 'none',
                      }}
                    >
                      <span>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: CREDIT_COLORS[i % CREDIT_COLORS.length],
                            marginRight: 8,
                          }}
                        />
                        {d.name}
                      </span>
                      <Text strong style={monoStyle}>{formatLKR(d.value)}</Text>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0 0',
                      borderTop: '2px solid #f0f0f0',
                      marginTop: 4,
                    }}
                  >
                    <Text strong>Total Credits</Text>
                    <Text strong style={{ ...monoStyle, color: '#1890ff' }}>
                      {formatLKR(best.credits.total_credits)}
                    </Text>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf' }}>
                <InfoCircleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <div>No credits applied yet</div>
              </div>
            )}
            </div>
          </div>
        </Col>
      </Row>

      {/* ====== SLAB VISUALIZATION ====== */}
      <div style={{ ...container, marginBottom: 16 }}>
        <SectionHeader icon={<BankOutlined />}>
          Tax Slab Breakdown — {!hasDomestic ? 'Foreign Brackets' : (!hasForeign || recommended === 'local') ? 'Progressive Slabs' : 'Progressive Brackets (Foreign)'}
        </SectionHeader>
        <div style={{ padding: '16px 20px' }}>
          <ResponsiveContainer width="100%" height={Math.max(200, domesticBarData.length * 55)}>
            <BarChart data={domesticBarData} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                type="number"
                tickFormatter={(v) =>
                  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
                }
              />
              <YAxis dataKey="name" type="category" width={160} style={{ fontSize: 12 }} />
              <ReTooltip formatter={(value: number) => formatLKR(value)} {...chartTooltipStyle} />
              <Legend />
              <Bar dataKey="taxable" name="Taxable Amount" fill="#52c41a" radius={[0, 4, 4, 0]} />
              <Bar dataKey="tax" name="Tax Due" fill="#fa8c16" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ====== EXPORT SECTION ====== */}
      <div style={container}>
        <SectionHeader icon={<ExportOutlined />}>Export Data</SectionHeader>
        <div style={{ padding: '16px 20px' }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={async () => {
                try {
                  await exportFilingVisualPdf(filingId);
                  message.success('Visual PDF downloaded');
                } catch {
                  message.error('PDF export failed');
                }
              }}
            >
              Filing Summary (PDF)
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                try {
                  await exportIncomeCsv(filingId);
                  message.success('Income CSV downloaded');
                } catch {
                  message.error('Export failed');
                }
              }}
            >
              Income Data (CSV)
            </Button>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Filing Summary: visual report with charts. Income CSV: raw entries for spreadsheets. For RAMIS filing, use "Export for RAMIS" on the Tax Calculation tab.
            </Typography.Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
