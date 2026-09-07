import React from 'react';
import { Button } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, TeamOutlined, CalendarOutlined, SettingOutlined } from '@ant-design/icons';

const navItems = [
  { key: '/settings/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/settings/fiscal-years', icon: <CalendarOutlined />, label: 'Fiscal Years' },
  { key: '/settings/tax-config', icon: <SettingOutlined />, label: 'Tax Config' },
];

const SettingsLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = navItems.find((item) => item.key === location.pathname)
    ? location.pathname
    : '/settings/users';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1a7a3a 0%, #52c41a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              <SettingOutlined style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', lineHeight: '20px' }}>
                Settings
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: '16px' }}>
                Users, fiscal years &amp; tax configuration
              </div>
            </div>
          </div>
        </div>

        {/* ====== NAV TABS ====== */}
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 4, marginTop: 16 }}>
          {navItems.map((item) => {
            const active = selectedKey === item.key;
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: active ? '#1a7a3a' : '#595959',
                  borderBottom: active ? '2px solid #1a7a3a' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {item.icon}
                {item.label}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 48px' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default SettingsLayout;
