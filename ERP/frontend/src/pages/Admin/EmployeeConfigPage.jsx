import { useEffect, useState } from 'react';
import { Avatar, Button, Card, Checkbox, Col, Divider, List, message, Row, Select, Space, Spin, Switch, Tag, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined, UserOutlined, TrophyOutlined, SafetyOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { getEmployeeConfig, updateEmployeeConfig } from '../../services/employeeApi';

const { Title, Text } = Typography;

// All configurable fields on Employee profile
const ALL_PROFILE_FIELDS = [
  { key: 'avatar', label: 'Ảnh đại diện' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'date_of_birth', label: 'Ngày sinh' },
  { key: 'id_card_number', label: 'Số căn cước' },
  { key: 'address_village', label: 'Thôn/Xóm' },
  { key: 'address_commune', label: 'Xã/Phường' },
  { key: 'address_district', label: 'Quận/Huyện' },
  { key: 'address_province', label: 'Tỉnh/Thành phố' },
  { key: 'bank_account_number', label: 'Số tài khoản ngân hàng' },
  { key: 'bank_account_name', label: 'Tên chủ tài khoản' },
  { key: 'bank_name', label: 'Tên ngân hàng' },
];

export default function EmployeeConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [editorIds, setEditorIds] = useState([]);
  const [approverIds, setApproverIds] = useState([]);
  const [rewardManagerIds, setRewardManagerIds] = useState([]);
  const [addEditorId, setAddEditorId] = useState(undefined);
  const [addApproverId, setAddApproverId] = useState(undefined);
  const [addRewardManagerId, setAddRewardManagerId] = useState(undefined);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [requiredFields, setRequiredFields] = useState([]);

  useEffect(() => {
    Promise.all([
      getEmployeeConfig(),
      api.get('/users/', { params: { page_size: 9999 } }),
    ])
      .then(([configRes, usersRes]) => {
        const config = configRes.data;
        setEditorIds(config.editor_users || []);
        setApproverIds(config.approver_users || []);
        setRewardManagerIds(config.reward_manager_users || []);
        setForceUpdate(config.force_profile_update || false);
        setRequiredFields(config.required_fields || []);
        const userList = usersRes.data?.results || usersRes.data || [];
        setUsers(userList);
      })
      .catch(() => message.error('Không thể tải cấu hình'))
      .finally(() => setLoading(false));
  }, []);

  const getUserById = (id) => users.find(u => u.id === id);

  const handleSave = async (newEditors, newApprovers, newRewardManagers, newForce, newRequired) => {
    setSaving(true);
    try {
      await updateEmployeeConfig({
        editor_users: newEditors,
        approver_users: newApprovers,
        reward_manager_users: newRewardManagers,
        force_profile_update: newForce !== undefined ? newForce : forceUpdate,
        required_fields: newRequired !== undefined ? newRequired : requiredFields,
      });
      message.success('Đã lưu cấu hình');
    } catch {
      message.error('Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const addEditor = () => {
    if (!addEditorId || editorIds.includes(addEditorId)) return;
    const next = [...editorIds, addEditorId];
    setEditorIds(next);
    setAddEditorId(undefined);
    handleSave(next, approverIds, rewardManagerIds);
  };

  const removeEditor = (id) => {
    const next = editorIds.filter(eid => eid !== id);
    setEditorIds(next);
    handleSave(next, approverIds, rewardManagerIds);
  };

  const addApprover = () => {
    if (!addApproverId || approverIds.includes(addApproverId)) return;
    const next = [...approverIds, addApproverId];
    setApproverIds(next);
    setAddApproverId(undefined);
    handleSave(editorIds, next, rewardManagerIds);
  };

  const removeApprover = (id) => {
    const next = approverIds.filter(aid => aid !== id);
    setApproverIds(next);
    handleSave(editorIds, next, rewardManagerIds);
  };

  const addRewardManager = () => {
    if (!addRewardManagerId || rewardManagerIds.includes(addRewardManagerId)) return;
    const next = [...rewardManagerIds, addRewardManagerId];
    setRewardManagerIds(next);
    setAddRewardManagerId(undefined);
    handleSave(editorIds, approverIds, next);
  };

  const removeRewardManager = (id) => {
    const next = rewardManagerIds.filter(rid => rid !== id);
    setRewardManagerIds(next);
    handleSave(editorIds, approverIds, next);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  const userOptions = (excludeIds) => users
    .filter(u => !excludeIds.includes(u.id))
    .map(u => ({
      value: u.id,
      label: `${u.full_name || u.username} (${u.username})`,
    }));

  const renderUserList = (ids, onRemove, roleLabel) => (
    <List
      size="small"
      dataSource={ids}
      locale={{ emptyText: 'Chưa có ai được gán' }}
      renderItem={(id) => {
        const u = getUserById(id);
        return (
          <List.Item
            actions={[
              <Button
                key="del"
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={saving}
                onClick={() => onRemove(id)}
              >
                Thu hồi
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar size="small" src={u?.avatar_url} icon={!u?.avatar_url && <UserOutlined />} style={{ backgroundColor: u?.avatar_url ? undefined : '#1677ff' }} />}
              title={u ? `${u.full_name || u.username}` : `User #${id}`}
              description={u ? u.username : ''}
            />
          </List.Item>
        );
      }}
    />
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <Title level={4} style={{ marginBottom: 24 }}>Cấu hình quản lý nhân viên</Title>
      <Row gutter={24}>
        <Col xs={24} md={8}>
          <Card
            title="Người có quyền sửa tất cả nhân viên"
            size="small"
            extra={<Tag color="blue">{editorIds.length}</Tag>}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Những người dùng này có thể xem và chỉnh sửa thông tin của tất cả nhân viên.
            </Text>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Select
                showSearch
                placeholder="Chọn người dùng để thêm..."
                value={addEditorId}
                onChange={setAddEditorId}
                options={userOptions(editorIds)}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ flex: 1 }}
                allowClear
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={addEditor} loading={saving}>
                Thêm
              </Button>
            </Space.Compact>
            {renderUserList(editorIds, removeEditor, 'editor')}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title="Người phê duyệt thay đổi thông tin"
            size="small"
            extra={<Tag color="orange">{approverIds.length}</Tag>}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Khi nhân viên tự cập nhật thông tin, yêu cầu sẽ được gửi tới những người này để duyệt.
            </Text>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Select
                showSearch
                placeholder="Chọn người dùng để thêm..."
                value={addApproverId}
                onChange={setAddApproverId}
                options={userOptions(approverIds)}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ flex: 1 }}
                allowClear
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={addApprover} loading={saving}>
                Thêm
              </Button>
            </Space.Compact>
            {renderUserList(approverIds, removeApprover, 'approver')}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title="Người quản lý khen thưởng"
            size="small"
            extra={<Tag color="green">{rewardManagerIds.length}</Tag>}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Những người dùng này có thể tạo, sửa, xóa các khen thưởng cho nhân viên.
            </Text>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Select
                showSearch
                placeholder="Chọn người dùng để thêm..."
                value={addRewardManagerId}
                onChange={setAddRewardManagerId}
                options={userOptions(rewardManagerIds)}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ flex: 1 }}
                allowClear
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={addRewardManager} loading={saving}>
                Thêm
              </Button>
            </Space.Compact>
            {renderUserList(rewardManagerIds, removeRewardManager, 'reward_manager')}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>Bắt buộc cập nhật thông tin cá nhân</span>
          </Space>
        }
        size="small"
        style={{ maxWidth: 800 }}
        extra={
          <Switch
            checked={forceUpdate}
            loading={saving}
            onChange={(checked) => {
              setForceUpdate(checked);
              handleSave(editorIds, approverIds, rewardManagerIds, checked, requiredFields);
            }}
            checkedChildren="BẬT"
            unCheckedChildren="TẮT"
          />
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Khi bật, người dùng bắt buộc phải cập nhật các trường thông tin trống được chỉ định bên dưới trước khi truy cập hệ thống.
          Thông tin cập nhật sẽ gửi qua quy trình phê duyệt. Trong thời gian chờ duyệt, người dùng không thể truy cập hệ thống.
          <br /><strong>Lưu ý:</strong> Admin không bị ảnh hưởng bởi tính năng này.
        </Text>
        {forceUpdate && (
          <>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Chọn các trường bắt buộc:</Text>
            <Checkbox.Group
              value={requiredFields}
              onChange={(vals) => {
                setRequiredFields(vals);
                handleSave(editorIds, approverIds, rewardManagerIds, forceUpdate, vals);
              }}
            >
              <Row gutter={[16, 8]}>
                {ALL_PROFILE_FIELDS.map(f => (
                  <Col key={f.key} xs={24} sm={12} md={8}>
                    <Checkbox value={f.key}>{f.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
            {requiredFields.length === 0 && (
              <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
                Chưa chọn trường nào. Tính năng sẽ không có hiệu lực nếu không chọn ít nhất 1 trường.
              </Text>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
