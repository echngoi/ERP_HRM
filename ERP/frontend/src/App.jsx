import { lazy, Suspense, useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Typography } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import AnnouncementMarquee from './components/AnnouncementMarquee';
import AppFooter from './components/AppFooter';
import BottomTabBar from './components/BottomTabBar';
import ChangePasswordModal from './components/ChangePasswordModal';
import ForceProfileUpdate from './components/ForceProfileUpdate';
import NotificationDropdown from './components/NotificationDropdown';
import OfflineIndicator from './components/OfflineIndicator';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import { formatRoleDisplayName } from './pages/Admin/utils';
import { getMyAttendanceInfo } from './services/attendanceApi';
import { getMyEmployeeProfile } from './services/employeeApi';
import { getSiteConfig } from './services/siteConfigApi';
import './index.css';

const DashboardPage = lazy(() => import('./pages/Dashboard'));
const RequestPage = lazy(() => import('./pages/Requests'));
const ApprovalPage = lazy(() => import('./pages/Approvals'));
const InboxPage = lazy(() => import('./pages/Inbox'));
const MessageDetailPage = lazy(() => import('./pages/Inbox/MessageDetailPage'));
const ComposeMessagePage = lazy(() => import('./pages/Messages/ComposePage'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const AdminUsersPage = lazy(() => import('./pages/Admin/UsersPage'));
const AdminDepartmentsPage = lazy(() => import('./pages/Admin/DepartmentsPage'));
const AdminRolesPage = lazy(() => import('./pages/Admin/RolesPage'));
const AdminWorkflowPage = lazy(() => import('./pages/Admin/WorkflowPage'));
const AdminTemplatePage = lazy(() => import('./pages/Admin/TemplatePage'));
const AdminQuickTitlesPage = lazy(() => import('./pages/Admin/QuickTitlesPage'));
const AdminEmployeeConfigPage = lazy(() => import('./pages/Admin/EmployeeConfigPage'));
const AdminAnnouncementConfigPage = lazy(() => import('./pages/Admin/AnnouncementConfigPage'));
const AdminFooterConfigPage = lazy(() => import('./pages/Admin/FooterConfigPage'));
const AdminLogoConfigPage = lazy(() => import('./pages/Admin/LogoConfigPage'));

// Attendance (ZK) pages
const AttendanceDashboardPage = lazy(() => import('./pages/Attendance/Dashboard'));
const AttendanceLogsPage = lazy(() => import('./pages/Attendance/AttendanceLogs'));
const AttendanceEmployeesPage = lazy(() => import('./pages/Attendance/Employees'));
const AttendanceLiveMonitorPage = lazy(() => import('./pages/Attendance/LiveMonitor'));
const AttendanceDeviceSettingsPage = lazy(() => import('./pages/Attendance/DeviceSettings'));
const AttendanceReportPage = lazy(() => import('./pages/Attendance/AttendanceReport'));
const MonthlyAttendancePage = lazy(() => import('./pages/Attendance/MonthlyAttendance'));
const AttendancePermissionsPage = lazy(() => import('./pages/Attendance/AttendancePermissions'));
const ShiftManagementPage = lazy(() => import('./pages/Attendance/ShiftManagement'));
const LeaveManagementPage = lazy(() => import('./pages/Attendance/LeaveManagement'));
const EmployeesPage = lazy(() => import('./pages/Employees'));
const MyProfileModal = lazy(() => import('./pages/Employees/MyProfileModal'));

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const loadingStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const isLoginRoute = location.pathname === '/login';
  const isAdminRoute = location.pathname.startsWith('/admin');

  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [attInfo, setAttInfo] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const isAdmin = user?.roles?.includes('admin');
  const allowedPages = attInfo?.allowed_pages || (isAdmin ? [] : ['monthly']);

  useEffect(() => {
    if (isAuthenticated) {
      getMyAttendanceInfo()
        .then(r => setAttInfo(r.data))
        .catch(() => {});
      getMyEmployeeProfile()
        .then(r => {
          if (r.data?.avatar_url !== undefined) {
            updateUser({ avatar_url: r.data.avatar_url });
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  // Dynamic favicon from site config
  useEffect(() => {
    getSiteConfig()
      .then((res) => {
        const favicon = res.data?.favicon;
        if (favicon?.image_url) {
          const link = document.querySelector("link[rel~='icon']");
          if (link) {
            // Cache-bust & fix type cho mọi định dạng ảnh
            const bust = favicon.updated_at ? `?v=${Date.parse(favicon.updated_at)}` : `?v=${Date.now()}`;
            link.href = favicon.image_url + bust;
            link.removeAttribute('type');
          }
        }
      })
      .catch(() => {});
  }, []);

  const menuPathMap = {
    dashboard: '/dashboard',
    requests: '/request',
    approvals: '/approval',
    inbox: '/inbox',
    attendance: '/attendance',
    'attendance-dashboard': '/attendance',
    'attendance-live': '/attendance/live',
    'attendance-logs': '/attendance/logs',
    'attendance-monthly': '/attendance/monthly',
    'attendance-employees': '/attendance/employees',
    'attendance-report': '/attendance/report',
    'attendance-device': '/attendance/device',
    'attendance-permissions': '/attendance/permissions',
    'attendance-shifts': '/attendance/shifts',
    'attendance-leave': '/attendance/leave',
    employees: '/employees',
    admin: '/admin/users',
  };

  const getActiveMenuKey = () => {
    const p = location.pathname;
    if (p === '/attendance/live') return 'attendance-live';
    if (p === '/attendance/logs') return 'attendance-logs';
    if (p === '/attendance/monthly') return 'attendance-monthly';
    if (p === '/attendance/employees') return 'attendance-employees';
    if (p === '/attendance/report') return 'attendance-report';
    if (p === '/attendance/device') return 'attendance-device';
    if (p === '/attendance/permissions') return 'attendance-permissions';
    if (p === '/attendance/shifts') return 'attendance-shifts';
    if (p === '/attendance/leave') return 'attendance-leave';
    if (p === '/attendance') return 'attendance-dashboard';
    if (p.startsWith('/dashboard')) return 'dashboard';
    if (p.startsWith('/request') || p.startsWith('/requests')) return 'requests';
    if (p.startsWith('/approval') || p.startsWith('/approvals')) return 'approvals';
    if (p.startsWith('/employees')) return 'employees';
    if (p.startsWith('/admin')) return 'admin';
    if (p.startsWith('/inbox') || p.startsWith('/messages/')) return 'inbox';
    return 'dashboard';
  };
  const activeMenuKey = getActiveMenuKey();

  const displayName =
    user?.full_name
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
    || user?.username
    || user?.email
    || 'Người dùng';
  const primaryRole = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0] : '';

  const avatarText = String(displayName).charAt(0).toUpperCase();
  const avatarUrl = user?.avatar_url || null;

  const [changePwdOpen, setChangePwdOpen] = useState(false);

  const userMenuItems = [
    {
      key: 'my-profile',
      icon: <UserOutlined />,
      label: 'Thông tin nhân viên',
    },
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: 'Đổi mật khẩu',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
    },
  ];

  const handleUserMenuClick = ({ key }) => {
    if (key === 'my-profile') {
      setProfileModalOpen(true);
      return;
    }
    if (key === 'change-password') {
      setChangePwdOpen(true);
      return;
    }
    if (key !== 'logout') return;
    logout();
    navigate('/login', { replace: true });
  };

  const handleSidebarToggle = () => {
    if (isDesktop) {
      setCollapsed(v => !v);
    } else {
      setMobileMenuOpen(v => !v);
    }
  };

  const handleMenuNavigate = ({ key }) => {
    setMobileMenuOpen(false);
    navigate(menuPathMap[key] || '/dashboard');
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Tổng quan',
    },
    {
      key: 'requests',
      icon: <FileTextOutlined />,
      label: 'Yêu cầu xử lý',
    },
    {
      key: 'approvals',
      icon: <AppstoreOutlined />,
      label: 'Phê duyệt',
    },
    {
      key: 'inbox',
      icon: <MailOutlined />,
      label: 'Báo cáo nội bộ',
    },
    {
      key: 'employees',
      icon: <TeamOutlined />,
      label: 'Quản lý nhân viên',
    },
    {
      key: 'attendance',
      icon: <ClockCircleOutlined />,
      label: 'Chấm công',
      children: [
        ...(allowedPages.includes('dashboard') ? [{ key: 'attendance-dashboard', label: 'Tổng quan' }] : []),
        ...(allowedPages.includes('live') ? [{ key: 'attendance-live', label: 'Giám sát trực tiếp' }] : []),
        ...(allowedPages.includes('logs') ? [{ key: 'attendance-logs', label: 'Lịch sử chấm công' }] : []),
        { key: 'attendance-monthly', label: 'Bảng chấm công tháng' },
        ...(allowedPages.includes('employees') ? [{ key: 'attendance-employees', label: 'Nhân viên' }] : []),
        ...(allowedPages.includes('report') ? [{ key: 'attendance-report', label: 'Báo cáo chấm công' }] : []),
        ...(allowedPages.includes('device') ? [{ key: 'attendance-device', label: 'Thiết bị & Cài đặt' }] : []),
        ...(allowedPages.includes('permissions') ? [{ key: 'attendance-permissions', label: 'Phân quyền chấm công' }] : []),
        ...(allowedPages.includes('shifts') ? [{ key: 'attendance-shifts', label: 'Quản lý ca' }] : []),
        { key: 'attendance-leave', label: 'Quản lý nghỉ phép' },
      ],
    },
    ...(user?.roles?.includes('admin')
      ? [
        {
          key: 'admin',
          icon: <ControlOutlined />,
          label: 'Quản trị',
        },
      ]
      : []),
  ];

  if (isLoginRoute) {
    return (
      <Suspense fallback={<div style={loadingStyle}>Loading ERP...</div>}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (isAdminRoute) {
    return (
      <Suspense fallback={<div style={loadingStyle}>Loading ERP...</div>}>
        <Routes>
          <Route
            path="/admin"
            element={<ProtectedRoute><AdminRoute><AdminLayout /></AdminRoute></ProtectedRoute>}
          >
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="departments" element={<AdminDepartmentsPage />} />
            <Route path="roles" element={<AdminRolesPage />} />
            <Route path="workflow" element={<AdminWorkflowPage />} />
            <Route path="template" element={<AdminTemplatePage />} />
            <Route path="quick-titles" element={<AdminQuickTitlesPage />} />
            <Route path="employee-config" element={<AdminEmployeeConfigPage />} />
            <Route path="announcements" element={<AdminAnnouncementConfigPage />} />
            <Route path="footer-config" element={<AdminFooterConfigPage />} />
            <Route path="logo-config" element={<AdminLogoConfigPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin/users" replace />} />
        </Routes>
      </Suspense>
    );
  }

  const sidebarMenu = (
    <>
      <div className="erp-app-brand">
        <Text strong className="erp-app-brand__text">ERP</Text>
      </div>
      <Menu
        className="erp-app-menu"
        mode="inline"
        selectedKeys={[activeMenuKey]}
        items={menuItems}
        onClick={handleMenuNavigate}
      />
    </>
  );

  return (
    <ForceProfileUpdate>
    <OfflineIndicator />
    <Layout className="erp-app-layout">
      {/* Desktop: collapsible Sider */}
      <Sider
        theme="light"
        width={220}
        collapsedWidth={isDesktop ? 64 : 0}
        trigger={null}
        collapsible
        collapsed={isDesktop ? collapsed : true}
        className="erp-app-sider"
      >
        {sidebarMenu}
      </Sider>

      {/* Mobile: Drawer navigation */}
      {!isDesktop && (
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          width={260}
          className="erp-mobile-drawer"
          styles={{ header: { display: 'none' }, body: { padding: 0, background: 'linear-gradient(180deg, #0f172a 0%, #172033 100%)' } }}
        >
          {sidebarMenu}
        </Drawer>
      )}

      <Layout>
        <Header className="erp-app-header">
          <Button
            type="text"
            icon={isDesktop && !collapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={handleSidebarToggle}
            className="erp-app-header__toggle"
          />
          <AnnouncementMarquee />
          <Space size="middle" className="erp-app-header__actions">
            <NotificationDropdown />
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              trigger={['click']}
            >
              <Space size={8} className="erp-app-user-trigger">
                <Avatar src={avatarUrl} className="erp-app-user-trigger__avatar">{!avatarUrl && avatarText}</Avatar>
                <div className="erp-app-user-trigger__meta">
                  <Text className="erp-app-user-trigger__name">{displayName}</Text>
                  <Text className="erp-app-user-trigger__role">{formatRoleDisplayName(primaryRole)}</Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="erp-app-content">
          <Suspense fallback={<div style={loadingStyle}>Loading ERP...</div>}>
            <Routes>
              <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/request" element={<ProtectedRoute><RequestPage /></ProtectedRoute>} />
              <Route path="/approval" element={<ProtectedRoute><ApprovalPage /></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><Navigate to="/request" replace /></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute><Navigate to="/approval" replace /></ProtectedRoute>} />
              <Route path="/messages/compose" element={<ProtectedRoute><ComposeMessagePage /></ProtectedRoute>} />
              <Route path="/messages/:id" element={<ProtectedRoute><MessageDetailPage /></ProtectedRoute>} />

              {/* Attendance (ZK) routes */}
              <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />

              {/* Attendance (ZK) routes */}
              <Route path="/attendance" element={<ProtectedRoute><AttendanceDashboardPage /></ProtectedRoute>} />
              <Route path="/attendance/logs" element={<ProtectedRoute><AttendanceLogsPage /></ProtectedRoute>} />
              <Route path="/attendance/employees" element={<ProtectedRoute><AttendanceEmployeesPage /></ProtectedRoute>} />
              <Route path="/attendance/live" element={<ProtectedRoute><AttendanceLiveMonitorPage /></ProtectedRoute>} />
              <Route path="/attendance/device" element={<ProtectedRoute><AttendanceDeviceSettingsPage /></ProtectedRoute>} />
              <Route path="/attendance/report" element={<ProtectedRoute><AttendanceReportPage /></ProtectedRoute>} />
              <Route path="/attendance/monthly" element={<ProtectedRoute><MonthlyAttendancePage /></ProtectedRoute>} />
              <Route path="/attendance/permissions" element={<ProtectedRoute><AttendancePermissionsPage /></ProtectedRoute>} />
              <Route path="/attendance/shifts" element={<ProtectedRoute><ShiftManagementPage /></ProtectedRoute>} />
              <Route path="/attendance/leave" element={<ProtectedRoute><LeaveManagementPage /></ProtectedRoute>} />

              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </Content>

        <AppFooter />
      </Layout>

      <Suspense fallback={null}>
        <MyProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      </Suspense>
      <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} mode="self" />

      <BottomTabBar onMoreClick={handleSidebarToggle} />
    </Layout>
    </ForceProfileUpdate>
  );
}

export default App;
