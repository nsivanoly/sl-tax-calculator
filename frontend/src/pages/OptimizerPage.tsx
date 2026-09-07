import React, { useState, useEffect } from 'react';
import { Button, Typography, Spin, Row, Col, message, Tag } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  optimizeTax,
  compareTax,
} from '../api/client';
import type { TaxBreakdown, OptimizationResult } from '../types';
import { useFilingContext } from '../context/AuthContext';
import TaxBreakdownCard from '../components/TaxBreakdownCard';

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

const MetricRow: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; big?: boolean; color?: string }> = ({
  label,
  value,
  strong,
  big,
  color,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 0',
      borderBottom: '1px solid #f0f0f0',
    }}
  >
    <span style={{ color: '#595959', fontSize: big ? 13 : 14 }}>{label}</span>
    <span
      style={{
        ...monoStyle,
        fontWeight: strong ? 700 : 500,
        fontSize: big ? 20 : 14,
        color: color ?? (strong ? '#1a1a2e' : '#1a1a2e'),
      }}
    >
      {value}
    </span>
  </div>
);

const OptimizerPage: React.FC = () => {
  const { currentFiling } = useFilingContext();
  const filingId = currentFiling!.id;
  const [loading, setLoading] = useState<boolean>(false);
  const [localResult, setLocalResult] = useState<TaxBreakdown | null>(null);
  const [foreignResult, setForeignResult] = useState<TaxBreakdown | null>(null);
  const [recommendedReliefOn, setRecommendedReliefOn] = useState<string | null>(null);
  const [savings, setSavings] = useState<number>(0);

  const handleCompare = async () => {
    setLoading(true);
    try {
      const result = await compareTax(filingId);
      setLocalResult(result.local);
      setForeignResult(result.foreign);

      // Determine best option
      if (result.local.net_tax_payable <= result.foreign.net_tax_payable) {
        setRecommendedReliefOn('local');
        setSavings(result.foreign.net_tax_payable - result.local.net_tax_payable);
      } else {
        setRecommendedReliefOn('foreign');
        setSavings(result.local.net_tax_payable - result.foreign.net_tax_payable);
      }
    } catch (error) {
      message.error('Failed to compare tax');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoOptimize = async () => {
    setLoading(true);
    try {
      const result: OptimizationResult = await optimizeTax(filingId);
      setRecommendedReliefOn(result.recommended_relief_on);
      setSavings(result.tax_savings);

      // Set the results from optimizer
      if (result.recommended_relief_on === 'local') {
        setLocalResult(result.optimized);
        setForeignResult(result.baseline);
      } else {
        setForeignResult(result.optimized);
        setLocalResult(result.baseline);
      }
    } catch (error) {
      message.error('Failed to run optimizer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCompare();
  }, []);

  const bestResult = recommendedReliefOn === 'local' ? localResult : foreignResult;
  const hasForeign = (localResult?.gross_income.foreign_employment ?? 0) > 0;

  const renderComparisonCard = (
    result: TaxBreakdown,
    icon: string,
    title: string,
    isBest: boolean
  ) => (
    <div
      style={{
        background: isBest ? '#f6ffed' : '#fff',
        border: isBest ? '2px solid #1a7a3a' : '1px solid #f0f0f0',
        borderRadius: 12,
        position: 'relative',
        height: '100%',
        marginTop: isBest ? 14 : 0,
      }}
    >
      {isBest && (
        <Tag
          color="green"
          style={{
            position: 'absolute',
            top: -12,
            right: 16,
            borderRadius: 12,
            border: '2px solid #1a7a3a',
            fontSize: 12,
            padding: '2px 12px',
            background: '#f6ffed',
            zIndex: 1,
          }}
        >
          <CheckCircleOutlined /> BEST OPTION
        </Tag>
      )}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>{title}</span>
      </div>
      <div style={{ padding: '8px 20px 20px' }}>
        <MetricRow label="Domestic Income" value={formatLKR(result.domestic_tax.domestic_income)} />
        <MetricRow label="Domestic Tax" value={formatLKR(result.domestic_tax.tax)} />
        <div style={{ padding: '9px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#595959' }}>Domestic Method</span>
          <Tag
            color={result.relief_applied_to === 'local' ? 'green' : 'red'}
            style={{ borderRadius: 12, border: 'none', margin: 0 }}
          >
            {result.relief_applied_to === 'local' ? `Progressive Slabs (${(result.tax_free_allowance / 1000000).toFixed(1)}M Relief)` : `Flat ${((result.domestic_tax.slab_breakdown[result.domestic_tax.slab_breakdown.length - 1]?.rate ?? 0) * 100).toFixed(0)}%`}
          </Tag>
        </div>
        {hasForeign && (
          <>
            <MetricRow label="Foreign Income" value={formatLKR(result.foreign_tax.foreign_income)} />
            <MetricRow label="Foreign Tax" value={formatLKR(result.foreign_tax.tax)} />
            <div style={{ padding: '9px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#595959' }}>Foreign Method</span>
              <Tag
                color={result.relief_applied_to === 'foreign' ? 'green' : 'red'}
                style={{ borderRadius: 12, border: 'none', margin: 0 }}
              >
                {result.relief_applied_to === 'foreign' ? `Foreign Brackets (${(result.tax_free_allowance / 1000000).toFixed(1)}M Relief)` : `Flat ${((result.foreign_tax.slab_breakdown[result.foreign_tax.slab_breakdown.length - 1]?.rate ?? 0) * 100).toFixed(0)}%`}
              </Tag>
            </div>
          </>
        )}
        <MetricRow label="Gross Tax" value={formatLKR(result.gross_tax)} />
        <MetricRow label="Total Credits" value={formatLKR(result.credits.total_credits)} color="#1890ff" />
        <div style={{ marginTop: 8, padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
          <MetricRow
            label="Net Payable"
            value={formatLKR(result.net_tax_payable)}
            strong
            big
            color={isBest ? '#1a7a3a' : '#1a1a2e'}
          />
        </div>
        <MetricRow label="Effective Rate" value={`${result.effective_rate_pct.toFixed(2)}%`} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Typography.Title level={3} style={{ margin: 0, fontSize: 20, color: '#1a1a2e' }}>
          Tax Optimizer
        </Typography.Title>
        <Typography.Paragraph style={{ color: '#8c8c8c', marginTop: 4, marginBottom: 0 }}>
          {hasForeign
            ? 'Compare applying the tax-free relief to local income vs foreign income. The optimizer picks the option that minimizes your net tax payable.'
            : 'Optimize your tax calculation. The optimizer finds the best exemption strategy to minimize your net tax payable.'}
        </Typography.Paragraph>
      </div>

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={handleAutoOptimize}
              loading={loading}
              style={{ borderRadius: 8 }}
            >
              Run Optimizer
            </Button>
          </Col>
          <Col>
            <Button size="large" onClick={handleCompare} loading={loading} style={{ borderRadius: 8 }}>
              Compare Both Options
            </Button>
          </Col>
        </Row>

        {/* Savings Banner — only when there IS foreign income to compare */}
        {savings > 0 && recommendedReliefOn && hasForeign && (
          <div
            style={{
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <CheckCircleOutlined style={{ color: '#1a7a3a', fontSize: 20, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e' }}>
                You save <span style={monoStyle}>{formatLKR(savings)}</span> by applying relief to{' '}
                {recommendedReliefOn === 'local' ? 'Local' : 'Foreign'} Income
              </div>
              <div style={{ color: '#595959', marginTop: 4 }}>
                Applying the tax-free relief to{' '}
                <Tag color="green" style={{ borderRadius: 12, border: 'none' }}>
                  {recommendedReliefOn === 'local' ? 'Local Income (Progressive Slabs)' : 'Foreign Income (Foreign Brackets)'}
                </Tag>{' '}
                gives you the lowest net tax payable.
              </div>
            </div>
          </div>
        )}

        {/* Two-column comparison — only when there IS foreign income */}
        {hasForeign ? (
          <Row gutter={[24, 24]}>
            {localResult && (
              <Col xs={24} md={12}>
                {renderComparisonCard(
                  localResult,
                  '🏠',
                  'Relief on Local Income',
                  recommendedReliefOn === 'local'
                )}
              </Col>
            )}

            {foreignResult && (
              <Col xs={24} md={12}>
                {renderComparisonCard(
                  foreignResult,
                  '🌍',
                  'Relief on Foreign Income',
                  recommendedReliefOn === 'foreign'
                )}
              </Col>
            )}
          </Row>
        ) : localResult && (
          <Row gutter={[24, 24]}>
            <Col xs={24} md={16}>
              {renderComparisonCard(
                localResult,
                '🏠',
                'Tax Breakdown (Local Income Only)',
                true
              )}
            </Col>
          </Row>
        )}

        {/* Detailed Best Breakdown */}
        {bestResult && (
          <div style={{ marginTop: 32 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ flex: 1, borderTop: '1px solid #f0f0f0' }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Detailed Breakdown — Best Option
              </span>
              <div style={{ flex: 1, borderTop: '1px solid #f0f0f0' }} />
            </div>
            <TaxBreakdownCard
              breakdown={bestResult}
              title={hasForeign ? `Recommended: Relief on ${recommendedReliefOn === 'local' ? 'Local' : 'Foreign'} Income` : 'Optimized Tax Breakdown'}
            />
          </div>
        )}
      </Spin>
    </div>
  );
};

export default OptimizerPage;
