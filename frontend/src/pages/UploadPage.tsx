import React, { useState } from 'react';
import { Upload, Button, Table, Alert, message, Space, Row, Col } from 'antd';
import { InboxOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadCsv } from '../api/client';
import { useFilingContext } from '../context/AuthContext';

const SAMPLE_CSV = `category,source_name,account_number,amount_lkr,amount_foreign,foreign_currency,exchange_rate,received_date,wht_deducted,paye_deducted,description
salary,ABC Company,,3600000,,,,,0,450000,Monthly salary
interest,Bank of Ceylon,1234567890,250000,,,,2025-03-15,25000,0,Savings interest
interest,NSB,9876543210,180000,,,,2025-06-30,18000,0,FD interest
foreign_employment,Overseas Corp,,1500000,5000,USD,300,2025-01-20,0,0,Consulting fees
other,Rental Income,,600000,,,,2025-04-01,0,0,Apartment rent`;

const errorColumns = [
  { title: 'Row', dataIndex: 'row', key: 'row', width: 80 },
  { title: 'Error', dataIndex: 'message', key: 'message' },
  { title: 'Data', dataIndex: 'data', key: 'data', ellipsis: true },
];

const sectionHeaderStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  color: '#1a1a2e',
};

const containerStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #f0f0f0',
  overflow: 'hidden',
};

const containerHeaderStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #f0f0f0',
};

const containerBodyStyle: React.CSSProperties = {
  padding: 20,
};

const UploadPage: React.FC = () => {
  const { currentFiling } = useFilingContext();
  const filingId = currentFiling!.id;
  const [uploading, setUploading] = useState<boolean>(false);
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select a CSV file first');
      return;
    }

    setUploading(true);
    try {
      const file = fileList[0].originFileObj || fileList[0];
      const res = await uploadCsv(filingId, file);
      setResult(res);
      message.success(`${res.created} entries imported`);
      setFileList([]);
    } catch (error: any) {
      message.error('Upload failed: ' + (error?.message || 'Unknown error'));
      setResult(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sample_income.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={14}>
          <div style={containerStyle}>
            <div style={containerHeaderStyle}>
              <div style={sectionHeaderStyle}>Upload Income Data</div>
            </div>
            <div style={containerBodyStyle}>
              <Upload.Dragger
                accept=".csv"
                maxCount={1}
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList([file]);
                  setResult(null);
                  return false;
                }}
                onRemove={() => {
                  setFileList([]);
                  setResult(null);
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Click or drag a CSV file to this area</p>
                <p className="ant-upload-hint">
                  Upload a CSV file with your income entries. Only .csv files are accepted.
                </p>
              </Upload.Dragger>

              <Space style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={fileList.length === 0}
                  style={{ borderRadius: 8 }}
                >
                  Upload & Import
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadSample}
                  style={{ borderRadius: 8 }}
                >
                  Download Sample CSV
                </Button>
              </Space>
            </div>
          </div>

          {result && (
            <div style={{ ...containerStyle, marginTop: 16 }}>
              <div style={containerBodyStyle}>
                <Alert
                  type={result.errors.length > 0 ? 'warning' : 'success'}
                  message={`${result.created} entries imported successfully`}
                  description={result.errors.length > 0 ? `${result.errors.length} rows had errors` : undefined}
                  showIcon
                  style={{
                    marginBottom: result.errors.length > 0 ? 16 : 0,
                    borderRadius: 8,
                  }}
                />
                {result.errors.length > 0 && (
                  <Table
                    dataSource={result.errors.map((e: any, i: number) => ({ ...e, key: i }))}
                    columns={errorColumns}
                    pagination={false}
                    size="small"
                    scroll={{ x: 500 }}
                  />
                )}
              </div>
            </div>
          )}
        </Col>

        <Col xs={24} md={10}>
          <div style={containerStyle}>
            <div style={containerHeaderStyle}>
              <div style={sectionHeaderStyle}>Expected CSV Format</div>
            </div>
            <div style={containerBodyStyle}>
              <p style={{ color: '#8c8c8c', marginBottom: 16 }}>
                Your CSV file should have the following columns:
              </p>
              <Table
                dataSource={[
                  { key: '1', column: 'category', required: 'Yes', description: 'salary, interest, foreign_employment, or other' },
                  { key: '2', column: 'source_name', required: 'No', description: 'Name of the income source' },
                  { key: '3', column: 'account_number', required: 'No', description: 'Bank account number' },
                  { key: '4', column: 'amount_lkr', required: 'Yes', description: 'Amount in LKR' },
                  { key: '5', column: 'amount_foreign', required: 'No', description: 'Foreign currency amount' },
                  { key: '6', column: 'foreign_currency', required: 'No', description: 'USD, GBP, EUR, etc.' },
                  { key: '7', column: 'exchange_rate', required: 'No', description: 'Exchange rate to LKR' },
                  { key: '8', column: 'received_date', required: 'No', description: 'YYYY-MM-DD format' },
                  { key: '9', column: 'wht_deducted', required: 'No', description: 'WHT amount deducted' },
                  { key: '10', column: 'paye_deducted', required: 'No', description: 'PAYE amount (salary only)' },
                  { key: '11', column: 'description', required: 'No', description: 'Free text description' },
                ]}
                columns={[
                  {
                    title: 'Column',
                    dataIndex: 'column',
                    key: 'column',
                    render: (v: string) => <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>,
                  },
                  { title: 'Required', dataIndex: 'required', key: 'required', width: 80 },
                  { title: 'Description', dataIndex: 'description', key: 'description' },
                ]}
                pagination={false}
                size="small"
              />
            </div>
          </div>
        </Col>
      </Row>

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
    </div>
  );
};

export default UploadPage;
