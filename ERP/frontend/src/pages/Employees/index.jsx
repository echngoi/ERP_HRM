import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  IdcardOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TrophyOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getEmployees,
  updateEmployee,
  VIETNAM_BANKS,
} from '../../services/employeeApi';
import { useAuth } from '../../contexts/AuthContext';
import { getMyEmployeeProfile } from '../../services/employeeApi';
import RewardManagement from './RewardManagement';

const { Title, Text } = Typography;
const { Option } = Select;

const CONTRACT_STATUS_MAP = {
  PROBATION: { label: 'Thử việc', color: 'orange' },
  FIXED_TERM: { label: 'HĐ xác định thời hạn', color: 'blue' },
  INDEFINITE: { label: 'HĐ không xác định thời hạn', color: 'green' },
};

const WORK_STATUS_MAP = {
  ACTIVE: { label: 'Đang làm việc', color: 'green' },
  ON_LEAVE: { label: 'Tạm nghỉ', color: 'orange' },
  RESIGNED: { label: 'Đã nghỉ', color: 'red' },
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({});
  const [canEditAll, setCanEditAll] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('view'); // 'view' | 'edit'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [form] = Form.useForm();
  const watchedContractStatus = Form.useWatch('contract_status', form);
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize, ...filters };
      if (searchText) params.q = searchText;
      const res = await getEmployees(params);
      const data = res.data;
      if (data.results) {
        setEmployees(data.results);
        setPagination(prev => ({ ...prev, current: page, pageSize, total: data.count }));
      } else {
        setEmployees(Array.isArray(data) ? data : []);
        setPagination(prev => ({ ...prev, current: 1, total: Array.isArray(data) ? data.length : 0 }));
      }
    } catch {
      message.error('Không thể tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, [searchText, filters]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    setProfileLoading(true);
    getMyEmployeeProfile()
      .then(res => {
        setCanEditAll(res.data.can_edit_all);
        setMyProfile(res.data);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const handleTableChange = (pag) => {
    fetchEmployees(pag.current, pag.pageSize);
  };

  const openDrawer = (employee, mode) => {
    setSelectedEmployee(employee);
    setDrawerMode(mode);
    setDrawerOpen(true);
    if (mode === 'edit') {
      form.setFieldsValue({
        ...employee,
        date_of_birth: employee.date_of_birth ? dayjs(employee.date_of_birth) : null,
        date_joined_company: employee.date_joined_company ? dayjs(employee.date_joined_company) : null,
        contract_start: employee.contract_start ? dayjs(employee.contract_start) : null,
        contract_end: employee.contract_end ? dayjs(employee.contract_end) : null,
      });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = { ...values };
      if (payload.date_of_birth) payload.date_of_birth = payload.date_of_birth.format('YYYY-MM-DD');
      if (payload.date_joined_company) payload.date_joined_company = payload.date_joined_company.format('YYYY-MM-DD');
      if (payload.contract_start) payload.contract_start = payload.contract_start.format('YYYY-MM-DD');
      if (payload.contract_end) payload.contract_end = payload.contract_end.format('YYYY-MM-DD');

      // Handle avatar upload
      if (payload.avatar && payload.avatar.fileList) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (k === 'avatar') {
            if (v.fileList?.[0]?.originFileObj) {
              formData.append('avatar', v.fileList[0].originFileObj);
            }
          } else if (v !== null && v !== undefined) {
            formData.append(k, v);
          }
        });
        await updateEmployee(selectedEmployee.id, formData);
      } else {
        delete payload.avatar;
        await updateEmployee(selectedEmployee.id, payload);
      }

      message.success('Cập nhật thông tin nhân viên thành công');
      setDrawerOpen(false);
      fetchEmployees(pagination.current, pagination.pageSize);
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    {
      title: '',
      dataIndex: 'avatar_url',
      key: 'avatar',
      width: 50,
      render: (url, record) => (
        <Avatar
          src={url}
          icon={!url && <UserOutlined />}
          size={36}
          style={{ backgroundColor: url ? undefined : '#1677ff' }}
        />
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      sorter: (a, b) => (a.username || '').localeCompare(b.username || ''),
    },
    {
      title: 'Họ tên',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 160,
      ellipsis: true,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Chức vụ',
      dataIndex: 'position',
      key: 'position',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Phòng/Khoa',
      dataIndex: 'department_name',
      key: 'department',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Số ĐT',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: 'Trạng thái HĐ',
      dataIndex: 'contract_status',
      key: 'contract_status',
      width: 170,
      render: (val) => {
        const s = CONTRACT_STATUS_MAP[val];
        return s ? <Tag color={s.color}>{s.label}</Tag> : val;
      },
    },
    {
      title: 'Trạng thái LV',
      dataIndex: 'work_status',
      key: 'work_status',
      width: 140,
      render: (val) => {
        const s = WORK_STATUS_MAP[val];
        return s ? <Badge status={val === 'ACTIVE' ? 'success' : val === 'ON_LEAVE' ? 'warning' : 'error'} text={s.label} /> : val;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => openDrawer(record, 'view')}
            />
          </Tooltip>
          {canEditAll && (
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => openDrawer(record, 'edit')}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [canEditAll]);

  const renderDetailRow = (label, value) => (
    <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <Text type="secondary" style={{ width: 160, flexShrink: 0 }}>{label}</Text>
      <Text>{value || '—'}</Text>
    </div>
  );

  const renderViewDrawer = () => {
    if (!selectedEmployee) return null;
    const emp = selectedEmployee;
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar
            src={emp.avatar_url}
            icon={!emp.avatar_url && <UserOutlined />}
            size={80}
            style={{ backgroundColor: emp.avatar_url ? undefined : '#1677ff' }}
          />
          <div style={{ marginTop: 8 }}>
            <Title level={5} style={{ margin: 0 }}>{emp.full_name || emp.username}</Title>
            <Text type="secondary">{emp.position}</Text>
          </div>
        </div>
        {renderDetailRow('Username', emp.username)}
        {renderDetailRow('Phòng/Khoa', emp.department_name)}
        {renderDetailRow('Email', emp.email)}
        {renderDetailRow('Số điện thoại', emp.phone)}
        {renderDetailRow('Số căn cước', emp.id_card_number)}
        {renderDetailRow('Ngày sinh', emp.date_of_birth)}
        {renderDetailRow('Quê quán', [emp.address_village, emp.address_commune, emp.address_district, emp.address_province].filter(Boolean).join(', '))}
        {renderDetailRow('Số tài khoản', emp.bank_account_number)}
        {renderDetailRow('Tên chủ TK', emp.bank_account_name)}
        {renderDetailRow('Ngân hàng', emp.bank_name)}
        {renderDetailRow('Ngày vào làm', emp.date_joined_company)}
        {renderDetailRow('Trạng thái HĐ', CONTRACT_STATUS_MAP[emp.contract_status]?.label || emp.contract_status)}
        {emp.contract_start && renderDetailRow('Ngày bắt đầu HĐ', emp.contract_start)}
        {emp.contract_end && renderDetailRow('Ngày kết thúc HĐ', emp.contract_end)}
        {renderDetailRow('Trạng thái LV', WORK_STATUS_MAP[emp.work_status]?.label || emp.work_status)}
      </div>
    );
  };

  const renderEditForm = () => (
    <Form form={form} layout="vertical">
      <Form.Item name="avatar" label="Ảnh đại diện">
        <Upload
          listType="picture"
          maxCount={1}
          beforeUpload={() => false}
        >
          <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
        </Upload>
      </Form.Item>
      <Form.Item name="phone" label="Số điện thoại">
        <Input placeholder="Nhập số điện thoại" />
      </Form.Item>
      <Form.Item name="email" label="Email">
        <Input placeholder="Nhập email" />
      </Form.Item>
      <Form.Item name="id_card_number" label="Số căn cước">
        <Input placeholder="Nhập số căn cước" />
      </Form.Item>
      <Form.Item name="date_of_birth" label="Ngày sinh">
        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày sinh" />
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
      <Form.Item name="bank_account_number" label="Số tài khoản ngân hàng">
        <Input placeholder="Nhập số tài khoản" />
      </Form.Item>
      <Form.Item name="bank_account_name" label="Tên chủ tài khoản">
        <Input placeholder="Nhập tên chủ tài khoản" />
      </Form.Item>
      <Form.Item name="bank_name" label="Tên ngân hàng">
        <Select
          placeholder="Chọn ngân hàng"
          showSearch
          allowClear
          optionFilterProp="children"
        >
          {VIETNAM_BANKS.map(bank => (
            <Option key={bank} value={bank}>{bank}</Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="date_joined_company" label="Ngày vào làm">
        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
      </Form.Item>
      <Form.Item name="contract_status" label="Trạng thái hợp đồng">
        <Select placeholder="Chọn trạng thái">
          <Option value="PROBATION">Thử việc</Option>
          <Option value="FIXED_TERM">HĐ xác định thời hạn</Option>
          <Option value="INDEFINITE">HĐ không xác định thời hạn</Option>
        </Select>
      </Form.Item>
      {(watchedContractStatus === 'FIXED_TERM' || watchedContractStatus === 'INDEFINITE') && (
        <Form.Item name="contract_start" label="Ngày bắt đầu HĐ">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
        </Form.Item>
      )}
      {watchedContractStatus === 'FIXED_TERM' && (
        <Form.Item name="contract_end" label="Ngày kết thúc HĐ">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
        </Form.Item>
      )}
      <Form.Item name="work_status" label="Trạng thái làm việc">
        <Select placeholder="Chọn trạng thái">
          <Option value="ACTIVE">Đang làm việc</Option>
          <Option value="ON_LEAVE">Tạm nghỉ</Option>
          <Option value="RESIGNED">Đã nghỉ</Option>
        </Select>
      </Form.Item>
    </Form>
  );

  const renderMyProfile = () => {
    if (profileLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
    if (!myProfile) return null;
    const cs = CONTRACT_STATUS_MAP[myProfile.contract_status] || {};
    const ws = WORK_STATUS_MAP[myProfile.work_status] || {};
    const hometown = [myProfile.address_village, myProfile.address_commune, myProfile.address_district, myProfile.address_province].filter(Boolean).join(', ');
    return (
      <Card>
        <Row gutter={[24, 0]} align="middle" style={{ marginBottom: 24 }}>
          <Col flex="none">
            <Avatar
              src={myProfile.avatar_url}
              icon={!myProfile.avatar_url && <UserOutlined />}
              size={80}
              style={{ backgroundColor: myProfile.avatar_url ? undefined : '#1677ff', border: '3px solid #f0f0f0' }}
            />
          </Col>
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>{myProfile.full_name || myProfile.username}</Title>
            <Space size={8} wrap style={{ marginTop: 4 }}>
              {myProfile.position && <Tag color="blue">{myProfile.position}</Tag>}
              {myProfile.department_name && <Tag>{myProfile.department_name}</Tag>}
              {ws.label && <Badge color={ws.color} text={ws.label} />}
            </Space>
          </Col>
          <Col flex="none">
            {cs.label && <Tag color={cs.color}>{cs.label}</Tag>}
          </Col>
        </Row>
        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Username">{myProfile.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{myProfile.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{myProfile.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Số căn cước">{myProfile.id_card_number || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày sinh">{myProfile.date_of_birth || '—'}</Descriptions.Item>
          <Descriptions.Item label="Quê quán">{hometown || '—'}</Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">{myProfile.bank_account_number || '—'}</Descriptions.Item>
          <Descriptions.Item label="Tên chủ TK">{myProfile.bank_account_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngân hàng" span={2}>{myProfile.bank_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày vào làm">{myProfile.date_joined_company || '—'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái HĐ">{CONTRACT_STATUS_MAP[myProfile.contract_status]?.label || myProfile.contract_status || '—'}</Descriptions.Item>
          {myProfile.contract_start && <Descriptions.Item label="Ngày bắt đầu HĐ">{myProfile.contract_start}</Descriptions.Item>}
          {myProfile.contract_end && <Descriptions.Item label="Ngày kết thúc HĐ">{myProfile.contract_end}</Descriptions.Item>}
        </Descriptions>
      </Card>
    );
  };

  const renderMainContent = () => (
    <Card
      title={
        <Space>
          <UserOutlined style={{ fontSize: 20, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>Quản lý nhân viên</Title>
        </Space>
      }
      extra={
        <Space wrap>
          <Input
            placeholder="Tìm kiếm nhân viên..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => fetchEmployees(1, pagination.pageSize)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="Trạng thái LV"
            allowClear
            style={{ width: 150 }}
            value={filters.work_status}
            onChange={(val) => setFilters(prev => ({ ...prev, work_status: val }))}
          >
            <Option value="ACTIVE">Đang làm việc</Option>
            <Option value="ON_LEAVE">Tạm nghỉ</Option>
            <Option value="RESIGNED">Đã nghỉ</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => fetchEmployees(1, pagination.pageSize)}>
            Làm mới
          </Button>
        </Space>
      }
      styles={{ body: { padding: '12px 0' } }}
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={employees}
        columns={columns}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} nhân viên`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1200 }}
        size="middle"
      />
    </Card>
  );

  return (
    <div style={{ padding: '0 4px' }}>
      {!canEditAll && !profileLoading ? (
        // Non-editor: show personal profile + own rewards
        <div>
          <Space style={{ marginBottom: 16 }}>
            <IdcardOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Thông tin nhân viên của tôi</Title>
          </Space>
          {renderMyProfile()}
          <div style={{ marginTop: 24 }}>
            <RewardManagement />
          </div>
        </div>
      ) : (
        // Editor/admin: tabs
        <Tabs
          defaultActiveKey="employees"
          items={[
            {
              key: 'employees',
              label: <span><UserOutlined /> Quản lý nhân viên</span>,
              children: renderMainContent(),
            },
            {
              key: 'rewards',
              label: <span><TrophyOutlined /> Quản lý khen thưởng</span>,
              children: <RewardManagement />,
            },
          ]}
        />
      )}

      <Drawer
        title={drawerMode === 'edit' ? 'Chỉnh sửa thông tin nhân viên' : 'Thông tin nhân viên'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          drawerMode === 'edit' && (
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>Hủy</Button>
              <Button type="primary" loading={saving} onClick={handleSave}>
                Lưu
              </Button>
            </Space>
          )
        }
      >
        {drawerMode === 'view' ? renderViewDrawer() : renderEditForm()}
      </Drawer>
    </div>
  );
}
