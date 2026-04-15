import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Grid,
  Input,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  BankOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
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
      date_of_birth: profile?.date_of_birth ? dayjs(profile.date_of_birth) : null,
      id_card_number: profile?.id_card_number || '',
      address_village: profile?.address_village || '',
      address_commune: profile?.address_commune || '',
      address_district: profile?.address_district || '',
      address_province: profile?.address_province || '',
      bank_account_number: profile?.bank_account_number || '',
      bank_account_name: profile?.bank_account_name || '',
      bank_name: profile?.bank_name || '',
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const editableFields = [
        'phone', 'email', 'date_of_birth', 'id_card_number',
        'address_village', 'address_commune', 'address_district', 'address_province',
        'bank_account_number', 'bank_account_name', 'bank_name',
      ];
      const changes = {};
      editableFields.forEach(field => {
        let newVal = values[field];
        let oldVal = profile?.[field] || '';
        if (field === 'date_of_birth') {
          newVal = newVal ? dayjs(newVal).format('YYYY-MM-DD') : '';
          oldVal = oldVal || '';
        }
        if (newVal !== undefined && newVal !== oldVal) {
          changes[field] = newVal;
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

  /* ── Tab data for grouped display ── */
  const personalRows = () => (
    <>
      {renderRow('Username', profile.username)}
      {renderRow('Họ tên', profile.full_name)}
      {renderRow('Vị trí', profile.position)}
      {renderRow('Phòng ban', profile.department_name)}
      {renderRow('Số căn cước', profile.id_card_number)}
      {renderRow('Ngày sinh', profile.date_of_birth)}
    </>
  );

  const contactRows = () => (
    <>
      {renderRow('Email', profile.email)}
      {renderRow('Số điện thoại', profile.phone)}
      {renderRow('Thôn/Xóm', profile.address_village)}
      {renderRow('Xã/Phường', profile.address_commune)}
      {renderRow('Quận/Huyện', profile.address_district)}
      {renderRow('Tỉnh/Thành phố', profile.address_province)}
    </>
  );

  const bankRows = () => (
    <>
      {renderRow('Số tài khoản', profile.bank_account_number)}
      {renderRow('Tên chủ TK', profile.bank_account_name)}
      {renderRow('Ngân hàng', profile.bank_name)}
    </>
  );

  const contractRows = () => (
    <>
      {renderRow('Ngày vào làm', profile.date_joined_company)}
      {renderRow('Trạng thái HĐ', CONTRACT_STATUS_MAP[profile.contract_status] || profile.contract_status)}
      {(profile.contract_status === 'FIXED_TERM' || profile.contract_status === 'INDEFINITE') && renderRow('Ngày bắt đầu HĐ', profile.contract_start)}
      {profile.contract_status === 'FIXED_TERM' && renderRow('Ngày kết thúc HĐ', profile.contract_end)}
      {renderRow('Trạng thái LV', WORK_STATUS_MAP[profile.work_status] || profile.work_status)}
    </>
  );

  /* ── Edit form fields grouped by tab ── */
  const editPersonalFields = () => (
    <>
      <Form.Item name="avatar" label="Ảnh đại diện">
        <Upload listType="picture" maxCount={1} beforeUpload={() => false}>
          <Button icon={<CameraOutlined />}>Chọn ảnh mới</Button>
        </Upload>
      </Form.Item>
      <Form.Item name="id_card_number" label="Số căn cước">
        <Input placeholder="Nhập số căn cước" />
      </Form.Item>
      <Form.Item name="date_of_birth" label="Ngày sinh">
        <DatePicker format="DD/MM/YYYY" placeholder="Chọn ngày sinh" style={{ width: '100%' }} />
      </Form.Item>
    </>
  );

  const editContactFields = () => (
    <>
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
    </>
  );

  const editBankFields = () => (
    <>
      <Form.Item name="bank_account_number" label="Số tài khoản">
        <Input placeholder="Nhập số tài khoản" />
      </Form.Item>
      <Form.Item name="bank_account_name" label="Tên chủ TK">
        <Input placeholder="Nhập tên chủ tài khoản" />
      </Form.Item>
      <Form.Item name="bank_name" label="Ngân hàng">
        <Select
          showSearch
          placeholder="Chọn ngân hàng"
          allowClear
          options={VIETNAM_BANKS.map(b => ({ value: b, label: b }))}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>
    </>
  );

  const tabItems = profile ? [
    { key: 'personal', label: 'Cá nhân', icon: <UserOutlined />, children: editing ? editPersonalFields() : personalRows() },
    { key: 'contact', label: 'Liên hệ', icon: <EnvironmentOutlined />, children: editing ? editContactFields() : contactRows() },
    { key: 'bank', label: 'Ngân hàng', icon: <BankOutlined />, children: editing ? editBankFields() : bankRows() },
    { key: 'contract', label: 'Hợp đồng', icon: <FileTextOutlined />, children: contractRows() },
  ] : [];

  const pendingAlert = hasPending && (
    <Alert
      type="warning"
      showIcon
      icon={<ClockCircleOutlined />}
      message="Thông tin cập nhật đang chờ phê duyệt"
      description={isMobile ? undefined : 'Bạn không thể gửi yêu cầu mới cho đến khi yêu cầu hiện tại được xử lý.'}
      style={{ marginTop: 12 }}
    />
  );

  const editButton = !editing && (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
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
  );

  const saveButtons = editing && (
    <div style={{ textAlign: 'right', marginTop: 12 }}>
      <Space style={{ width: isMobile ? '100%' : undefined }} direction={isMobile ? 'vertical' : 'horizontal'}>
        <Button onClick={() => setEditing(false)} block={isMobile}>Hủy</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} block={isMobile}>
          Gửi yêu cầu cập nhật
        </Button>
      </Space>
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
          size={isMobile ? 64 : 80}
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

      {editing && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12, textAlign: 'center' }}>
          Sau khi lưu, thông tin sẽ được gửi đến người phụ trách để duyệt.
        </Text>
      )}

      {isMobile ? (
        /* ── Mobile: Tabbed layout ── */
        <Form form={form} layout="vertical" size="small" className="my-profile-form-mobile">
          <Tabs
            size="small"
            items={tabItems.map(t => ({
              key: t.key,
              label: (
                <span>{t.icon} {t.label}</span>
              ),
              children: t.children,
            }))}
          />
          {pendingAlert}
          {editButton}
          {saveButtons}
        </Form>
      ) : (
        /* ── Desktop: Traditional layout ── */
        <>
          {!editing ? (
            <>
              <Divider style={{ margin: '12px 0' }} />
              {personalRows()}
              <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>Liên hệ</Divider>
              {contactRows()}
              <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>Ngân hàng</Divider>
              {bankRows()}
              <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>Hợp đồng</Divider>
              {contractRows()}
              {pendingAlert}
              {editButton}
            </>
          ) : (
            <>
              <Divider style={{ margin: '12px 0' }}>Chỉnh sửa thông tin cá nhân</Divider>
              <Form form={form} layout="vertical" size="middle">
                {editPersonalFields()}
                <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>Liên hệ</Divider>
                {editContactFields()}
                <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>Ngân hàng</Divider>
                {editBankFields()}
              </Form>
              {saveButtons}
            </>
          )}
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
