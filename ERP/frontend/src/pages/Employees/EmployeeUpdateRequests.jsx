import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Image,
  Input,
  message,
  Modal,
  Row,
  Space,
  Spin,
  Tag,
  Timeline,
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
  address_village: 'Thôn/Xóm',
  address_commune: 'Xã/Phường',
  address_district: 'Quận/Huyện',
  address_province: 'Tỉnh/Thành phố',
  avatar: 'Ảnh đại diện',
};

export default function EmployeeUpdateRequests() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  if (!requests.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có yêu cầu cập nhật nào" />;
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        {requests.map(item => {
          const changes = item.changes || {};
          const isPending = item.status === 'PENDING';
          const isApproved = item.status === 'APPROVED';
          const statusConfig = isPending
            ? { color: '#1677ff', bg: '#e6f4ff', border: '#91caff', icon: <ClockCircleOutlined />, text: 'Chờ duyệt' }
            : isApproved
              ? { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', icon: <CheckCircleOutlined />, text: 'Đã duyệt' }
              : { color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', icon: <CloseCircleOutlined />, text: 'Đã từ chối' };

          return (
            <Col xs={24} lg={12} key={item.id}>
              <Card
                size="small"
                style={{
                  borderLeft: `4px solid ${statusConfig.color}`,
                  borderRadius: 8,
                }}
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
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                      </Text>
                    </div>
                  </Space>
                  <Tag
                    icon={statusConfig.icon}
                    color={isPending ? 'processing' : isApproved ? 'success' : 'error'}
                    style={{ borderRadius: 12, padding: '2px 10px' }}
                  >
                    {statusConfig.text}
                  </Tag>
                </div>

                {/* Changes */}
                <div style={{
                  background: '#fafafa',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 12,
                }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                    Nội dung thay đổi
                  </Text>
                  {Object.entries(changes).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'flex-start', padding: '4px 0', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 13, minWidth: 110, flexShrink: 0 }}>
                        {FIELD_LABELS[key] || key}:
                      </Text>
                      {key === 'avatar' ? (
                        item.avatar_upload_url ? (
                          <Image
                            src={item.avatar_upload_url}
                            alt="Ảnh đại diện mới"
                            width={64}
                            height={64}
                            style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid #d9d9d9' }}
                            preview={{ mask: 'Xem ảnh' }}
                          />
                        ) : (
                          <Text type="secondary" italic>(Ảnh đính kèm)</Text>
                        )
                      ) : (
                        <Text strong style={{ fontSize: 13 }}>{String(value)}</Text>
                      )}
                    </div>
                  ))}
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
                      onClick={() => {
                        setRejectingId(item.id);
                        setRejectModalOpen(true);
                      }}
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
