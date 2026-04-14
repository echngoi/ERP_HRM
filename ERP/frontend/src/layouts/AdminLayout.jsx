import { useState } from 'react';
import {
  ApartmentOutlined,
  GlobalOutlined,
  HomeOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  PartitionOutlined,
  PictureOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { AppstoreOutlined } from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatRoleDisplayName } from '../pages/Admin/utils';
import './AdminLayout.css';

const { Header, Content, Sider } = Layout;

const menuItems = [
  {
    key: 'users',
    icon: <TeamOutlined />,
    label: 'Người dùng',
  },
  {
    key: 'departments',
    icon: <ApartmentOutlined />,
    label: 'Phòng ban',
  },
  {
    key: 'roles',
    icon: <UserSwitchOutlined />,
    label: 'Vai trò',
  },
  {
    key: 'workflow',
    icon: <PartitionOutlined />,
    label: 'Quy trình',
  },
  {
    key: 'template',
    icon: <AppstoreOutlined />,
    label: 'Mẫu phê duyệt',
  },
  {
    key: 'quick-titles',
    icon: <HomeOutlined />,
    label: 'Tiêu đề nhanh',
  },
  {
    key: 'employee-config',
    icon: <IdcardOutlined />,
    label: 'Cấu hình nhân viên',
  },
  {
    key: 'announcements',
    icon: <NotificationOutlined />,
    label: 'Thông báo chạy',
  },
  {
    key: 'footer-config',
    icon: <GlobalOutlined />,
    label: 'Cấu hình Footer',
  },
  {
    key: 'logo-config',
    icon: <PictureOutlined />,
    label: 'Logo doanh nghiệp',
  },
];

const menuPathMap = {
  users: '/admin/users',
  departments: '/admin/departments',
  roles: '/admin/roles',
  workflow: '/admin/workflow',
  template: '/admin/template',
  'quick-titles': '/admin/quick-titles',
  'employee-config': '/admin/employee-config',
  announcements: '/admin/announcements',
  'footer-config': '/admin/footer-config',
  'logo-config': '/admin/logo-config',
};

function getActiveMenuKey(pathname) {
  if (pathname.startsWith('/admin/departments')) return 'departments';
  if (pathname.startsWith('/admin/roles')) return 'roles';
  if (pathname.startsWith('/admin/workflow')) return 'workflow';
  if (pathname.startsWith('/admin/template')) return 'template';
  if (pathname.startsWith('/admin/quick-titles')) return 'quick-titles';
  if (pathname.startsWith('/admin/employee-config')) return 'employee-config';
  if (pathname.startsWith('/admin/announcements')) return 'announcements';
  if (pathname.startsWith('/admin/footer-config')) return 'footer-config';
  if (pathname.startsWith('/admin/logo-config')) return 'logo-config';
  return 'users';
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeMenuKey = getActiveMenuKey(location.pathname);
  const displayName = user?.full_name || user?.username || user?.email || 'Quản trị viên';
  const primaryRole = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0] : 'admin';
  const avatarText = String(displayName).charAt(0).toUpperCase();
  const avatarUrl = user?.avatar_url || null;

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
    },
  ];

  const handleMenuClick = ({ key }) => {
    setMobileMenuOpen(false);
    navigate(menuPathMap[key] || '/admin/users');
  };

  const handleNavigationToggle = () => {
    if (isDesktop) {
      setCollapsed((value) => !value);
      return;
    }
    setMobileMenuOpen((open) => !open);
  };

  const handleLogout = ({ key }) => {
    if (key !== 'logout') return;
    logout();
    navigate('/login', { replace: true });
  };

  const navigationMenu = (
    <>
      <div className="admin-brand">
        <span className="admin-brand__title">ERP Quản trị</span>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeMenuKey]}
        items={menuItems}
        onClick={handleMenuClick}
        className="admin-menu"
        style={{ background: 'transparent' }}
      />
    </>
  );

  return (
    <Layout className="admin-layout">
      <Sider
        trigger={null}
        collapsedWidth={isDesktop ? 88 : 0}
        width={260}
        theme="dark"
        collapsible
        collapsed={isDesktop ? collapsed : true}
        onCollapse={setCollapsed}
        className="admin-sider"
      >
        {navigationMenu}
      </Sider>

      {!isDesktop ? (
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          width={280}
          className="admin-mobile-drawer"
          styles={{ header: { display: 'none' } }}
        >
          {navigationMenu}
        </Drawer>
      ) : null}

      <Layout>
        <Header className="admin-header">
          <div className="admin-header__left">
            <Button
              type="text"
              icon={isDesktop && !collapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={handleNavigationToggle}
              className="admin-header__menu-btn"
            />
            <Button
              icon={<HomeOutlined />}
              onClick={() => navigate('/dashboard')}
              className="admin-header__home-btn"
            >
              Về màn hình chính
            </Button>
          </div>

          <div className="admin-header__actions">
            <Dropdown menu={{ items: userMenuItems, onClick: handleLogout }} trigger={['click']}>
              <div className="admin-user-trigger">
                <Avatar src={avatarUrl} style={{ background: avatarUrl ? undefined : '#1d4ed8' }}>{!avatarUrl && avatarText}</Avatar>
                <div className="admin-user-trigger__meta">
                  <span className="admin-user-trigger__name">{displayName}</span>
                  <span className="admin-user-trigger__role">{formatRoleDisplayName(primaryRole)}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="admin-content">
          <div className="admin-content__inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
