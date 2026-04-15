import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Grid,
  Image,
  Input,
  message,
  Modal,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getEmployeeUpdateRequests,
  approveEmployeeUpdate,
  rejectEmployeeUpdate,
} from '../../services/employeeApi';

const { Text, Title } = Typography;

const FIELD_LABELS = {
  phone: 'Số điện thoại',
  email: 'Email',
  date_of_birth: 'Ngày sinh',
  id_card_number: 'Số căn cước',
  address_village: 'Thôn/Xóm',
  address_commune: 'Xã/Phường',
  address_district: 'Quận/Huyện',
  address_province: 'Tỉnh/Thành phố',
  bank_account_number: 'Số tài khoản NH',
  bank_account_name: 'Tên chủ TK',
  bank_name: 'Ngân hàng',
  avatar: 'Ảnh đại diện',
};

export default function EmployeeUpdateRequests() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [swipedId, setSwipedId] = useState(null);

  const fetchData = () => {
    setLoading(true);
    getEmployeeUpdateRequests()
      .then(res => {
        const data = res.data?.results || res.data || [];
        setRequests(data);
      })
      .catch(() => message.error('Không thể tải danh sách yêu cầu'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id) => {
    Modal.confirm({
      title: 'Xác nhận phê duyệt',
      content: 'Bạn có chắc chắn muốn duyệt yêu cầu cập nhật này? Thông tin sẽ được cập nhật ngay vào hồ sơ nhân viên.',
      okText: 'Duyệt',
      cancelText: 'Hủy',
      okType: 'primary',
      async onOk() {
        setActionLoading(true);
        try {
          await approveEmployeeUpdate(id);
          message.success('Đã phê duyệt và cập nhật thông tin nhân viên');
          fetchData();
        } catch {
          message.error('Lỗi khi phê duyệt');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      message.warning('Vui lòng nhập lý do từ chối');
      return;
    }
    setActionLoading(true);
    try {
      await rejectEmployeeUpdate(rejectingId, rejectNote);
      message.success('Đã từ chối yêu cầu');
      setRejectModalOpen(false);
      setRejectNote('');
      setRejectingId(null);
      fetchData();
    } catch {
      message.error('Lỗi khi từ chối');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusConfig = (item) => {
    const isPending = item.status === 'PENDING';
    const isApproved = item.status === 'APPROVED';
    if (isPending) return { color: '#1677ff', icon: <ClockCircleOutlined />, text: 'Chờ duyệt', tagColor: 'processing' };
    if (isApproved) return { color: '#52c41a', icon: <CheckCircleOutlined />, text: 'Đã duyệt', tagColor: 'success' };
    return { color: '#ff4d4f', icon: <CloseCircleOutlined />, text: 'Đã từ chối', tagColor: 'error' };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  if (!requests.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có yêu cầu cập nhật nào" />;
  }

  /* ── Render change diff item ── */
  const renderChangeItem = (key, value, item) => (
    <div key={key} className="emp-update-diff__row">
      <Text type="secondary" className="emp-update-diff__label">
        {FIELD_LABELS[key] || key}
      </Text>
      {key === 'avatar' ? (
        item.avatar_upload_url ? (
          <Image
            src={item.avatar_upload_url}
            alt="Ảnh mới"
            width={isMobile ? 40 : 64}
            height={isMobile ? 40 : 64}
            style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid #d9d9d9' }}
            preview={{ mask: 'Xem' }}
          />
        ) : (
          <Text type="secondary" italic>(Ảnh đính kèm)</Text>
        )
      ) : (
        <Text strong className="emp-update-diff__value">{String(value)}</Text>
      )}
    </div>
  );

  /* ── Mobile card ── */
  if (isMobile) {
    return (
      <div className="emp-update-mobile-list">
        {requests.map(item => {
          const changes = item.changes || {};
          const isPending = item.status === 'PENDING';
          const statusConfig = getStatusConfig(item);
          const isOpen = swipedId === item.id;

          return (
            <div key={item.id} className={`emp-update-mobile-card${isOpen ? ' emp-update-mobile-card--open' : ''}`}>
              {/* Swipe action buttons (revealed on click) */}
              {isPending && isOpen && (
                <div className="emp-update-mobile-card__actions">
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={actionLoading}
                    onClick={(e) => { e.stopPropagation(); handleApprove(item.id); }}
                    className="emp-update-action-btn emp-update-action-btn--approve"
                  >
                    Duyệt
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={(e) => { e.stopPropagation(); setRejectingId(item.id); setRejectModalOpen(true); }}
                    className="emp-update-action-btn emp-update-action-btn--reject"
                  >
                    Từ chối
                  </Button>
                </div>
              )}

              {/* Main card content */}
              <div
                className="emp-update-mobile-card__body"
                onClick={() => isPending && setSwipedId(isOpen ? null : item.id)}
              >
                {/* Header row */}
                <div className="emp-update-mobile-card__header">
                  <Space size={8}>
                    <Avatar
                      src={item.requested_by_avatar_url}
                      icon={!item.requested_by_avatar_url && <UserOutlined />}
                      style={{ backgroundColor: item.requested_by_avatar_url ? undefined : statusConfig.color }}
                      size={32}
                    />
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{item.requested_by_name || item.requested_by_username}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                  </Space>
                  <Tag icon={statusConfig.icon} color={statusConfig.tagColor} style={{ borderRadius: 10, fontSize: 11 }}>
                    {statusConfig.text}
                  </Tag>
                </div>

                {/* Compact diff */}
                <div className="emp-update-diff emp-update-diff--compact">
                  {Object.entries(changes).map(([key, value]) => renderChangeItem(key, value, item))}
                </div>

                {/* Review note */}
                {item.review_note && (
                  <div className="emp-update-mobile-card__note">
                    <Text type="secondary" style={{ fontSize: 11 }}>Ghi chú: </Text>
                    <Text style={{ fontSize: 12 }}>{item.review_note}</Text>
                  </div>
                )}

                {/* Hint for actionable cards */}
                {isPending && !isOpen && (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>
                    Nhấn để hiện hành động
                  </Text>
                )}
              </div>
            </div>
          );
        })}

        <Modal
          title="Từ chối yêu cầu cập nhật"
          open={rejectModalOpen}
          onCancel={() => { setRejectModalOpen(false); setRejectNote(''); }}
          onOk={handleReject}
          confirmLoading={actionLoading}
          okText="Xác nhận từ chối"
          okButtonProps={{ danger: true }}
          cancelText="Hủy"
          width="100%"
          className="erp-modal-mobile"
          style={{ top: 0, maxWidth: '100vw', margin: 0 }}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Vui lòng nhập lý do từ chối. Lý do sẽ được gửi thông báo tới nhân viên.
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="Nhập lý do từ chối..."
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
          />
        </Modal>
      </div>
    );
  }

  /* ── Desktop card grid ── */
  return (
    <div>
      <Row gutter={[16, 16]}>
        {requests.map(item => {
          const changes = item.changes || {};
          const isPending = item.status === 'PENDING';
          const statusConfig = getStatusConfig(item);

          return (
            <Col xs={24} lg={12} key={item.id}>
              <Card
                size="small"
                style={{ borderLeft: `4px solid ${statusConfig.color}`, borderRadius: 8 }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space>
                    <Avatar
                      src={item.requested_by_avatar_url}
                      icon={!item.requested_by_avatar_url && <UserOutlined />}
                      style={{ backgroundColor: item.requested_by_avatar_url ? undefined : statusConfig.color }}
                      size={36}
                    />
                    <div>
                      <Text strong style={{ fontSize: 14 }}>{item.requested_by_name || item.requested_by_username}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                  </Space>
                  <Tag icon={statusConfig.icon} color={statusConfig.tagColor} style={{ borderRadius: 12, padding: '2px 10px' }}>
                    {statusConfig.text}
                  </Tag>
                </div>

                {/* Changes */}
                <div className="emp-update-diff">
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                    Nội dung thay đổi
                  </Text>
                  {Object.entries(changes).map(([key, value]) => renderChangeItem(key, value, item))}
                </div>

                {/* Review note */}
                {item.review_note && (
                  <div style={{ background: '#fff7e6', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
                    <Text type="secondary">Ghi chú: </Text>
                    <Text>{item.review_note}</Text>
                  </div>
                )}

                {/* Actions */}
                {isPending && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      loading={actionLoading}
                      onClick={() => handleApprove(item.id)}
                      style={{ borderRadius: 6 }}
                    >
                      Phê duyệt
                    </Button>
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => { setRejectingId(item.id); setRejectModalOpen(true); }}
                      style={{ borderRadius: 6 }}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title="Từ chối yêu cầu cập nhật"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectNote(''); }}
        onOk={handleReject}
        confirmLoading={actionLoading}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Vui lòng nhập lý do từ chối. Lý do sẽ được gửi thông báo tới nhân viên.
        </Text>
        <Input.TextArea
          rows={3}
          placeholder="Nhập lý do từ chối..."
          value={rejectNote}
          onChange={e => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
