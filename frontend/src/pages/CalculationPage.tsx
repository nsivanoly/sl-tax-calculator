import React, { useState, useEffect } from 'react';
import { Table, Typography, Button, Spin, message, Tag, Radio, Dropdown } from 'antd';
import { CalculatorOutlined, DownloadOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { calculateTax, exportTaxSummaryPdf, exportTaxSummaryXlsx } from '../api/client';
import { useFilingContext } from '../context/AuthContext';
import type { TaxBreakdown, SlabDetail } from '../types';

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const formatPct = (v: number) => v.toFixed(2) + '%';

const SLAB_COLORS = ['#52c41a', '#1a7a3a', '#faad14', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2'];

const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#8c8c8c',
  fontWeight: 500,
};

const slabColumns = [
  { title: 'Slab', dataIndex: 'label', key: 'label' },
  {
    title: 'Taxable Amount',
    dataIndex: 'taxable_in_slab',
    key: 'taxable',
    align: 'right' as const,
    render: (v: number) => <span style={monoStyle}>{formatLKR(v)}</span>,
  },
  {
    title: 'Rate',
    dataIndex: 'rate',
    key: 'rate',
    align: 'right' as const,
    render: (v: number) => <span style={monoStyle}>{formatPct(v * 100)}</span>,
  },
  {
    title: 'Tax',
    dataIndex: 'tax',
    key: 'tax',
    align: 'right' as const,
    render: (v: number) => <span style={monoStyle}>{formatLKR(v)}</span>,
  },
];

// ---- Small styled building blocks -------------------------------------

const SectionCard: React.FC<{
  title: React.ReactNode;
  extra?: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
}> = ({ title, extra, accentColor, children }) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #f0f0f0',
      marginBottom: 16,
      overflow: 'hidden',
    }}
  >
    {accentColor && <div style={{ height: 3, background: accentColor }} />}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: '1px solid #f0f0f0',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </div>
      {extra}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

const InfoRow: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  danger?: boolean;
  summary?: boolean;
}> = ({ label, value, strong, danger, summary }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 14px',
      background: summary ? '#fafafa' : 'transparent',
      borderBottom: '1px solid #f0f0f0',
      borderRadius: summary ? 8 : 0,
    }}
  >
    <span style={{ color: strong ? '#1a1a2e' : '#595959', fontWeight: strong ? 600 : 400 }}>{label}</span>
    <span
      style={{
        ...monoStyle,
        fontWeight: strong ? 700 : 500,
        color: danger ? '#cf1322' : strong ? '#1a1a2e' : '#1a1a2e',
      }}
    >
      {value}
    </span>
  </div>
);

