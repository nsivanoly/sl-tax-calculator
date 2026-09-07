import React, { useState, useEffect } from 'react';
import {
  Alert,
  InputNumber,
  Button,
  Select,
  Table,
  Typography,
  message,
  Spin,
  Popconfirm,
  Tag,
} from 'antd';
import {
  CopyOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  UndoOutlined,
  SettingOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { getTaxConfig, updateTaxConfig, updateSlabs, getFiscalYears, copyTaxConfig } from '../api/client';
import type { TaxConfig, TaxSlab, FiscalYearEntry } from '../types';

const TaxConfigPage: React.FC = () => {
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [localSlabs, setLocalSlabs] = useState<TaxSlab[]>([]);
  const [foreignSlabs, setForeignSlabs] = useState<TaxSlab[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearEntry[]>([]);
  const [selectedFY, setSelectedFY] = useState<string | undefined>(undefined);
  const [copyFromFY, setCopyFromFY] = useState<string | undefined>(undefined);
  const [copying, setCopying] = useState(false);

  const fetchConfig = async (fy?: string) => {
    setLoading(true);
    try {
      const data = await getTaxConfig(fy);
      setConfig(data);
      setLocalSlabs(data.local_slabs);
      setForeignSlabs(data.foreign_slabs);
      if (!selectedFY) setSelectedFY(data.fiscal_year);
    } catch (error) {
      message.error('Failed to load tax configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const fys = await getFiscalYears();
        setFiscalYears(fys);
      } catch {
        // ignore
      }
      fetchConfig();
    };
    init();
  }, []);

  const handleFYChange = (fy: string) => {
    setSelectedFY(fy);
    setCopyFromFY(undefined);
    fetchConfig(fy);
  };

  const handleCopyFrom = async () => {
    if (!copyFromFY || !selectedFY) return;
    setCopying(true);
    try {
      const updated = await copyTaxConfig(selectedFY, copyFromFY);
      setConfig(updated);
      setLocalSlabs(updated.local_slabs);
      setForeignSlabs(updated.foreign_slabs);
      setCopyFromFY(undefined);
      message.success(`Copied config from FY ${copyFromFY} to FY ${selectedFY}`);
    } catch {
      message.error('Failed to copy config');
    } finally {
      setCopying(false);
    }
  };

  const handleSaveSlabs = async () => {
    if (localSlabs.length === 0) {
      message.error('At least one local tax slab is required');
      return;
    }
    const allSlabs = [...localSlabs, ...foreignSlabs];
    for (const slab of allSlabs) {
      if (slab.rate < 0 || slab.rate > 1) {
        message.error('Slab rates must be between 0% and 100%');
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await updateSlabs(localSlabs, foreignSlabs, selectedFY);
      setLocalSlabs(updated.local_slabs);
      setForeignSlabs(updated.foreign_slabs);
      if (config) {
        setConfig({ ...config, local_slabs: updated.local_slabs, foreign_slabs: updated.foreign_slabs });
      }
      message.success('Tax slabs saved successfully');
    } catch (error) {
      message.error('Failed to save tax slabs');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlab = (type: 'local' | 'foreign') => {
    const slabs = type === 'local' ? localSlabs : foreignSlabs;
    const setSlabs = type === 'local' ? setLocalSlabs : setForeignSlabs;
    const lastSlab = slabs[slabs.length - 1];
    const newSlab: TaxSlab = {
      slab_order: slabs.length + 1,
      lower_bound: lastSlab ? lastSlab.upper_bound ?? 0 : 0,
      upper_bound: null,
      rate: 0,
      label: 'New Slab',
      slab_type: type,
    };
    setSlabs([...slabs, newSlab]);
  };

  const handleRemoveSlab = (type: 'local' | 'foreign', index: number) => {
    const slabs = type === 'local' ? localSlabs : foreignSlabs;
    const setSlabs = type === 'local' ? setLocalSlabs : setForeignSlabs;
    const updated = slabs
      .filter((_, i) => i !== index)
      .map((slab, i) => ({ ...slab, slab_order: i + 1 }));
    setSlabs(updated);
  };

  const handleSlabChange = (type: 'local' | 'foreign', index: number, field: keyof TaxSlab, value: any) => {
    const slabs = type === 'local' ? localSlabs : foreignSlabs;
    const setSlabs = type === 'local' ? setLocalSlabs : setForeignSlabs;
    const updated = [...slabs];
    updated[index] = { ...updated[index], [field]: value };
    setSlabs(updated);
  };

  const handleResetDefaults = () => {
    fetchConfig(selectedFY);
  };

  const makeSlabColumns = (type: 'local' | 'foreign') => [
    {
      title: 'Order',
      dataIndex: 'slab_order',
      key: 'slab_order',
      width: 70,
      render: (_: any, __: any, index: number) => (
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>{index + 1}</span>
      ),
    },
    {
      title: 'Lower Bound (LKR)',
      dataIndex: 'lower_bound',
      key: 'lower_bound',
      render: (value: number, _: TaxSlab, index: number) => (
        <InputNumber<number>
          value={value}
          min={0}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => Number(v!.replace(/,/g, ''))}
          onChange={(v) => handleSlabChange(type, index, 'lower_bound', v ?? 0)}
          style={{ width: '100%', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace" }}
        />
      ),
    },
    {
      title: 'Upper Bound (LKR)',
      dataIndex: 'upper_bound',
      key: 'upper_bound',
      render: (value: number | null, _: TaxSlab, index: number) => (
        <InputNumber<number>
          value={value}
          min={0}
          placeholder="No limit"
          formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
          parser={(v) => (v ? Number(v.replace(/,/g, '')) : (null as any))}
          onChange={(v) => handleSlabChange(type, index, 'upper_bound', v)}
          style={{ width: '100%', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace" }}
        />
      ),
    },
    {
      title: 'Rate (%)',
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (value: number, _: TaxSlab, index: number) => (
        <InputNumber<number>
          value={value * 100}
          min={0}
          max={100}
          step={1}
          formatter={(v) => `${v}%`}
          parser={(v) => Number(v!.replace('%', '')) / 100}
          onChange={(v) => handleSlabChange(type, index, 'rate', (v ?? 0) / 100)}
          style={{ width: '100%', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
        />
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (value: string, _: TaxSlab, index: number) => (
        <input
          value={value}
          onChange={(e) => handleSlabChange(type, index, 'label', e.target.value)}
          style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '4px 8px', width: '100%', fontSize: 13 }}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      align: 'right' as const,
      render: (_: any, __: TaxSlab, index: number) => (
        <Popconfirm title="Remove this slab?" onConfirm={() => handleRemoveSlab(type, index)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 14 }} />} />
        </Popconfirm>
      ),
    },
  ];

  const otherFYs = fiscalYears.filter((fy) => fy.year_code !== selectedFY);

  return (
    <div>
      {/* ====== PAGE HEADER ====== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#e6f7ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SettingOutlined style={{ color: '#1a7a3a', fontSize: 17 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1a1a2e', lineHeight: '22px' }}>
              Tax Configuration
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Configure tax parameters for the fiscal year. Changes affect all calculations.
            </Typography.Text>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 10,
            padding: '8px 14px',
          }}
        >
          <CalendarOutlined style={{ color: '#1a7a3a', fontSize: 14 }} />
          <span style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
            Fiscal Year
          </span>
          <Select
            value={selectedFY}
            onChange={handleFYChange}
            style={{ width: 140 }}
            placeholder="Select FY"
            variant="borderless"
            options={fiscalYears.map((fy) => ({ value: fy.year_code, label: `FY ${fy.year_code}` }))}
          />
        </div>
      </div>

      <Spin spinning={loading}>
        {config && (
          <div>
            {/* Copy from another FY */}
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #f0f0f0',
                padding: '14px 20px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Copy from another FY:
              </Typography.Text>
              <Select
                value={copyFromFY}
                onChange={setCopyFromFY}
                style={{ width: 160 }}
                placeholder="Source FY..."
                allowClear
                options={otherFYs.map((fy) => ({ value: fy.year_code, label: `FY ${fy.year_code}` }))}
              />
              <Popconfirm
                title={`Copy all settings from FY ${copyFromFY} to FY ${selectedFY}?`}
                onConfirm={handleCopyFrom}
                disabled={!copyFromFY}
              >
                <Button
                  icon={<CopyOutlined />}
                  loading={copying}
                  disabled={!copyFromFY}
                  style={{ borderRadius: 8 }}
                >
                  Copy
                </Button>
              </Popconfirm>
              <Popconfirm title="Reset to server defaults?" onConfirm={handleResetDefaults}>
                <Button icon={<UndoOutlined />} size="small" style={{ borderRadius: 8, marginLeft: 'auto' }}>
                  Reset
                </Button>
              </Popconfirm>
            </div>

            {config.has_foreign_tax === false && (
              <Alert
                message="Single Tax Regime"
                description="This fiscal year uses a single set of progressive slabs for all income (including foreign currency income). Foreign income slabs are empty — add slabs if you want to enable separate foreign taxation."
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 12 }}
              />
            )}

            {/* Tax Parameters */}
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #f0f0f0',
                padding: '18px 20px',
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', marginBottom: 16 }}>
                Tax Parameters
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Tax-Free Threshold (LKR)
                  </div>
                  <InputNumber<number>
                    value={config.tax_free_threshold}
                    min={0}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => Number(v!.replace(/,/g, ''))}
                    onChange={async (v) => {
                      if (v == null) return;
                      const updated = await updateTaxConfig({ fiscal_year: config.fiscal_year, tax_free_threshold: v });
                      setConfig(updated);
                      message.success('Tax-free threshold updated');
                    }}
                    style={{ width: '100%', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Interest Exemption Limit (LKR)
                  </div>
                  <InputNumber<number>
                    value={config.interest_exemption_limit}
                    min={0}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => Number(v!.replace(/,/g, ''))}
                    onChange={async (v) => {
                      if (v == null) return;
                      const updated = await updateTaxConfig({ fiscal_year: config.fiscal_year, interest_exemption_limit: v });
                      setConfig(updated);
                      message.success('Interest exemption limit updated');
                    }}
                    style={{ width: '100%', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    WHT Rate on Interest (%)
                  </div>
                  <InputNumber<number>
                    value={config.wht_rate_resident * 100}
                    min={0}
                    max={100}
                    step={1}
                    formatter={(v) => `${v}%`}
                    parser={(v) => Number(v!.replace('%', ''))}
                    onChange={async (v) => {
                      if (v == null) return;
                      const updated = await updateTaxConfig({ fiscal_year: config.fiscal_year, wht_rate_resident: v / 100 });
                      setConfig(updated);
                      message.success('WHT rate updated');
                    }}
                    style={{ width: '100%', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>

            {/* Local / Income Slabs */}
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #f0f0f0',
                overflow: 'hidden',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>
                    {config.has_foreign_tax === false ? 'Income Tax Slabs' : 'Local Income Slabs'}
                  </span>
                  <Tag style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>{localSlabs.length}</Tag>
                </div>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleAddSlab('local')}
                  style={{ borderRadius: 8 }}
                >
                  Add Slab
                </Button>
              </div>
              <Table
                dataSource={localSlabs.map((s, i) => ({ ...s, key: i }))}
                columns={makeSlabColumns('local')}
                pagination={false}
                size="small"
                scroll={{ x: 600 }}
              />
            </div>

            {config.has_foreign_tax && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid #f0f0f0',
                  overflow: 'hidden',
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>Foreign Income Slabs</span>
                    <Tag style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>{foreignSlabs.length}</Tag>
                  </div>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleAddSlab('foreign')}
                    style={{ borderRadius: 8 }}
                  >
                    Add Slab
                  </Button>
                </div>
                {foreignSlabs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#bfbfbf' }}>
                    <Typography.Text type="secondary">
                      No foreign income slabs configured. Click "Add Slab" to add foreign tax brackets.
                    </Typography.Text>
                  </div>
                ) : (
                  <Table
                    dataSource={foreignSlabs.map((s, i) => ({ ...s, key: i }))}
                    columns={makeSlabColumns('foreign')}
                    pagination={false}
                    size="small"
                    scroll={{ x: 600 }}
                  />
                )}
              </div>
            )}

            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSlabs}
              loading={saving}
              block
              style={{ borderRadius: 8, fontWeight: 500, height: 40 }}
            >
              Save All Slabs
            </Button>
          </div>
        )}
      </Spin>

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

export default TaxConfigPage;
