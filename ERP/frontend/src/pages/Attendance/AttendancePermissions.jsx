import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Select, Switch, Space, Tag, Typography, Grid, message, Popconfirm, Tabs,
  Descriptions, Empty,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, UserOutlined, BankOutlined, SafetyOutlined, LinkOutlined,
} from '@ant-design/icons';
import {
  getAttendancePermissions, bulkAttendancePermissions, deleteAttendancePermission,
  getEmployees, updateEmployeeMapping,
} from '../../services/attendanceApi';
import api from '../../services/api';

const { Title } = Typography;

/** Khớp menu Chấm công trong App.jsx */
const PAGE_OPTIONS = [
  { value: 'dashboard', label: 'Tổng quan chấm công' },
  { value: 'live', label: 'Giám sát trực tiếp' },
  { value: 'logs', label: 'Lịch sử chấm công' },
  { value: 'monthly', label: 'Bảng chấm công tháng' },
  { value: 'employees', label: 'Nhân viên chấm công' },
  { value: 'report', label: 'Báo cáo chấm công' },
  { value: 'device', label: 'Thiết bị & Cài đặt' },
  { value: 'permissions', label: 'Phân quyền chấm công' },
  { value: 'shifts', label: 'Quản lý ca' },
];

const ALL_PAGE_VALUES = PAGE_OPTIONS.map((o) => o.value);

