import React, { useMemo } from 'react';
import { CalendarOutlined } from '@ant-design/icons';

interface TaxDate {
  label: string;
  date: Date;
  daysLeft: number;
  dateStr: string;
  isPast: boolean;
  isUrgent: boolean;
  isSoon: boolean;
}

export function useTaxDates(fiscalYear: string): { taxDates: TaxDate[]; nextDeadline: TaxDate } {
  const taxDates = useMemo(() => {
    const parts = fiscalYear.split('/');
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
  }, [fiscalYear]);

  const nextDeadline = useMemo(
    () => taxDates.find((d) => !d.isPast) || taxDates[taxDates.length - 1],
    [taxDates]
  );

  return { taxDates, nextDeadline };
}

const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
};

/** Quarterly payment amounts keyed by quarter label (Q1–Q4) */
export interface QuarterPayments {
  Q1?: number | null;
  Q2?: number | null;
  Q3?: number | null;
  Q4?: number | null;
}

interface TaxCalendarBarProps {
  fiscalYear: string;
  /** Optional: quarterly self-assessment payment amounts */
  quarterPayments?: QuarterPayments;
  /** Optional: filing status — used to mark Payment/Filing as done */
  filingStatus?: string;
}

const PAID_STATUSES = new Set(['paid', 'filed', 'assessed']);
const FILED_STATUSES = new Set(['filed', 'assessed']);

const TaxCalendarBar: React.FC<TaxCalendarBarProps> = ({ fiscalYear, quarterPayments, filingStatus }) => {
  const { taxDates, nextDeadline } = useTaxDates(fiscalYear);

  // Whether we have filing-level data to show status
  const hasFilingData = quarterPayments !== undefined;

  // Resolve payment status for each pill
  // overdue = date past but not paid/done AND filing not yet settled
  const filingSettled = PAID_STATUSES.has(filingStatus || '');  // paid/filed/assessed
  const filingFiled = FILED_STATUSES.has(filingStatus || '');   // filed/assessed

  const getPaymentInfo = (label: string, isPast: boolean): { paid: boolean; amount: number | null; na: boolean; overdue: boolean } => {
    if (!hasFilingData) return { paid: false, amount: null, na: false, overdue: false };

    if (['Q1', 'Q2', 'Q3', 'Q4'].includes(label)) {
      const amt = quarterPayments?.[label as keyof QuarterPayments] ?? null;
      if (amt != null && amt > 0) return { paid: true, amount: amt, na: false, overdue: false };
      // If filing is settled (paid/filed/assessed), skipped quarters are just NA, not overdue
      return { paid: false, amount: null, na: true, overdue: isPast && !filingSettled };
    }
    if (label === 'Payment') {
      if (filingSettled) return { paid: true, amount: null, na: false, overdue: false };
      // Future: show countdown; Past: show overdue
      return { paid: false, amount: null, na: false, overdue: isPast };
    }
    if (label === 'Filing') {
      if (filingFiled) return { paid: true, amount: null, na: false, overdue: false };
      return { paid: false, amount: null, na: false, overdue: isPast };
    }
    return { paid: false, amount: null, na: false, overdue: false };
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <CalendarOutlined style={{ fontSize: 12, color: '#8c8c8c', marginRight: 3 }} />
      {taxDates.map((d, i) => {
        const payment = getPaymentInfo(d.label, d.isPast);

        // Override colors when we have filing-level data
        let color: string;
        let bg: string;
        let borderColor: string;

        if (hasFilingData && payment.paid) {
          // Paid — solid green
          color = '#389e0d';
          bg = '#f6ffed';
          borderColor = '#b7eb8f';
        } else if (hasFilingData && payment.overdue) {
          // Past due and not done — red
          color = '#cf1322';
          bg = '#fff2f0';
          borderColor = '#ffccc7';
        } else if (hasFilingData && payment.na) {
          // Not paid, future — muted grey
          color = '#bfbfbf';
          bg = '#fafafa';
          borderColor = '#e8e8e8';
        } else {
          // Date-based coloring (default / homepage)
          color = d.isPast ? '#8c8c8c' : d.isUrgent ? '#cf1322' : d.isSoon ? '#d48806' : '#389e0d';
          bg = d.isPast ? '#f5f5f5' : d.isUrgent ? '#fff2f0' : d.isSoon ? '#fffbe6' : '#f6ffed';
          borderColor = d.isPast ? '#e8e8e8' : d.isUrgent ? '#ffccc7' : d.isSoon ? '#ffe58f' : '#b7eb8f';
        }

        const isNext = d === nextDeadline && !d.isPast;

        return (
          <React.Fragment key={d.label}>
            {i > 0 && (
              <div
                style={{
                  width: 10,
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
                gap: 1,
                padding: '3px 6px',
                borderRadius: 7,
                background: bg,
                border: isNext && !payment.paid ? `1.5px solid ${borderColor}` : `1px solid ${borderColor}`,
                minWidth: ['Payment', 'Filing'].includes(d.label) ? 62 : 48,
                opacity: (d.isPast && !hasFilingData) || (hasFilingData && payment.na && !payment.overdue) ? 0.65 : 1,
              }}
              title={`${d.label === 'Filing' ? 'RAMIS return filing' : d.label === 'Payment' ? 'Final balance payment' : `${d.label} self-assessment`}: ${d.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${payment.paid ? ' ✓ Paid' : payment.na ? ' — Not paid' : d.isPast ? ' (past)' : ` — ${d.daysLeft}d left`}${payment.amount ? ` (LKR ${payment.amount.toLocaleString()})` : ''}`}
            >
              <span style={{ fontSize: 9, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {d.label}
              </span>
              <span style={{ fontSize: 9, color: '#595959', whiteSpace: 'nowrap' }}>
                {d.dateStr}
              </span>

              {/* Status row: show payment info when available, otherwise show days left */}
              {hasFilingData ? (
                payment.paid ? (
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#389e0d', fontFamily: "'JetBrains Mono', monospace" }}>
                    {payment.amount ? `✓ ${formatCompact(payment.amount)}` : '✓'}
                  </span>
                ) : payment.overdue ? (
                  <span style={{ fontSize: 7, fontWeight: 700, color: '#cf1322', letterSpacing: 0.2 }}>
                    OVERDUE
                  </span>
                ) : payment.na ? (
                  <span style={{ fontSize: 8, fontWeight: 600, color: '#bfbfbf' }}>
                    —
                  </span>
                ) : !d.isPast ? (
                  <span style={{ fontSize: 8, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {d.daysLeft}d
                  </span>
                ) : (
                  <span style={{ fontSize: 8, color: '#8c8c8c' }}>✓</span>
                )
              ) : (
                /* Homepage mode: just dates */
                !d.isPast ? (
                  <span style={{ fontSize: 8, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {d.daysLeft}d
                  </span>
                ) : (
                  <span style={{ fontSize: 8, color: '#8c8c8c' }}>✓</span>
                )
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TaxCalendarBar;
