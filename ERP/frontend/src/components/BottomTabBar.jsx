import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  EllipsisOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Grid } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'dashboard', path: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: 'requests', path: '/request', icon: <FileTextOutlined />, label: 'Yêu cầu' },
  { key: 'approvals', path: '/approval', icon: <CheckCircleOutlined />, label: 'Phê duyệt' },
  { key: 'attendance', path: '/attendance/monthly', icon: <ClockCircleOutlined />, label: 'Chấm công' },
  { key: 'more', path: null, icon: <EllipsisOutlined />, label: 'Thêm' },
];

export default function BottomTabBar({ onMoreClick }) {
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const location = useLocation();
  const navigate = useNavigate();

  if (isDesktop) return null;

  const getActiveTab = () => {
    const p = location.pathname;
    if (p.startsWith('/dashboard')) return 'dashboard';
    if (p.startsWith('/request') || p.startsWith('/requests')) return 'requests';
    if (p.startsWith('/approval') || p.startsWith('/approvals')) return 'approvals';
    if (p.startsWith('/attendance')) return 'attendance';
    return '';
  };

  const activeTab = getActiveTab();

  return (
    <nav className="erp-bottom-tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.key}
          className={`erp-bottom-tab${activeTab === tab.key ? ' erp-bottom-tab--active' : ''}${tab.key === 'more' ? ' erp-bottom-tab--more' : ''}`}
          onClick={() => {
            if (tab.key === 'more') {
              onMoreClick?.();
              return;
            }
            navigate(tab.path);
          }}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
