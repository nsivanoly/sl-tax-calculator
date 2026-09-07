import React, { useEffect } from 'react';
import { Modal, Form, Select, Input, InputNumber, DatePicker, Alert } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import type { IncomeCreate } from '../types';

const { TextArea } = Input;

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US').format(Math.round(v));

interface IncomeFormProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: IncomeCreate) => Promise<void>;
  initialValues?: Partial<IncomeCreate>;
  loading?: boolean;
  whtRate?: number; // e.g. 0.10 for 10%
}

const CATEGORY_OPTIONS = [
  { value: 'salary', label: 'Salary' },
  { value: 'interest', label: 'Interest' },
  { value: 'foreign_employment', label: 'Foreign Currency Income' },
  { value: 'other', label: 'Other' },
];

const CURRENCY_OPTIONS = ['USD', 'GBP', 'EUR', 'AUD', 'CAD', 'SGD'].map((c) => ({
  value: c,
  label: c,
}));

interface IncomeFormValues {
  category: IncomeCreate['category'];
  source_name?: string | null;
  account_number?: string | null;
  amount_lkr: number;
  amount_foreign?: number | null;
  foreign_currency?: string | null;
  exchange_rate?: number | null;
  received_date?: Dayjs | null;
  wht_deducted?: number | null;
  paye_deducted?: number | null;
  description?: string | null;
}

const IncomeForm: React.FC<IncomeFormProps> = ({
  open,
  onCancel,
  onSubmit,
  initialValues,
  loading,
  whtRate = 0,
}) => {
  const [form] = Form.useForm<IncomeFormValues>();
  const category = Form.useWatch('category', form);
  const amountLkr = Form.useWatch('amount_lkr', form);
  const whtDeducted = Form.useWatch('wht_deducted', form);

  const isEdit = !!initialValues && Object.keys(initialValues).length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    if (initialValues && Object.keys(initialValues).length > 0) {
      form.setFieldsValue({
        ...initialValues,
        received_date: initialValues.received_date ? dayjs(initialValues.received_date) : null,
      });
    } else {
      form.resetFields();
    }
  }, [open, initialValues, form]);

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const handleOk = () => {
    form.validateFields().then((values) => {
      const isForeign = values.category === 'foreign_employment';
      const isSalary = values.category === 'salary';

      const payload: IncomeCreate = {
        category: values.category,
        source_name: values.source_name ?? null,
        account_number: values.account_number ?? null,
        amount_lkr: values.amount_lkr,
        amount_foreign: isForeign ? values.amount_foreign ?? null : null,
        foreign_currency: isForeign ? values.foreign_currency ?? null : null,
        exchange_rate: isForeign ? values.exchange_rate ?? null : null,
        received_date: values.received_date ? values.received_date.format('YYYY-MM-DD') : null,
        wht_deducted: isSalary ? 0 : values.wht_deducted ?? 0,
        paye_deducted: isSalary ? values.paye_deducted ?? 0 : 0,
        description: values.description ?? null,
      };

      onSubmit(payload).then(() => {
        form.resetFields();
      });
    });
  };

  return (
    <Modal
      title={isEdit ? 'Edit Income' : 'Add Income'}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
      okText={isEdit ? 'Save' : 'Add'}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ wht_deducted: 0, paye_deducted: 0 }}
      >
        <Form.Item
          name="category"
          label="Category"
          rules={[{ required: true, message: 'Please select a category' }]}
        >
          <Select options={CATEGORY_OPTIONS} placeholder="Select category" />
        </Form.Item>

        <Form.Item name="source_name" label="Source Name">
          <Input placeholder="e.g. ABC Company" />
        </Form.Item>

        <Form.Item name="account_number" label="Account Number">
          <Input placeholder="e.g. bank account / employee no." />
        </Form.Item>

        <Form.Item
          name="amount_lkr"
          label="Amount (LKR)"
          rules={[{ required: true, message: 'Please enter the amount in LKR' }]}
        >
          <InputNumber<number>
            style={{ width: '100%' }}
            min={0}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0)}
          />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
          {() =>
            category === 'foreign_employment' ? (
              <>
                <Form.Item name="amount_foreign" label="Amount (Foreign Currency)">
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
                <Form.Item name="foreign_currency" label="Currency">
                  <Select options={CURRENCY_OPTIONS} placeholder="Select currency" allowClear />
                </Form.Item>
                <Form.Item name="exchange_rate" label="Exchange Rate">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>

        <Form.Item name="received_date" label="Received Date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        {/* WHT — shown for interest, foreign, other but NOT salary */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
          {() =>
            category !== 'salary' ? (
              <Form.Item name="wht_deducted" label="WHT Deducted">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        {/* WHT validation hint for interest entries */}
        {category === 'interest' && whtRate > 0 && amountLkr > 0 && (() => {
          const expected = amountLkr * whtRate;
          const actual = whtDeducted ?? 0;
          const diff = Math.abs(actual - expected);
          if (diff <= 1) return null;
          const ratePct = (whtRate * 100).toFixed(0);
          if (actual < expected) {
            return (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16, borderRadius: 8 }}
                message={`WHT appears under-deducted: ${formatLKR(actual)} vs expected ${formatLKR(expected)} (${ratePct}%)`}
              />
            );
          }
          return (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 8 }}
              message={`WHT appears over-deducted: ${formatLKR(actual)} vs expected ${formatLKR(expected)} (${ratePct}%). Excess will be credited.`}
            />
          );
        })()}

        {/* PAYE — shown only for salary */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
          {() =>
            category === 'salary' ? (
              <Form.Item name="paye_deducted" label="PAYE Deducted">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea maxLength={200} showCount rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default IncomeForm;
