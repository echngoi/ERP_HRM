import { useEffect, useMemo, useRef, useState } from 'react';
import { Row, Col, Typography, Space, Alert, Button, Avatar, Spin, Empty, Tag } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  MailOutlined,
  PlusOutlined,
  SendOutlined,
  TrophyOutlined,
  GiftOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';
import api from '../../services/api';
import { getRecentRewards, getBirthdaysThisMonth } from '../../services/employeeApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATS = [
  {
    key: 'totalRequests',
    title: 'Tổng số yêu cầu',
    icon: <FileTextOutlined />,
    color: '#1677ff',
    tone: 'ocean',
    helper: 'Hôm nay',
    secondaryLabel: 'Tổng',
  },
  {
    key: 'inProgress',
    title: 'Task đang xử lý',
    icon: <ClockCircleOutlined />,
    color: '#fa8c16',
    tone: 'amber',
    fetch: () => api.get('/requests/', { params: { type: 'TASK', status: 'IN_PROGRESS' } }),
  },
  {
    key: 'pendingApprovals',
    title: 'Cần phê duyệt',
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    tone: 'emerald',
    helper: 'Chờ xử lý',
    secondaryLabel: 'Đã phê duyệt',
  },
  {
    key: 'unreadMessages',
    title: 'Tin nhắn chưa đọc',
    icon: <MailOutlined />,
    color: '#722ed1',
    tone: 'violet',
    fetch: () => api.get('/messages/inbox/', { params: { unread: true } }),
  },
];

const getCount = (data) => {
  if (data !== null && typeof data === 'object' && 'count' in data) return data.count;
  if (Array.isArray(data)) return data.length;
  return 0;
};

const INITIAL_STATS = {
  totalRequests: { value: 0, secondaryValue: 0 },
  inProgress: { value: 0 },
  pendingApprovals: { value: 0, secondaryValue: 0 },
  unreadMessages: { value: 0 },
};

