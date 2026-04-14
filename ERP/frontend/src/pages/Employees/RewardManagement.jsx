import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GiftOutlined,
  PlusOutlined,
  SearchOutlined,
  TrophyOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getRewards,
  createReward,
  updateReward,
  deleteReward,
  toggleRewardVisibility,
  checkRewardPermission,
  getEmployees,
} from '../../services/employeeApi';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const REWARD_TYPE_MAP = {
  CASH: { label: 'Tiền mặt', color: 'gold', icon: '💰' },
  GIFT: { label: 'Hiện vật', color: 'cyan', icon: '🎁' },
};

export default function RewardManagement() {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form] = Form.useForm();

  // --- Filters ---
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState(undefined);
  const [filterDept, setFilterDept] = useState(undefined);
  const [filterDateRange, setFilterDateRange] = useState(null);

  // --- Create mode ---
  const [createMode, setCreateMode] = useState('employee'); // 'employee' | 'department'

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchText) params.search = searchText;
      if (filterType) params.reward_type = filterType;
      if (filterDept) params.department = filterDept;
      if (filterDateRange && filterDateRange[0]) params.date_from = filterDateRange[0].format('YYYY-MM-DD');
      if (filterDateRange && filterDateRange[1]) params.date_to = filterDateRange[1].format('YYYY-MM-DD');
      const res = await getRewards(params);
      const data = res.data?.results || res.data || [];
      setRewards(data);
    } catch {
      message.error('Không thể tải danh sách khen thưởng');
    } finally {
      setLoading(false);
    }
  }, [searchText, filterType, filterDept, filterDateRange]);

  useEffect(() => {
    fetchRewards();
    checkRewardPermission()
      .then(res => setIsManager(res.data.is_reward_manager))
      .catch(() => {});
  }, [fetchRewards]);

  useEffect(() => {
    if (isManager) {
      getEmployees({ page_size: 9999, work_status: 'ACTIVE' })
        .then(res => {
          const data = res.data?.results || res.data || [];
          setEmployees(data);
        })
        .catch(() => {});
      api.get('/departments/')
        .then(res => {
          const data = res.data?.results || res.data || [];
          setDepartments(data);
        })
        .catch(() => {});
    }
  }, [isManager]);

  const openCreate = () => {
    setEditingReward(null);
    setCreateMode('employee');
    form.resetFields();
    form.setFieldsValue({ reward_type: 'CASH', reward_date: dayjs() });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingReward(record);
    setCreateMode('employee');
    form.setFieldsValue({
      ...record,
      reward_date: record.reward_date ? dayjs(record.reward_date) : null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingReward) {
        // Edit mode — always single employee
        const payload = {
          employee: values.employee,
          reason: values.reason,
          reward_type: values.reward_type,
          reward_detail: values.reward_detail || '',
          reward_date: values.reward_date.format('YYYY-MM-DD'),
        };
        await updateReward(editingReward.id, payload);
        message.success('Cập nhật khen thưởng thành công');
      } else if (createMode === 'department') {
        // Single department collective reward — no employee
        const payload = {
          department: values.department,
          reason: values.reason,
          reward_type: values.reward_type,
          reward_detail: values.reward_detail || '',
          reward_date: values.reward_date.format('YYYY-MM-DD'),
        };
        await createReward(payload);
        message.success('Đã tạo khen thưởng tập thể cho phòng ban');
      } else {
        // Single employee — no department
        const payload = {
          employee: values.employee,
          reason: values.reason,
          reward_type: values.reward_type,
          reward_detail: values.reward_detail || '',
          reward_date: values.reward_date.format('YYYY-MM-DD'),
        };
        await createReward(payload);
        message.success('Tạo khen thưởng thành công');
      }
      setModalOpen(false);
      fetchRewards();
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn có chắc chắn muốn xóa khen thưởng này?',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      async onOk() {
        try {
          await deleteReward(id);
          message.success('Đã xóa khen thưởng');
          fetchRewards();
        } catch {
          message.error('Lỗi khi xóa');
        }
      },
    });
  };

  const handleToggleVisibility = async (record) => {
    try {
      const res = await toggleRewardVisibility(record.id);
      const visible = res.data.visible_on_dashboard;
      message.success(visible ? 'Đã hiện trên Dashboard' : 'Đã ẩn khỏi Dashboard');
      setRewards(prev => prev.map(r => r.id === record.id ? { ...r, visible_on_dashboard: visible } : r));
    } catch {
      message.error('Lỗi khi chuyển trạng thái hiển thị');
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Nhân viên',
      key: 'employee',
      width: 200,
      render: (_, r) => r.is_department_reward ? (
        <Space>
          <Avatar
            icon={<TeamOutlined />}
            size={36}
            style={{ backgroundColor: '#722ed1' }}
          />
          <div>
            <Text strong>{r.department_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Khen thưởng tập thể</Text>
          </div>
        </Space>
      ) : (
        <Space>
          <Avatar
            src={r.employee_avatar_url}
            icon={!r.employee_avatar_url && <UserOutlined />}
            size={36}
            style={{ backgroundColor: r.employee_avatar_url ? undefined : '#1677ff' }}
          />
          <div>
            <Text strong>{r.employee_name}</Text>
            {r.department_name && <br />}
            {r.department_name && <Text type="secondary" style={{ fontSize: 12 }}>{r.department_name}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: 'Hình thức',
      dataIndex: 'reward_type',
      key: 'reward_type',
      width: 120,
      render: (val) => {
        const t = REWARD_TYPE_MAP[val];
        return t ? <Tag color={t.color}>{t.icon} {t.label}</Tag> : val;
      },
    },
    {
      title: 'Chi tiết thưởng',
      dataIndex: 'reward_detail',
      key: 'reward_detail',
      ellipsis: true,
      width: 200,
    },
    {
      title: 'Ngày khen thưởng',
      dataIndex: 'reward_date',
      key: 'reward_date',
      width: 140,
      render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    ...(isManager ? [
      {
        title: 'Dashboard',
        key: 'visible',
        width: 100,
        align: 'center',
        render: (_, record) => (
          <Tooltip title={record.visible_on_dashboard ? 'Đang hiện — Nhấn để ẩn' : 'Đang ẩn — Nhấn để hiện'}>
            <Button
              type="text"
              icon={record.visible_on_dashboard
                ? <EyeOutlined style={{ color: '#52c41a' }} />
                : <EyeInvisibleOutlined style={{ color: '#bfbfbf' }} />}
              onClick={() => handleToggleVisibility(record)}
            />
          </Tooltip>
        ),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Tooltip title="Chỉnh sửa">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
            <Tooltip title="Xóa">
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
            </Tooltip>
          </Space>
        ),
      },
    ] : []),
  ], [isManager]);

  return (
    <div>
      <Card
        title={
          <Space>
            <TrophyOutlined style={{ fontSize: 18, color: '#faad14' }} />
            <Text strong>Quản lý khen thưởng</Text>
          </Space>
        }
        extra={
          isManager && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo khen thưởng
            </Button>
          )
        }
        styles={{ body: { padding: '12px 0' } }}
      >
        {/* ===== Filters ===== */}
        {isManager && (
          <div style={{ padding: '0 16px 16px' }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8} md={6}>
                <Input
                  placeholder="Tìm nhân viên, lý do..."
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="Hình thức"
                  allowClear
                  value={filterType}
                  onChange={setFilterType}
                  style={{ width: '100%' }}
                >
                  <Option value="CASH">💰 Tiền mặt</Option>
                  <Option value="GIFT">🎁 Hiện vật</Option>
                </Select>
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="Phòng ban"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={filterDept}
                  onChange={setFilterDept}
                  style={{ width: '100%' }}
                  options={departments.map(d => ({ value: d.id, label: d.name }))}
                />
              </Col>
              <Col xs={24} sm={10} md={6}>
                <RangePicker
                  format="DD/MM/YYYY"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  value={filterDateRange}
                  onChange={setFilterDateRange}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </div>
        )}

        <Table
          rowKey="id"
          loading={loading}
          dataSource={rewards}
          columns={columns}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} khen thưởng` }}
          scroll={{ x: 1000 }}
          size="middle"
          locale={{ emptyText: <Empty description="Chưa có khen thưởng nào" /> }}
        />
      </Card>

      <Modal
        title={editingReward ? 'Chỉnh sửa khen thưởng' : 'Tạo khen thưởng mới'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingReward ? 'Cập nhật' : 'Tạo'}
        cancelText="Hủy"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* Mode selector — only for create */}
          {!editingReward && (
            <Form.Item label="Khen thưởng theo">
              <Radio.Group
                value={createMode}
                onChange={e => {
                  setCreateMode(e.target.value);
                  form.resetFields(['employee', 'department']);
                }}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="employee"><UserOutlined /> Nhân viên</Radio.Button>
                <Radio.Button value="department"><TeamOutlined /> Phòng ban</Radio.Button>
              </Radio.Group>
            </Form.Item>
          )}

          {/* Employee select — shown for employee mode or edit mode */}
          {(createMode === 'employee' || editingReward) && (
            <Form.Item
              name="employee"
              label="Nhân viên được khen thưởng"
              rules={[{ required: true, message: 'Vui lòng chọn nhân viên' }]}
            >
              <Select
                showSearch
                placeholder="Chọn nhân viên..."
                optionFilterProp="label"
                options={employees.map(e => ({
                  value: e.id,
                  label: `${e.full_name || e.username} (${e.username})`,
                }))}
              />
            </Form.Item>
          )}

          {/* Department select — shown ONLY for department mode */}
          {(createMode === 'department' && !editingReward) && (
            <Form.Item
              name="department"
              label="Phòng ban được khen thưởng"
              rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
              extra="Khen thưởng tập thể — hiển thị tên phòng ban trên Dashboard"
            >
              <Select
                showSearch
                placeholder="Chọn phòng ban..."
                optionFilterProp="label"
                options={departments.map(d => ({
                  value: d.id,
                  label: d.name,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item
            name="reason"
            label="Lý do khen thưởng"
            rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input.TextArea rows={2} placeholder="Nhập lý do khen thưởng..." />
          </Form.Item>
          <Form.Item
            name="reward_type"
            label="Hình thức thưởng"
            rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
          >
            <Select placeholder="Chọn hình thức...">
              <Option value="CASH">💰 Tiền mặt</Option>
              <Option value="GIFT">🎁 Hiện vật</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reward_detail" label="Chi tiết thưởng">
            <Input.TextArea rows={2} placeholder="Nhập chi tiết thưởng (số tiền, hiện vật cụ thể...)" />
          </Form.Item>
          <Form.Item
            name="reward_date"
            label="Thời gian khen thưởng"
            rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày khen thưởng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
