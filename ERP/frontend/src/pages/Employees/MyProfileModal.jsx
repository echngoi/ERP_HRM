import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Divider,
  Drawer,
  Form,
  Grid,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  CameraOutlined,
  ClockCircleOutlined,
  EditOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getMyEmployeeProfile,
  requestMyProfileUpdate,
  VIETNAM_BANKS,
} from '../../services/employeeApi';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const CONTRACT_STATUS_MAP = {
  PROBATION: 'Thử việc',
  FIXED_TERM: 'HĐ xác định thời hạn',
  INDEFINITE: 'HĐ không xác định thời hạn',
};

const WORK_STATUS_MAP = {
  ACTIVE: 'Đang làm việc',
  ON_LEAVE: 'Tạm nghỉ',
  RESIGNED: 'Đã nghỉ',
};

export default function MyProfileModal({ open, onClose }) {
  const { updateUser } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const hasPending = profile?.has_pending_update;

  useEffect(() => {
    if (open) {
      setLoading(true);
      setEditing(false);
      getMyEmployeeProfile()
        .then(res => {
          setProfile(res.data);
          if (res.data?.avatar_url !== undefined) {
            updateUser({ avatar_url: res.data.avatar_url });
          }
        })
        .catch(() => message.error('Không thể tải thông tin nhân viên'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleEdit = () => {
    setEditing(true);
    form.setFieldsValue({
      phone: profile?.phone || '',
      email: profile?.email || '',
      address_village: profile?.address_village || '',
      address_commune: profile?.address_commune || '',
      address_district: profile?.address_district || '',
      address_province: profile?.address_province || '',
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const editableFields = ['phone', 'address_village', 'address_commune', 'address_district', 'address_province', 'email'];
      const changes = {};
      editableFields.forEach(field => {
        if (values[field] !== undefined && values[field] !== (profile?.[field] || '')) {
          changes[field] = values[field];
        }
      });

      const hasAvatar = values.avatar?.fileList?.[0]?.originFileObj;

      if (hasAvatar) {
        const formData = new FormData();
        formData.append('avatar', values.avatar.fileList[0].originFileObj);
        Object.entries(changes).forEach(([k, v]) => formData.append(k, v));
        const res = await requestMyProfileUpdate(formData);
        message.success(res.data.detail);
      } else if (Object.keys(changes).length > 0) {
        const res = await requestMyProfileUpdate(changes);
        message.success(res.data.detail);
      } else {
        message.info('Không có thay đổi nào.');
        return;
      }

      setEditing(false);
      const res = await getMyEmployeeProfile();
      setProfile(res.data);
      if (res.data?.avatar_url !== undefined) {
        updateUser({ avatar_url: res.data.avatar_url });
      }
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (label, value) => (
    <div className="profile-row">
      <Text type="secondary" className="profile-row__label">{label}</Text>
      <Text className="profile-row__value">{value || '—'}</Text>
    </div>
  );

  const profileContent = loading ? (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <Spin size="large" />
    </div>
  ) : profile ? (
    <div className="my-profile-body">
      {/* Header */}
      <div className="my-profile-header">
        <Avatar
          src={profile.avatar_url}
          icon={!profile.avatar_url && <UserOutlined />}
          size={isMobile ? 72 : 80}
          style={{
            backgroundColor: profile.avatar_url ? undefined : '#1677ff',
            border: '3px solid #f0f0f0',
          }}
        />
        <div style={{ marginTop: 8 }}>
          <Title level={5} style={{ margin: 0 }}>{profile.full_name || profile.username}</Title>
          <Text type="secondary">{profile.position} {profile.department_name ? `— ${profile.department_name}` : ''}</Text>
        </div>
      </div>

      {!editing ? (
        <>
          <Divider style={{ margin: '12px 0' }} />
          {renderRow('Username', profile.username)}
          {renderRow('Email', profile.email)}
          {renderRow('Số điện thoại', profile.phone)}
          {renderRow('Số căn cước', profile.id_card_number)}
          {renderRow('Ngày sinh', profile.date_of_birth)}
          {renderRow('Quê quán', [profile.address_village, profile.address_commune, profile.address_district, profile.address_province].filter(Boolean).join(', '))}
          {renderRow('Số tài khoản', profile.bank_account_number)}
          {renderRow('Tên chủ TK', profile.bank_account_name)}
          {renderRow('Ngân hàng', profile.bank_name)}
          {renderRow('Ngày vào làm', profile.date_joined_company)}
          {renderRow('Trạng thái HĐ', CONTRACT_STATUS_MAP[profile.contract_status] || profile.contract_status)}
          {(profile.contract_status === 'FIXED_TERM' || profile.contract_status === 'INDEFINITE') && renderRow('Ngày bắt đầu HĐ', profile.contract_start)}
          {profile.contract_status === 'FIXED_TERM' && renderRow('Ngày kết thúc HĐ', profile.contract_end)}
          {renderRow('Trạng thái LV', WORK_STATUS_MAP[profile.work_status] || profile.work_status)}

          {hasPending && (
            <Alert
              type="warning"
              showIcon
              icon={<ClockCircleOutlined />}
              message="Thông tin cập nhật đang chờ phê duyệt"
              description={isMobile ? undefined : 'Bạn không thể gửi yêu cầu mới cho đến khi yêu cầu hiện tại được xử lý.'}
              style={{ marginTop: 16 }}
            />
          )}

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            {hasPending ? (
              <Tooltip title="Bạn đang có yêu cầu cập nhật chờ phê duyệt">
                <Button type="primary" icon={<EditOutlined />} disabled block={isMobile}>
                  Chỉnh sửa thông tin
                </Button>
              </Tooltip>
            ) : (
              <Button type="primary" icon={<EditOutlined />} onClick={handleEdit} block={isMobile}>
                Chỉnh sửa thông tin
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <Divider style={{ margin: '12px 0' }}>Chỉnh sửa thông tin cá nhân</Divider>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            Bạn có thể cập nhật các trường bên dưới. Sau khi lưu, thông tin sẽ được gửi đến người phụ trách để duyệt.
          </Text>
          <Form form={form} layout="vertical" size="middle">
            <Form.Item name="avatar" label="Ảnh đại diện">
              <Upload listType="picture" maxCount={1} beforeUpload={() => false}>
                <Button icon={<CameraOutlined />}>Chọn ảnh mới</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="phone" label="Số điện thoại">
              <Input placeholder="Nhập số điện thoại" />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input placeholder="Nhập email" />
            </Form.Item>
            <Form.Item name="address_village" label="Thôn/Xóm">
              <Input placeholder="Nhập thôn/xóm" />
            </Form.Item>
            <Form.Item name="address_commune" label="Xã/Phường">
              <Input placeholder="Nhập xã/phường" />
            </Form.Item>
            <Form.Item name="address_district" label="Quận/Huyện">
              <Input placeholder="Nhập quận/huyện" />
            </Form.Item>
            <Form.Item name="address_province" label="Tỉnh/Thành phố">
              <Input placeholder="Nhập tỉnh/thành phố" />
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Space style={{ width: isMobile ? '100%' : undefined }} direction={isMobile ? 'vertical' : 'horizontal'}>
              <Button onClick={() => setEditing(false)} block={isMobile}>Hủy</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} block={isMobile}>
                Gửi yêu cầu cập nhật
              </Button>
            </Space>
          </div>
        </>
      )}
    </div>
  ) : (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <Text type="secondary">Không tìm thấy thông tin nhân viên</Text>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        title="Thông tin nhân viên"
        placement="bottom"
        open={open}
        onClose={onClose}
        height="92vh"
        destroyOnClose
        className="my-profile-drawer"
        styles={{ body: { padding: '12px 16px' } }}
      >
        {profileContent}
      </Drawer>
    );
  }

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {profileContent}
    </Modal>
  );
}
