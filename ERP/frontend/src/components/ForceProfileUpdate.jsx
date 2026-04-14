import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Button, Card, DatePicker, Form, Input, message,
  Result, Select, Space, Spin, Typography, Upload,
} from 'antd';
import {
  CameraOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, SafetyOutlined, UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  checkProfileCompleteness,
  getMyEmployeeProfile,
  requestMyProfileUpdate,
  VIETNAM_BANKS,
} from '../services/employeeApi';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const FIELD_LABELS = {
  avatar: 'Ảnh đại diện',
  phone: 'Số điện thoại',
  email: 'Email',
  date_of_birth: 'Ngày sinh',
  id_card_number: 'Số căn cước',
  address_village: 'Thôn/Xóm',
  address_commune: 'Xã/Phường',
  address_district: 'Quận/Huyện',
  address_province: 'Tỉnh/Thành phố',
  bank_account_number: 'Số tài khoản ngân hàng',
  bank_account_name: 'Tên chủ tài khoản',
  bank_name: 'Tên ngân hàng',
};

/**
 * Full-screen gate. Renders children only when profile is complete or feature is off.
 * Otherwise shows forced update form or pending-approval message.
 */
export default function ForceProfileUpdate({ children }) {
  const { logout } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | allowed | must_update | pending_approval
  const [missingFields, setMissingFields] = useState([]);
  const [rejectReason, setRejectReason] = useState(null);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const doCheck = async () => {
    try {
      const res = await checkProfileCompleteness();
      const data = res.data;
      if (data.allowed) {
        setStatus('allowed');
      } else if (data.reason === 'pending_approval') {
        setMissingFields(data.missing_fields || []);
        setStatus('pending_approval');
      } else {
        setMissingFields(data.missing_fields || []);
        setRejectReason(data.reject_reason || null);
        setStatus('must_update');
        // Also fetch full profile for display
        try {
          const pRes = await getMyEmployeeProfile();
          setProfile(pRes.data);
        } catch { /* ignore */ }
      }
    } catch {
      // If API errors, allow access (fail-open)
      setStatus('allowed');
    }
  };

  useEffect(() => { doCheck(); }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const hasAvatar = values.avatar?.fileList?.[0]?.originFileObj;
      const changes = {};
      for (const field of missingFields) {
        if (field === 'avatar') continue;
        if (field === 'date_of_birth' && values[field]) {
          changes[field] = dayjs(values[field]).format('YYYY-MM-DD');
        } else if (values[field] !== undefined && values[field] !== '') {
          changes[field] = values[field];
        }
      }

      if (hasAvatar) {
        const formData = new FormData();
        formData.append('avatar', values.avatar.fileList[0].originFileObj);
        Object.entries(changes).forEach(([k, v]) => formData.append(k, v));
        await requestMyProfileUpdate(formData);
      } else if (Object.keys(changes).length > 0) {
        await requestMyProfileUpdate(changes);
      } else {
        message.warning('Vui lòng điền đầy đủ thông tin.');
        return;
      }

      message.success('Thông tin đã được gửi đi, vui lòng chờ phê duyệt.');
      setStatus('pending_approval');
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Đang kiểm tra thông tin..." />
      </div>
    );
  }

  if (status === 'allowed') {
    return children;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  if (status === 'pending_approval') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        <Card style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <Result
            icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            title="Thông tin đang chờ phê duyệt"
            subTitle="Thông tin cập nhật của bạn đang được xem xét. Bạn sẽ có thể truy cập hệ thống sau khi thông tin được phê duyệt."
            extra={
              <Button onClick={handleLogout} icon={<ExclamationCircleOutlined />}>Đăng xuất</Button>
            }
          />
        </Card>
      </div>
    );
  }

  // must_update — show the form
  const renderField = (fieldName) => {
    const label = FIELD_LABELS[fieldName] || fieldName;

    if (fieldName === 'avatar') {
      return (
        <Form.Item key={fieldName} name="avatar" label={label}>
          <Upload
            maxCount={1}
            listType="picture-card"
            beforeUpload={() => false}
            accept="image/*"
          >
            <div>
              <CameraOutlined />
              <div style={{ marginTop: 4, fontSize: 12 }}>Tải ảnh</div>
            </div>
          </Upload>
        </Form.Item>
      );
    }

    if (fieldName === 'date_of_birth') {
      return (
        <Form.Item key={fieldName} name={fieldName} label={label}
          rules={[{ required: true, message: `Vui lòng nhập ${label}` }]}>
          <DatePicker format="DD/MM/YYYY" placeholder="Chọn ngày sinh" style={{ width: '100%' }} />
        </Form.Item>
      );
    }

    if (fieldName === 'bank_name') {
      return (
        <Form.Item key={fieldName} name={fieldName} label={label}
          rules={[{ required: true, message: `Vui lòng chọn ${label}` }]}>
          <Select
            showSearch
            placeholder="Chọn ngân hàng"
            options={VIETNAM_BANKS.map(b => ({ value: b, label: b }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      );
    }

    if (fieldName === 'email') {
      return (
        <Form.Item key={fieldName} name={fieldName} label={label}
          rules={[
            { required: true, message: `Vui lòng nhập ${label}` },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}>
          <Input placeholder={label} />
        </Form.Item>
      );
    }

    return (
      <Form.Item key={fieldName} name={fieldName} label={label}
        rules={[{ required: true, message: `Vui lòng nhập ${label}` }]}>
        <Input placeholder={label} />
      </Form.Item>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar
            src={profile?.avatar_url}
            icon={!profile?.avatar_url && <UserOutlined />}
            size={64}
            style={{ backgroundColor: profile?.avatar_url ? undefined : '#1677ff', marginBottom: 12 }}
          />
          <Title level={4} style={{ margin: 0 }}>
            <SafetyOutlined style={{ marginRight: 8 }} />
            Cập nhật thông tin bắt buộc
          </Title>
          <Text type="secondary">
            Vui lòng bổ sung các thông tin còn thiếu bên dưới để tiếp tục sử dụng hệ thống.
          </Text>
        </div>

        {rejectReason && (
          <Alert
            type="error"
            showIcon
            message="Yêu cầu trước đó đã bị từ chối"
            description={<><strong>Lý do:</strong> {rejectReason}</>}
            style={{ marginBottom: 16 }}
          />
        )}

        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`Bạn cần cập nhật ${missingFields.length} trường thông tin`}
          description={missingFields.map(f => FIELD_LABELS[f] || f).join(', ')}
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {missingFields.map(f => renderField(f))}

          <Form.Item style={{ marginTop: 24, textAlign: 'center' }}>
            <Space size="middle">
              <Button type="primary" htmlType="submit" size="large" loading={saving}
                icon={<CheckCircleOutlined />}>
                Gửi thông tin cập nhật
              </Button>
              <Button size="large" onClick={handleLogout}>
                Đăng xuất
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