/* ── Attendance Permissions Tab ─────────────────────────── */
function PermissionsTab() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form] = Form.useForm();
  const [grantType, setGrantType] = useState('user');
  const [submitting, setSubmitting] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAttendancePermissions();
      setPermissions(res.data.results || []);
    } catch {
      message.error('Không thể tải danh sách phân quyền');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        api.get('/users/lookup/'),
        api.get('/departments/', { params: { page_size: 9999 } }),
      ]);
      setUsers(uRes.data || []);
      setDepartments(dRes.data?.results || dRes.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchPermissions(); fetchLookups(); }, [fetchPermissions, fetchLookups]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const pages = values.pages || [];
      if (pages.length === 0) {
        message.warning('Chọn ít nhất một trang trong menu Chấm công');
        return;
      }
      const payload = {
        pages,
        can_view_all: values.can_view_all || false,
      };
      if (grantType === 'user') {
        payload.user = values.user;
      } else {
        payload.department = values.department;
      }
      setSubmitting(true);
      const res = await bulkAttendancePermissions(payload);
      const n = res.data?.results?.length ?? pages.length;
      message.success(`Đã phân quyền cho ${n} trang`);
      setModalOpen(false);
      form.resetFields();
      fetchPermissions();
    } catch (err) {
      if (err?.response?.data) {
        const d = err.response.data;
        message.error(typeof d === 'string' ? d : (d.error || JSON.stringify(d)));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAttendancePermission(id);
      message.success('Đã xóa phân quyền');
      fetchPermissions();
    } catch {
      message.error('Không thể xóa');
    }
  };

  const columns = [
    {
      title: 'Đối tượng',
      key: 'target',
      render: (_, r) => r.user
        ? <span><UserOutlined /> {r.user_name || r.username}</span>
        : <span><BankOutlined /> {r.department_name}</span>,
    },
    { title: 'Trang', dataIndex: 'page_display', key: 'page' },
    {
      title: 'Xem tất cả',
      dataIndex: 'can_view_all',
      key: 'can_view_all',
      render: v => v ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Popconfirm title="Xóa phân quyền này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Phân thêm quyền
        </Button>
      </div>
      <Table
        dataSource={permissions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 500 }}
        locale={{ emptyText: <Empty description="Chưa có phân quyền nào" /> }}
      />

      <Modal
        title="Phân thêm quyền truy cập — Chấm công"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Áp dụng"
        cancelText="Hủy"
        confirmLoading={submitting}
        width={isMobile ? '100%' : undefined}
        className={isMobile ? 'erp-modal-mobile' : ''}
        style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
      >
        <Form form={form} layout="vertical" initialValues={{ pages: [] }}>
          <Form.Item label="Phân quyền cho">
            <Select value={grantType} onChange={setGrantType}
              options={[
                { value: 'user', label: 'Nhân viên' },
                { value: 'department', label: 'Phòng ban' },
              ]}
            />
          </Form.Item>
          {grantType === 'user' ? (
            <Form.Item name="user" label="Nhân viên" rules={[{ required: true, message: 'Chọn nhân viên' }]}>
              <Select placeholder="Chọn nhân viên" showSearch optionFilterProp="label"
                options={users.map(u => ({ value: u.id, label: `${u.full_name || u.username} (${u.username})` }))}
              />
            </Form.Item>
          ) : (
            <Form.Item name="department" label="Phòng ban" rules={[{ required: true, message: 'Chọn phòng ban' }]}>
              <Select placeholder="Chọn phòng ban" showSearch optionFilterProp="label"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="pages"
            label="Trang trong menu Chấm công"
            rules={[
              { required: true, message: 'Chọn ít nhất một trang' },
              { type: 'array', min: 1, message: 'Chọn ít nhất một trang' },
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Chọn một hoặc nhiều trang"
              options={PAGE_OPTIONS}
              maxTagCount="responsive"
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item>
            <Space wrap>
              <Button type="link" size="small" style={{ padding: 0 }}
                onClick={() => form.setFieldsValue({ pages: [...ALL_PAGE_VALUES] })}>
                Chọn tất cả trang Chấm công
              </Button>
              <Button type="link" size="small" style={{ padding: 0 }}
                onClick={() => form.setFieldsValue({ pages: [] })}>
                Bỏ chọn
              </Button>
            </Space>
          </Form.Item>
          <Form.Item name="can_view_all" label="Cho phép xem tất cả nhân viên (áp dụng cho các trang đã chọn)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* ── Employee Mapping Tab ───────────────────────────────── */
function MappingTab() {
  const [users, setUsers] = useState([]);
  const [attEmployees, setAttEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, eRes] = await Promise.all([
        api.get('/users/', { params: { page_size: 9999 } }),
        getEmployees(),
      ]);
      setUsers(uRes.data?.results || []);
      setAttEmployees(eRes.data?.results || []);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMapping = async (erpUserId, deviceEmployeeId) => {
    try {
      await updateEmployeeMapping({
        user_id: erpUserId,
        attendance_employee_id: deviceEmployeeId || null,
      });
      message.success('Đã cập nhật liên kết');
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Lỗi khi cập nhật');
    }
  };

  const columns = [
    {
      title: 'Tài khoản',
      key: 'user',
      render: (_, r) => <span>{r.full_name || r.username} <Tag>{r.username}</Tag></span>,
    },
    { title: 'Phòng ban', dataIndex: 'department_name', key: 'dept' },
    {
      title: 'Nhân viên chấm công',
      key: 'mapping',
      width: 320,
      render: (_, r) => (
        <Select
          allowClear
          placeholder="Chọn nhân viên máy chấm công"
          style={{ width: '100%' }}
          value={r.attendance_employee || undefined}
          onChange={val => handleMapping(r.id, val ? attEmployees.find(e => e.id === val)?.user_id : null)}
          showSearch
          optionFilterProp="label"
          options={attEmployees.map(e => ({ value: e.id, label: `${e.user_id} - ${e.name}` }))}
        />
      ),
    },
    {
      title: 'Mã CC',
      key: 'att_uid',
      width: 100,
      render: (_, r) => r.attendance_employee_uid || <Tag color="default">Chưa gán</Tag>,
    },
  ];

  return (
    <Table
      dataSource={users}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: t => `Tổng: ${t} tài khoản` }}
      size="small"
      scroll={{ x: 600 }}
    />
  );
}

/* ── Main Page ────────────────────────────────────────── */
export default function AttendancePermissions() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <SafetyOutlined /> Phân quyền & Liên kết chấm công
      </Title>
      <Card>
        <Tabs
          defaultActiveKey="permissions"
          items={[
            {
              key: 'permissions',
              label: <span><SafetyOutlined /> Phân quyền truy cập</span>,
              children: <PermissionsTab />,
            },
            {
              key: 'mapping',
              label: <span><LinkOutlined /> Liên kết tài khoản ↔ Máy chấm công</span>,
              children: <MappingTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
