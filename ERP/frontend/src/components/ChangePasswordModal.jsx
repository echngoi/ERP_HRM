import { useState } from 'react';
import {
  Button,
  Form,
  Grid,
  Input,
  message,
  Modal,
  Progress,
  Typography,
} from 'antd';
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  LockOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Text } = Typography;

function getPasswordStrength(password) {
  if (!password) return { percent: 0, status: 'exception', label: '' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return { percent: 20, status: 'exception', label: 'Yếu', color: '#ff4d4f' };
  if (score <= 2) return { percent: 40, status: 'active', label: 'Trung bình', color: '#faad14' };
  if (score <= 3) return { percent: 60, status: 'active', label: 'Khá', color: '#1677ff' };
  if (score <= 4) return { percent: 80, status: 'active', label: 'Mạnh', color: '#52c41a' };
  return { percent: 100, status: 'success', label: 'Rất mạnh', color: '#389e0d' };
}

/**
 * Change password modal.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - mode: 'self' | 'admin'
 *  - targetUserId: number (required when mode='admin')
 *  - targetUserName: string (display name for admin reset)
 */
export default function ChangePasswordModal({ open, onClose, mode = 'self', targetUserId, targetUserName }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const isAdmin = mode === 'admin';
  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isAdmin) {
        await api.post(`/users/${targetUserId}/reset-password/`, {
          new_password: values.new_password,
          confirm_password: values.confirm_password,
        });
      } else {
        await api.post('/users/change-password/', {
          old_password: values.old_password,
          new_password: values.new_password,
          confirm_password: values.confirm_password,
        });
      }

      message.success(isAdmin ? `Đã đặt lại mật khẩu cho ${targetUserName || 'nhân viên'}.` : 'Đổi mật khẩu thành công!');
      form.resetFields();
      setNewPassword('');
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      message.error(detail || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setNewPassword('');
    onClose();
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
      width={isMobile ? '100%' : 440}
      className={isMobile ? 'erp-modal-mobile' : ''}
      style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
    >
      <div className="change-password-modal">
        {/* Header */}
        <div className="change-password-modal__header">
          <div className="change-password-modal__icon">
            <LockOutlined />
          </div>
          <div>
            <Text strong style={{ fontSize: 16, display: 'block' }}>
              {isAdmin ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu'}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {isAdmin
                ? `Đặt mật khẩu mới cho ${targetUserName || 'người dùng'}`
                : 'Nhập mật khẩu hiện tại và mật khẩu mới'}
            </Text>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          size={isMobile ? 'large' : 'middle'}
          onFinish={handleSubmit}
          style={{ marginTop: 20 }}
        >
          {!isAdmin && (
            <Form.Item
              name="old_password"
              label="Mật khẩu hiện tại"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Nhập mật khẩu hiện tại"
                iconRender={v => v ? <EyeTwoTone /> : <EyeInvisibleOutlined />}
              />
            </Form.Item>
          )}

          <Form.Item
            name="new_password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
              iconRender={v => v ? <EyeTwoTone /> : <EyeInvisibleOutlined />}
              onChange={e => setNewPassword(e.target.value)}
            />
          </Form.Item>

          {/* Password strength indicator */}
          {newPassword && (
            <div className="change-password-modal__strength">
              <Progress
                percent={strength.percent}
                showInfo={false}
                size="small"
                strokeColor={strength.color}
              />
              <Text style={{ fontSize: 12, color: strength.color }}>{strength.label}</Text>
            </div>
          )}

          <Form.Item
            name="confirm_password"
            label="Xác nhận mật khẩu mới"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Nhập lại mật khẩu mới"
              iconRender={v => v ? <EyeTwoTone /> : <EyeInvisibleOutlined />}
            />
          </Form.Item>

          <div className="change-password-modal__actions">
            <Button onClick={handleCancel} block={isMobile}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} block={isMobile}>
              {isAdmin ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu'}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}
