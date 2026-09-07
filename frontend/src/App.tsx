import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import FilingWorkspace from './pages/FilingWorkspace';
import UsersPage from './pages/UsersPage';
import FiscalYearsPage from './pages/FiscalYearsPage';
import TaxConfigPage from './pages/TaxConfigPage';
import SettingsLayout from './pages/SettingsLayout';
import UserDashboardPage from './pages/UserDashboardPage';

import './App.css';

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1a7a3a',
          colorLink: '#1a7a3a',
          borderRadius: 6,
        },
        algorithm: antdTheme.defaultAlgorithm,
      }}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/filing/:filingId/*" element={<FilingWorkspace />} />
        <Route path="/user/:userId/dashboard" element={<UserDashboardPage />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<UsersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="fiscal-years" element={<FiscalYearsPage />} />
          <Route path="tax-config" element={<TaxConfigPage />} />
        </Route>
      </Routes>
    </ConfigProvider>
  );
};

export default App;
