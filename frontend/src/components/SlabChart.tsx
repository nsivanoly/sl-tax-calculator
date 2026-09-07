import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SlabDetail } from '../types';

interface SlabChartProps {
  slabBreakdown: SlabDetail[];
}

const formatLKR = (v: number) => 'LKR ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const formatAxisValue = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `LKR ${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const thousands = value / 1_000;
    return `LKR ${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return `LKR ${value}`;
};

const SlabChart: React.FC<SlabChartProps> = ({ slabBreakdown }) => {
  const data = slabBreakdown.map((s) => ({
    name: s.label,
    taxable: s.taxable_in_slab,
    tax: s.tax,
    rate: s.rate,
  }));

  const height = Math.max(300, data.length * 60);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={formatAxisValue} />
        <YAxis dataKey="name" type="category" width={150} />
        <Tooltip formatter={(value: number | string) => formatLKR(Number(value))} />
        <Legend />
        <Bar dataKey="taxable" name="Taxable Amount" fill="#52c41a" />
        <Bar dataKey="tax" name="Tax" fill="#ff7a45" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SlabChart;