const CalculationPage: React.FC = () => {
  const { currentFiling } = useFilingContext();
  const filingId = currentFiling!.id;
  const [breakdown, setBreakdown] = useState<TaxBreakdown | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [reliefOn, setReliefOn] = useState<string>('local');

  const fetchCalculation = async (relief?: string) => {
    setLoading(true);
    try {
      const data = await calculateTax(filingId, undefined, relief || reliefOn);
      setBreakdown(data);
    } catch (error) {
      message.error('Failed to calculate tax');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalculation();
  }, []);

  const handleReliefChange = (value: string) => {
    setReliefOn(value);
    fetchCalculation(value);
  };

  const creditData = breakdown ? [
    { key: '1', type: 'WHT on Interest', amount: breakdown.credits.wht_on_interest },
    ...(breakdown.credits.paye_deducted > 0
      ? [{ key: '2', type: 'PAYE Deducted (from Salary)', amount: breakdown.credits.paye_deducted }]
      : []),
    ...breakdown.credits.adjustments.map((adj, i) => ({
      key: `adj-${i}`,
      type: adj.label,
      amount: adj.adjustment_type === 'other_deduction' ? -adj.amount : adj.amount,
    })),
    { key: 'total', type: 'Total Credits', amount: breakdown.credits.total_credits },
  ] : [];

  const creditColumns = [
    { title: 'Credit Type', dataIndex: 'type', key: 'type' },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => <span style={monoStyle}>{formatLKR(v)}</span>,
    },
  ];

  const renderSlabChart = (slabData: SlabDetail[], title: string) => {
    const chartData = slabData.map((slab) => ({
      name: slab.label,
      taxable: slab.taxable_in_slab,
      tax: slab.tax,
    }));
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>{title}</div>
        <ResponsiveContainer width="100%" height={Math.max(200, slabData.length * 60)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <XAxis type="number" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : `${v}`} />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip formatter={(value: number) => formatLKR(value)} />
            <Legend />
            <Bar dataKey="taxable" name="Taxable Amount" fill="#52c41a" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={SLAB_COLORS[index % SLAB_COLORS.length]} />
              ))}
            </Bar>
            <Bar dataKey="tax" name="Tax" fill="#fa8c16" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Spin spinning={loading}>
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Typography.Title level={3} style={{ margin: 0, fontSize: 20, color: '#1a1a2e' }}>
            Tax Calculation
          </Typography.Title>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={() => fetchCalculation()}
              loading={loading}
              style={{ borderRadius: 8 }}
            >
              Recalculate
            </Button>
            {breakdown && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'pdf',
                      icon: <FilePdfOutlined style={{ color: '#cf1322' }} />,
                      label: 'Download PDF',
                      onClick: async () => {
                        try {
                          await exportTaxSummaryPdf(filingId);
                          message.success('PDF downloaded');
                        } catch {
                          message.error('Failed to export PDF');
                        }
                      },
                    },
                    {
                      key: 'xlsx',
                      icon: <FileExcelOutlined style={{ color: '#1a7a3a' }} />,
                      label: 'Download Excel (.xlsx)',
                      onClick: async () => {
                        try {
                          await exportTaxSummaryXlsx(filingId);
                          message.success('Excel file downloaded');
                        } catch {
                          message.error('Failed to export Excel');
                        }
                      },
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button icon={<DownloadOutlined />} style={{ borderRadius: 8 }}>
                  Export for RAMIS
                </Button>
              </Dropdown>
            )}
          </div>
        </div>

        {/* Relief Selection */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #f0f0f0',
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: '#1a1a2e' }}>
            Apply <span style={monoStyle}>LKR {new Intl.NumberFormat('en-US').format(breakdown?.tax_free_allowance ?? 0)}</span> Relief to
          </span>
          <Radio.Group value={reliefOn} onChange={(e) => handleReliefChange(e.target.value)}>
            <Radio.Button value="local">Local Income</Radio.Button>
            <Radio.Button value="foreign">Foreign Income</Radio.Button>
          </Radio.Group>
        </div>

        {breakdown && (
          <>
            {/* Section 1: Gross Income */}
            <SectionCard title="1. Gross Income" accentColor="#1890ff">
              <InfoRow label="Salary" value={formatLKR(breakdown.gross_income.salary)} />
              <InfoRow label="Interest" value={formatLKR(breakdown.gross_income.interest)} />
              <InfoRow label="Foreign Currency Income" value={formatLKR(breakdown.gross_income.foreign_employment)} />
              <InfoRow label="Other" value={formatLKR(breakdown.gross_income.other)} />
              <div style={{ marginTop: 8 }}>
                <InfoRow label="Total Gross Income" value={formatLKR(breakdown.gross_income.total)} strong summary />
              </div>
            </SectionCard>

            {/* Section 2: Domestic Income Tax */}
            <SectionCard
              accentColor="#1a7a3a"
              title={
                <>
                  2. Domestic Income Tax
                  {breakdown.relief_applied_to === 'local'
                    ? <Tag color="green" style={{ borderRadius: 12, border: 'none' }}>Progressive Slabs (with {(breakdown.tax_free_allowance / 1000000).toFixed(1)}M Relief)</Tag>
                    : <Tag color="red" style={{ borderRadius: 12, border: 'none' }}>Flat {((breakdown.domestic_tax.slab_breakdown[breakdown.domestic_tax.slab_breakdown.length - 1]?.rate ?? 0) * 100).toFixed(0)}%</Tag>
                  }
                </>
              }
            >
              <InfoRow label="Salary" value={formatLKR(breakdown.gross_income.salary)} />
              <InfoRow label="Interest" value={formatLKR(breakdown.gross_income.interest)} />
              {breakdown.exemptions.interest_exempt_amount > 0 && (
                <InfoRow
                  label="Less: Interest Exemption"
                  value={`− ${formatLKR(breakdown.exemptions.interest_exempt_amount)}`}
                  danger
                />
              )}
              <InfoRow label="Other" value={formatLKR(breakdown.gross_income.other)} />
              <div style={{ marginTop: 8, marginBottom: 16 }}>
                <InfoRow label="Total Domestic Income" value={formatLKR(breakdown.domestic_tax.domestic_income)} strong summary />
              </div>

              <Table
                dataSource={breakdown.domestic_tax.slab_breakdown.map((s, i) => ({ ...s, key: i }))}
                columns={slabColumns}
                pagination={false}
                size="small"
                summary={() => (
                  <Table.Summary>
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0}><strong>Domestic Tax</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <strong style={monoStyle}>{formatLKR(breakdown.domestic_tax.domestic_income)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3} align="right">
                        <strong style={monoStyle}>{formatLKR(breakdown.domestic_tax.tax)}</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />

              {renderSlabChart(breakdown.domestic_tax.slab_breakdown, 'Domestic Slab Visualization')}
            </SectionCard>

            {/* Section 3: Foreign Income Tax */}
            <SectionCard
              accentColor="#0891b2"
              title={
                <>
                  3. Foreign Income Tax
                  {breakdown.relief_applied_to === 'foreign'
                    ? <Tag color="green" style={{ borderRadius: 12, border: 'none' }}>Foreign Brackets (with {(breakdown.tax_free_allowance / 1000000).toFixed(1)}M Relief)</Tag>
                    : <Tag color="red" style={{ borderRadius: 12, border: 'none' }}>Flat {((breakdown.foreign_tax.slab_breakdown[breakdown.foreign_tax.slab_breakdown.length - 1]?.rate ?? 0) * 100).toFixed(0)}%</Tag>
                  }
                </>
              }
            >
              <div style={{ marginBottom: 16 }}>
                <InfoRow label="Foreign Currency Income" value={formatLKR(breakdown.foreign_tax.foreign_income)} strong />
              </div>

              <Table
                dataSource={breakdown.foreign_tax.slab_breakdown.map((s, i) => ({ ...s, key: i }))}
                columns={slabColumns}
                pagination={false}
                size="small"
                summary={() => (
                  <Table.Summary>
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0}><strong>Foreign Tax</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <strong style={monoStyle}>{formatLKR(breakdown.foreign_tax.foreign_income)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3} align="right">
                        <strong style={monoStyle}>{formatLKR(breakdown.foreign_tax.tax)}</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />

              {renderSlabChart(breakdown.foreign_tax.slab_breakdown, 'Foreign Slab Visualization')}
            </SectionCard>

            {/* Section 4: Gross Tax */}
            <SectionCard title="4. Gross Tax" accentColor="#fa8c16">
              <InfoRow label="Domestic Tax" value={formatLKR(breakdown.domestic_tax.tax)} />
              <InfoRow label="Foreign Tax" value={formatLKR(breakdown.foreign_tax.tax)} />
              <div style={{ marginTop: 8 }}>
                <InfoRow label="Total Gross Tax" value={formatLKR(breakdown.gross_tax)} strong summary />
              </div>
            </SectionCard>

            {/* Section 5: Credits */}
            <SectionCard title="5. Tax Credits" accentColor="#722ed1">
              <Table
                dataSource={creditData}
                columns={creditColumns}
                pagination={false}
                size="small"
              />
            </SectionCard>

            {/* Section 6: Net Tax Payable */}
            <div
              style={{
                background: breakdown.net_tax_payable > 0 ? '#fff2f0' : '#f6ffed',
                border: `1px solid ${breakdown.net_tax_payable > 0 ? '#ffa39e' : '#b7eb8f'}`,
                borderRadius: 12,
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              <div style={{ height: 3, background: breakdown.net_tax_payable > 0 ? '#cf1322' : '#1a7a3a' }} />
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={labelStyle}>Net Tax Payable</div>
                <div
                  style={{
                    ...monoStyle,
                    fontSize: 36,
                    fontWeight: 700,
                    color: breakdown.net_tax_payable > 0 ? '#cf1322' : '#1a7a3a',
                    margin: '8px 0',
                  }}
                >
                  {formatLKR(breakdown.net_tax_payable)}
                </div>
                {breakdown.net_tax_payable <= 0 && (
                  <Tag color="success" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 12, border: 'none' }}>
                    REFUND DUE
                  </Tag>
                )}
                {breakdown.net_tax_payable > 0 && (
                  <Tag color="error" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 12, border: 'none' }}>
                    TAX PAYABLE
                  </Tag>
                )}
              </div>
            </div>

            {/* Section 7: Effective Rate */}
            <SectionCard title="7. Effective Tax Rate" accentColor="#f59e0b">
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ ...monoStyle, fontSize: 28, fontWeight: 700, color: '#1a7a3a' }}>
                  {formatPct(breakdown.effective_rate_pct)}
                </div>
                <div style={{ color: '#8c8c8c', marginTop: 4 }}>of gross income</div>
              </div>
            </SectionCard>
          </>
        )}
      </div>

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
      `}</style>
    </Spin>
  );
};

export default CalculationPage;