/* ===================== PhotoSlider component ===================== */
function PhotoSlider({ items, renderCard, emptyText, loading }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [items]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
  }

  if (!items || items.length === 0) {
    return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="dashboard-slider-wrapper">
      {canScrollLeft && (
        <button className="dashboard-slider-arrow dashboard-slider-arrow--left" onClick={() => scroll(-1)}>
          <LeftOutlined />
        </button>
      )}
      <div className="dashboard-slider-track" ref={scrollRef}>
        {items.map((item, i) => renderCard(item, i))}
      </div>
      {canScrollRight && (
        <button className="dashboard-slider-arrow dashboard-slider-arrow--right" onClick={() => scroll(1)}>
          <RightOutlined />
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [birthdays, setBirthdays] = useState([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(true);

  const quickActions = useMemo(
    () => [
      {
        key: 'create-request',
        label: 'Mở trang yêu cầu',
        icon: <PlusOutlined />,
        onClick: () => navigate('/request'),
      },
      {
        key: 'approvals',
        label: 'Xem phê duyệt',
        icon: <CheckCircleOutlined />,
        onClick: () => navigate('/approval'),
      },
      {
        key: 'compose-message',
        label: 'Soạn tin nhắn',
        icon: <SendOutlined />,
        onClick: () => navigate('/messages/compose'),
      },
      {
        key: 'inbox',
        label: 'Mở hộp thư',
        icon: <MailOutlined />,
        onClick: () => navigate('/inbox'),
      },
    ],
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(false);

      const [
        todayRequestsResult,
        totalRequestsResult,
        inProgressResult,
        pendingApprovalsResult,
        approvedApprovalsResult,
        unreadMessagesResult,
      ] = await Promise.allSettled([
        api.get('/requests/', { params: { type: 'TASK', created_today: '1' } }),
        api.get('/requests/', { params: { type: 'TASK' } }),
        api.get('/requests/', { params: { type: 'TASK', status: 'IN_PROGRESS' } }),
        api.get('/approvals/', { params: { status: 'PENDING' } }),
        api.get('/requests/', { params: { type: 'APPROVAL', status: 'APPROVED' } }),
        api.get('/messages/inbox/', { params: { unread: true } }),
      ]);

      if (cancelled) return;

      const results = [
        todayRequestsResult,
        totalRequestsResult,
        inProgressResult,
        pendingApprovalsResult,
        approvedApprovalsResult,
        unreadMessagesResult,
      ];

      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        setError(true);
        setLoading(false);
        return;
      }

      const getResultCount = (result) => (result.status === 'fulfilled' ? getCount(result.value.data) : 0);

      const updated = {
        totalRequests: {
          value: getResultCount(todayRequestsResult),
          secondaryValue: getResultCount(totalRequestsResult),
        },
        inProgress: {
          value: getResultCount(inProgressResult),
        },
        pendingApprovals: {
          value: getResultCount(pendingApprovalsResult),
          secondaryValue: getResultCount(approvedApprovalsResult),
        },
        unreadMessages: {
          value: getResultCount(unreadMessagesResult),
        },
      };

      setStats(updated);
      setLoading(false);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  /* ---------- Fetch rewards & birthdays ---------- */
  useEffect(() => {
    getRecentRewards(20)
      .then(res => setRewards(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch(() => {})
      .finally(() => setRewardsLoading(false));

    getBirthdaysThisMonth()
      .then(res => setBirthdays(res.data?.results || res.data || []))
      .catch(() => {})
      .finally(() => setBirthdaysLoading(false));
  }, []);

  /* ---------- Render reward card ---------- */
  const renderRewardCard = (reward, idx) => {
    const isDeptReward = reward.is_department_reward;
    return (
      <div className="dashboard-photo-card dashboard-photo-card--reward" key={reward.id || idx}>
        <div className="dashboard-photo-card__img-wrap">
          {isDeptReward ? (
            <Avatar
              size={100}
              icon={<TeamOutlined />}
              className="dashboard-photo-card__avatar"
              style={{ backgroundColor: '#722ed1', fontSize: 42 }}
            />
          ) : (
            <Avatar
              size={100}
              src={reward.employee_avatar_url}
              icon={!reward.employee_avatar_url && <UserOutlined />}
              className="dashboard-photo-card__avatar"
            />
          )}
          <div className="dashboard-photo-card__badge dashboard-photo-card__badge--reward">
            {reward.reward_type === 'CASH' ? <TrophyOutlined /> : <GiftOutlined />}
          </div>
        </div>
        <div className="dashboard-photo-card__overlay">
          <div className="dashboard-photo-card__name">
            {isDeptReward ? reward.department_name : reward.employee_name}
          </div>
          {isDeptReward
            ? <div className="dashboard-photo-card__dept">Khen thưởng tập thể</div>
            : <div className="dashboard-photo-card__dept">{reward.department_name || ''}</div>
          }
          <Tag color={reward.reward_type === 'CASH' ? 'gold' : 'cyan'} style={{ marginTop: 4, fontSize: 11 }}>
            {reward.reward_type_display}
          </Tag>
          <div className="dashboard-photo-card__detail">{reward.reason}</div>
          <div className="dashboard-photo-card__date">{dayjs(reward.reward_date).format('DD/MM/YYYY')}</div>
        </div>
      </div>
    );
  };

  /* ---------- Render birthday card ---------- */
  const renderBirthdayCard = (emp, idx) => {
    const dob = emp.date_of_birth ? dayjs(emp.date_of_birth) : null;
    return (
      <div className="dashboard-photo-card dashboard-photo-card--birthday" key={emp.username || idx}>
        <div className="dashboard-photo-card__img-wrap">
          <Avatar
            size={100}
            src={emp.avatar_url}
            icon={!emp.avatar_url && <UserOutlined />}
            className="dashboard-photo-card__avatar"
          />
          <div className="dashboard-photo-card__badge dashboard-photo-card__badge--birthday">
            🎂
          </div>
        </div>
        <div className="dashboard-photo-card__overlay">
          <div className="dashboard-photo-card__name">{emp.full_name}</div>
          <div className="dashboard-photo-card__dept">{emp.department_name || ''}</div>
          {dob && <div className="dashboard-photo-card__date">{dob.format('DD/MM')}</div>}
        </div>
      </div>
    );
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="dashboard-overview-heading">
        <Title level={4} style={{ margin: 0 }}>Tổng quan</Title>
        <Text type="secondary">Thống kê hoạt động trong hệ thống</Text>
      </div>

      <div className="dashboard-quick-actions">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ margin: 0 }}>Thao tác nhanh</Title>
            <Text type="secondary">Đi tới các khu vực thường dùng chỉ với một lần bấm</Text>
          </div>

          <Space wrap size={12}>
            {quickActions.map((action) => (
              <Button
                key={action.key}
                className="dashboard-quick-action-btn"
                icon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        </Space>
      </div>

      {error && (
        <Alert
          type="warning"
          message="Không thể tải dữ liệu thống kê. Vui lòng kiểm tra kết nối đến máy chủ."
          showIcon
          closable
        />
      )}

      <Row gutter={[18, 18]} className="dashboard-stat-grid">
        {STATS.map((config) => (
          <Col xs={24} sm={12} xl={6} key={config.key}>
            <StatCard
              tone={config.tone}
              title={config.title}
              value={stats[config.key]?.value ?? 0}
              icon={config.icon}
              color={config.color}
              loading={loading}
              helper={config.helper}
              secondaryLabel={config.secondaryLabel}
              secondaryValue={stats[config.key]?.secondaryValue ?? 0}
            />
          </Col>
        ))}
      </Row>

      {/* ============ Khen thưởng slider ============ */}
      <div className="dashboard-section dashboard-section--reward">
        <div className="dashboard-section__header">
          <div className="dashboard-section__icon dashboard-section__icon--reward">
            <TrophyOutlined />
          </div>
          <div>
            <Title level={5} style={{ margin: 0 }}>Khen thưởng gần đây</Title>
            <Text type="secondary">Vinh danh nhân viên xuất sắc</Text>
          </div>
        </div>
        <PhotoSlider
          items={rewards}
          renderCard={renderRewardCard}
          emptyText="Chưa có khen thưởng nào"
          loading={rewardsLoading}
        />
      </div>

      {/* ============ Sinh nhật slider ============ */}
      <div className="dashboard-section dashboard-section--birthday">
        <div className="dashboard-section__header">
          <div className="dashboard-section__icon dashboard-section__icon--birthday">
            🎂
          </div>
          <div>
            <Title level={5} style={{ margin: 0 }}>Sinh nhật trong tháng {dayjs().format('M')}</Title>
            <Text type="secondary">Gửi lời chúc mừng đến đồng nghiệp</Text>
          </div>
        </div>
        <PhotoSlider
          items={birthdays}
          renderCard={renderBirthdayCard}
          emptyText="Không có sinh nhật trong tháng này"
          loading={birthdaysLoading}
        />
      </div>
    </Space>
  );
}
