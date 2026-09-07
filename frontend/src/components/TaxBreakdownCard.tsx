import React from 'react';
import { Card, Descriptions, Table, Divider, Typography, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TaxBreakdown, SlabDetail } from '../types';

const { Title, Text } = Typography;

interface TaxBreakdownCardProps {
  breakdown: TaxBreakdown;
  title?: string;
}

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const slabColumns: ColumnsType<SlabDetail> = [
  {
    title: 'Slab',
    dataIndex: 'label',
    key: 'label',
  },
  {
    title: 'Taxable Amount',
    dataIndex: 'taxable_in_slab',
    key: 'taxable_in_slab',
    align: 'right',
    render: (value: number) => formatLKR(value),
  },
  {
    title: 'Rate',
    dataIndex: 'rate',
    key: 'rate',
    align: 'right',
    render: (value: number) => `${(value * 100).toFixed(0)}%`,
  },
  {
    title: 'Tax',
    dataIndex: 'tax',
    key: 'tax',
    align: 'right',
    render: (value: number) => formatLKR(value),
  },
];

const TaxBreakdownCard: React.FC<TaxBreakdownCardProps> = ({ breakdown, title }) => {
  const { gross_income, exemptions, credits, domestic_tax, foreign_tax, net_tax_payable } = breakdown;
  const hasForeign = gross_income.foreign_employment > 0;

  const netColor = net_tax_payable > 0 ? '#cf1322' : '#3f8600';

  return (
    <Card title={title} bordered>
      <Descriptions title="Gross Income" bordered column={2} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Salary">{formatLKR(gross_income.salary)}</Descriptions.Item>
        <Descriptions.Item label="Interest">{formatLKR(gross_income.interest)}</Descriptions.Item>
        {hasForeign && (
          <Descriptions.Item label="Foreign Currency Income">
            {formatLKR(gross_income.foreign_employment)}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Other">{formatLKR(gross_income.other)}</Descriptions.Item>
        <Descriptions.Item label="Total" span={2}>
          <Text strong>{formatLKR(gross_income.total)}</Text>
        </Descriptions.Item>
      </Descriptions>

      {exemptions.interest_exempt_amount > 0 && (
        <Descriptions title="Exemptions" bordered column={2} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="Interest Exempt Amount" span={2}>
            {formatLKR(exemptions.interest_exempt_amount)}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Descriptions
        title="Relief"
        bordered
        column={2}
        size="small"
        style={{ marginBottom: 24 }}
      >
        {hasForeign && (
          <Descriptions.Item label="Relief Applied To">
            <Tag color={breakdown.relief_applied_to === 'local' ? 'green' : 'blue'}>
              {breakdown.relief_applied_to === 'local' ? 'Local Income' : 'Foreign Income'}
            </Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Tax-Free Allowance">
          {formatLKR(breakdown.tax_free_allowance)}
        </Descriptions.Item>
      </Descriptions>

      <Title level={5}>
        Domestic Tax{' '}
        {breakdown.relief_applied_to === 'local'
          ? <Tag color="green">Progressive Slabs (with 1.8M Relief)</Tag>
          : <Tag color="red">Flat 36%</Tag>
        }
      </Title>
      <Descriptions bordered column={1} size="small" style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Salary">{formatLKR(gross_income.salary)}</Descriptions.Item>
        <Descriptions.Item label="Interest">{formatLKR(gross_income.interest)}</Descriptions.Item>
        {exemptions.interest_exempt_amount > 0 && (
          <Descriptions.Item label="Less: Interest Exemption">
            <Text type="danger">− {formatLKR(exemptions.interest_exempt_amount)}</Text>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Other">{formatLKR(gross_income.other)}</Descriptions.Item>
        <Descriptions.Item label="Total Domestic Income">
          <Text strong>{formatLKR(domestic_tax.domestic_income)}</Text>
        </Descriptions.Item>
      </Descriptions>
      <Table<SlabDetail>
        dataSource={domestic_tax.slab_breakdown}
        columns={slabColumns}
        rowKey="label"
        pagination={false}
        size="small"
        style={{ marginBottom: 24 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <Text strong>Domestic Tax</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Text strong>{formatLKR(domestic_tax.domestic_income)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              —
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Text strong>{formatLKR(domestic_tax.tax)}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      {hasForeign && (
        <>
          <Title level={5}>
            Foreign Tax{' '}
            {breakdown.relief_applied_to === 'foreign'
              ? <Tag color="green">Foreign Brackets (with 1.8M Relief)</Tag>
              : <Tag color="red">Flat 15%</Tag>
            }
          </Title>
          <Descriptions bordered column={1} size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Foreign Income">
              <Text strong>{formatLKR(foreign_tax.foreign_income)}</Text>
            </Descriptions.Item>
          </Descriptions>
          <Table<SlabDetail>
            dataSource={foreign_tax.slab_breakdown}
            columns={slabColumns}
            rowKey="label"
            pagination={false}
            size="small"
            style={{ marginBottom: 24 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong>Foreign Tax</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong>{formatLKR(foreign_tax.foreign_income)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  —
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text strong>{formatLKR(foreign_tax.tax)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </>
      )}

      <Descriptions title="Tax Summary" bordered column={2} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Domestic Tax">
          {formatLKR(domestic_tax.tax)}
        </Descriptions.Item>
        {hasForeign && (
          <Descriptions.Item label="Foreign Tax">
            {formatLKR(foreign_tax.tax)}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Gross Tax" span={2}>
          <Text strong>{formatLKR(breakdown.gross_tax)}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title="Credits" bordered column={2} size="small">
        <Descriptions.Item label="WHT on Interest">
          {formatLKR(credits.wht_on_interest)}
        </Descriptions.Item>
        {credits.paye_deducted > 0 && (
          <Descriptions.Item label="PAYE Deducted">{formatLKR(credits.paye_deducted)}</Descriptions.Item>
        )}
        {credits.adjustments.map((adj, i) => (
          <Descriptions.Item key={i} label={adj.label}>
            {formatLKR(adj.adjustment_type === 'other_deduction' ? -adj.amount : adj.amount)}
          </Descriptions.Item>
        ))}
        <Descriptions.Item label="Total Credits">
          <Text strong>{formatLKR(credits.total_credits)}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Title level={3} style={{ color: netColor, marginBottom: 4 }}>
        Net Tax Payable: {formatLKR(net_tax_payable)}
      </Title>
      <Text>Effective Rate: {breakdown.effective_rate_pct.toFixed(2)}%</Text>
    </Card>
  );
};

export default TaxBreakdownCard;
