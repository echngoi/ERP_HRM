import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Grid,
  List,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DownOutlined,
  FileTextOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Text } = Typography;

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

function normalizeCount(payload) {
  if (payload && typeof payload === 'object' && typeof payload.count === 'number') {
    return payload.count;
  }
  return normalizeList(payload).length;
}

function getTypeMeta(type) {
  if (type === 'REQUEST') {
    return {
      icon: <FileTextOutlined style={{ color: '#1677ff' }} />,
      label: 'Yêu cầu',
    };
  }

  if (type === 'MESSAGE') {
    return {
      icon: <MailOutlined style={{ color: '#13c2c2' }} />,
      label: 'Tin nhắn',
    };
  }

  if (type === 'APPROVAL') {
    return {
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      label: 'Phê duyệt',
    };
  }

  return {
    icon: <BellOutlined style={{ color: '#999' }} />,
    label: type || 'Khác',
  };
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const POLL_INTERVAL_MS = 30000;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 8,
    total: 0,
    hasNext: false,
  });

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/', {
        params: { unread: true, page: 1, page_size: 1 },
      });
      setUnreadCount(normalizeCount(response.data));
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadNotifications = useCallback(async ({ page = 1, append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await api.get('/notifications/', {
        params: { page, page_size: pagination.pageSize },
      });
      const list = normalizeList(response.data);
      setItems((prev) => (append ? [...prev, ...list] : list));
      setPagination((prev) => ({
        ...prev,
        current: page,
        total: typeof response.data?.count === 'number' ? response.data.count : list.length,
        hasNext: Boolean(response.data?.next),
      }));
    } catch {
      message.error('Không thể tải thông báo');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    loadNotifications({ page: 1 });
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadUnreadCount();
      if (open) {
        loadNotifications({ page: 1 });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [open, loadNotifications, loadUnreadCount]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      loadNotifications({ page: 1 });
      loadUnreadCount();
    }
  };

  const handleMarkRead = async (notification) => {
    if (notification.is_read) return;

    try {
      await api.post(`/notifications/${notification.id}/mark_read/`);
      setItems((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item,
        ),
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch {
      message.error('Không thể cập nhật thông báo');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark_all_read/');
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      message.success('Đã đánh dấu tất cả là đã đọc');
    } catch {
      message.error('Không thể đánh dấu tất cả thông báo');
    }
  };

  const getNotificationPath = (type) => {
    if (type === 'REQUEST') return '/request';
    if (type === 'MESSAGE') return '/inbox';
    if (type === 'APPROVAL') return '/approval';
    return '/request';
  };

  const handleNotificationClick = async (item) => {
    if (!item.is_read) {
      await handleMarkRead(item);
    }

    setOpen(false);
    navigate(getNotificationPath(item.type));
  };

  const handleLoadMore = async () => {
    if (!pagination.hasNext || loadingMore) return;
    await loadNotifications({ page: pagination.current + 1, append: true });
  };

  const handleOpenAllNotifications = () => {
    setOpen(false);
    navigate('/notifications');
  };

  const notificationList = (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo" style={{ padding: 24 }} />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => {
              const meta = getTypeMeta(item.type);
              return (
                <List.Item
                  className={`notif-item${item.is_read ? '' : ' notif-item--unread'}`}
                  onClick={() => handleNotificationClick(item)}
                >
                  <div className="notif-item__icon">{meta.icon}</div>
                  <div className="notif-item__body">
                    <div className="notif-item__content">
                      <Text className="notif-item__text" strong={!item.is_read}>{item.content}</Text>
                      <Tag color="default" style={{ flexShrink: 0, marginLeft: 6 }}>{meta.label}</Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>

      {items.length > 0 && (
        <>
          <Divider style={{ margin: 0 }} />
          <div style={{ padding: '10px 14px', textAlign: 'center' }}>
            {pagination.hasNext ? (
              <Button type="link" icon={<DownOutlined />} loading={loadingMore} onClick={handleLoadMore}>
                Tải thêm thông báo
              </Button>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>Đã hiển thị toàn bộ thông báo</Text>
            )}
          </div>
        </>
      )}

      <Divider style={{ margin: 0 }} />
      <div style={{ padding: '10px 14px', textAlign: 'center' }}>
        <Button type="link" onClick={handleOpenAllNotifications}>
          Xem tất cả thông báo
        </Button>
      </div>
    </>
  );

  const headerBar = (
    <div className="notif-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text strong style={{ fontSize: 15 }}>Thông báo</Text>
        {unreadCount > 0 && <Badge count={unreadCount} />}
      </div>
      <Button
        type="link"
        size="small"
        disabled={unreadCount === 0}
        style={{ paddingInline: 0, fontSize: 13 }}
        onClick={handleMarkAllRead}
      >
        Đánh dấu tất cả
      </Button>
    </div>
  );

  const overlayNode = useMemo(
    () => (
      <div className="erp-notification-overlay">
        {headerBar}
        <Divider style={{ margin: 0 }} />
        <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {notificationList}
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, loading, loadingMore, pagination.current, pagination.hasNext, unreadCount],
  );

  const triggerButton = (
    <Button
      shape="circle"
      className="erp-notification-trigger"
      icon={<Badge count={unreadCount || 0} size="small"><BellOutlined /></Badge>}
      onClick={isMobile ? () => handleOpenChange(true) : undefined}
    />
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Drawer
          open={open}
          onClose={() => handleOpenChange(false)}
          placement="top"
          height="85vh"
          className="notif-drawer"
          title={null}
          closeIcon={null}
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' }, header: { display: 'none' } }}
        >
          <div className="notif-drawer__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellOutlined style={{ fontSize: 18, color: '#1677ff' }} />
              <Text strong style={{ fontSize: 16 }}>Thông báo</Text>
              {unreadCount > 0 && <Badge count={unreadCount} />}
            </div>
            <Space>
              <Button
                type="link"
                size="small"
                disabled={unreadCount === 0}
                style={{ paddingInline: 0 }}
                onClick={handleMarkAllRead}
              >
                Đánh dấu tất cả
              </Button>
              <Button
                shape="circle"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleOpenChange(false)}
              />
            </Space>
          </div>
          <Divider style={{ margin: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {notificationList}
          </div>
        </Drawer>
      </>
    );
  }

  return (
    <Dropdown
      open={open}
      onOpenChange={handleOpenChange}
      trigger={['click']}
      dropdownRender={() => overlayNode}
    >
      <Button
        shape="circle"
        className="erp-notification-trigger"
        icon={<Badge count={unreadCount || 0} size="small"><BellOutlined /></Badge>}
      />
    </Dropdown>
  );
}
