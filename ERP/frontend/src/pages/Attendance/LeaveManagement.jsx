import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Input,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
  EditOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getLeaveConfig,
  updateLeaveConfig,
  getLeaveBalances,
  updateLeaveBalance,
  getMyLeave,
} from '../../services/attendanceApi';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const CONTRACT_STATUS_OPTIONS = [
  { value: 'PROBATION', label: 'Thử việc' },
  { value: 'FIXED_TERM', label: 'HĐ xác định thời hạn' },
  { value: 'INDEFINITE', label: 'HĐ không xác định thời hạn' },
];

const CONTRACT_STATUS_MAP = {
  PROBATION: { label: 'Thử việc', color: 'orange' },
  FIXED_TERM: { label: 'HĐ xác định thời hạn', color: 'blue' },
  INDEFINITE: { label: 'HĐ không xác định thời hạn', color: 'green' },
};

/* ── My Leave Card (for non-admin employees) ─────────── */
function MyLeaveCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [year, setYear] = useState(dayjs().year());

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyLeave({ year });
      setData(res.data);
    } catch {
      message.error('Không thể tải thông tin nghỉ phép');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  if (!data) return null;

  const totalEntitled = data.total_entitled || 0;
  const carriedOver = parseFloat(data.carried_over_days) || 0;
  const used = parseFloat(data.used_days) || 0;
  const remaining = data.remaining_days ?? (totalEntitled + carriedOver - used);

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Nghỉ phép của tôi</Title>
        <Select value={year} onChange={setYear} style={{ width: 100 }}>
          {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map(y => (
            <Option key={y} value={y}>{y}</Option>
          ))}
        </Select>
        <Button icon={<ReloadOutlined />} onClick={fetch}>Làm mới</Button>
      </Space>
      <Row gutter={[24, 16]}>
        <Col xs={12} sm={6}>
          <Statistic
            title="Phép được hưởng"
            value={totalEntitled}
            suffix="ngày"
            valueStyle={{ color: '#1677ff' }}
          />
        </Col>
        {carriedOver > 0 && (
          <Col xs={12} sm={6}>
            <Statistic
              title="Bảo lưu"
              value={carriedOver}
              suffix="ngày"
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
        )}
        <Col xs={12} sm={6}>
          <Statistic
            title="Đã dùng"
            value={used}
            suffix="ngày"
            valueStyle={{ color: '#cf1322' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="Còn lại"
            value={remaining}
            suffix="ngày"
            valueStyle={{ color: remaining > 0 ? '#3f8600' : '#cf1322' }}
          />
        </Col>
      </Row>
      {data.note && (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Ghi chú: {data.note}</Text>
        </div>
      )}
    </Card>
  );
}

/* ── Balance Table (admin view) ──────────────────────── */
function BalanceTable() {
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState([]);
  const [year, setYear] = useState(dayjs().year());
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState({ open: false, record: null });
  const [editForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeaveBalances({ year });
      setBalances(res.data);
    } catch {
      message.error('Không thể tải danh sách phép');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = useMemo(() => {
    if (!search) return balances;
    const s = search.toLowerCase();
    return balances.filter(b =>
      (b.employee_name || '').toLowerCase().includes(s)
      || (b.username || '').toLowerCase().includes(s)
      || (b.department_name || '').toLowerCase().includes(s)
    );
  }, [balances, search]);

  const openEdit = (record) => {
    setEditModal({ open: true, record });
    editForm.setFieldsValue({
      used_days: parseFloat(record.used_days),
      carried_over_days: parseFloat(record.carried_over_days),
      note: record.note || '',
    });
  };

  const handleSave = async () => {
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await updateLeaveBalance({ id: editModal.record.id, ...values });
      message.success('Cập nhật thành công');
      setEditModal({ open: false, record: null });
      fetch();
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Nhân viên',
      key: 'name',
      width: 180,
      ellipsis: true,
      sorter: (a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      render: (_, r) => (
        <div>
          <Text strong>{r.employee_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.username}</Text>
        </div>
      ),
    },
    {
      title: 'Phòng/Khoa',
      dataIndex: 'department_name',
      key: 'dept',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Trạng thái HĐ',
      dataIndex: 'contract_status',
      key: 'cs',
      width: 180,
      render: (val) => {
        const s = CONTRACT_STATUS_MAP[val];
        return s ? <Tag color={s.color}>{s.label}</Tag> : (val || '—');
      },
    },
    {
      title: 'Ngày BĐ HĐ',
      dataIndex: 'contract_start',
      key: 'start',
      width: 120,
      render: (v) => v || '—',
    },
    {
      title: 'Phép được hưởng',
      dataIndex: 'total_entitled',
      key: 'entitled',
      width: 130,
      align: 'center',
      render: (v) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    {
      title: 'Bảo lưu',
      dataIndex: 'carried_over_days',
      key: 'carry',
      width: 90,
      align: 'center',
      render: (v) => parseFloat(v) > 0 ? <Text style={{ color: '#722ed1' }}>{v}</Text> : '0',
    },
    {
      title: 'Đã dùng',
      dataIndex: 'used_days',
      key: 'used',
      width: 90,
      align: 'center',
      render: (v) => <Text style={{ color: parseFloat(v) > 0 ? '#cf1322' : undefined }}>{v}</Text>,
    },
    {
      title: 'Còn lại',
      dataIndex: 'remaining_days',
      key: 'remain',
      width: 90,
      align: 'center',
      render: (v) => (
        <Text strong style={{ color: v > 0 ? '#3f8600' : '#cf1322' }}>
          {v}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => (
        <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <Space>
            <CalendarOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <span>Danh sách phép nhân viên</span>
          </Space>
        }
        extra={
          <Space wrap>
            <Input
              placeholder="Tìm nhân viên..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
            <Select value={year} onChange={setYear} style={{ width: 100 }}>
              {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map(y => (
                <Option key={y} value={y}>{y}</Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetch}>Làm mới</Button>
          </Space>
        }
        styles={{ body: { padding: '12px 0' } }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} nhân viên` }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>

      <Modal
        title="Cập nhật phép nhân viên"
        open={editModal.open}
        onCancel={() => setEditModal({ open: false, record: null })}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
      >
        {editModal.record && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>{editModal.record.employee_name}</Text>
            <Text type="secondary"> — {editModal.record.department_name}</Text>
          </div>
        )}
        <Form form={editForm} layout="vertical">
          <Form.Item name="used_days" label="Số ngày phép đã dùng" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="carried_over_days" label="Số ngày phép bảo lưu (từ HĐ trước)">
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Ghi chú (nếu có)" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* ── Config Tab (admin only) ─────────────────────────── */
function LeaveConfigTab() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeaveConfig();
      setConfig(res.data);
      form.setFieldsValue(res.data);
    } catch {
      message.error('Không thể tải cấu hình');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await updateLeaveConfig(values);
      setConfig(res.data);
      message.success('Lưu cấu hình thành công');
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <Card
      title={
        <Space>
          <SettingOutlined style={{ fontSize: 18, color: '#1677ff' }} />
          <span>Cấu hình thời gian tính phép</span>
        </Space>
      }
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="start_contract_status"
              label="Trạng thái HĐ bắt đầu tính phép"
              tooltip="Chọn trạng thái hợp đồng làm mốc bắt đầu tính nghỉ phép. Ngày bắt đầu HĐ của trạng thái này sẽ là thời điểm bắt đầu tính phép."
              rules={[{ required: true, message: 'Vui lòng chọn' }]}
            >
              <Select placeholder="Chọn trạng thái hợp đồng">
                {CONTRACT_STATUS_OPTIONS.map(o => (
                  <Option key={o.value} value={o.value}>{o.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="annual_leave_days"
              label="Số ngày phép tối đa/năm"
              rules={[{ required: true, message: 'Vui lòng nhập' }]}
            >
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSave} loading={saving}>
                Lưu cấu hình
              </Button>
            </Form.Item>
          </Form>
        </Col>
        <Col xs={24} md={12}>
          <Card type="inner" title="Quy tắc tính phép" style={{ background: '#fafafa' }}>
            <Descriptions column={1} size="small" bordered={false}>
              <Descriptions.Item label="Đơn vị tính">
                1 tháng làm việc = 1 ngày phép
              </Descriptions.Item>
              <Descriptions.Item label="Quy tắc ngày 15">
                <div>
                  <div>• Bắt đầu HĐ từ <Text strong>ngày 1–15</Text> → <Tag color="green">tháng đó được tính phép</Tag></div>
                  <div>• Bắt đầu HĐ từ <Text strong>ngày 16–31</Text> → <Tag color="orange">tháng đó KHÔNG tính phép</Tag></div>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Bảo lưu phép">
                Khi chuyển từ HĐ xác định thời hạn → HĐ không xác định thời hạn: số phép còn lại được bảo lưu, cộng vào phép của HĐ mới.
              </Descriptions.Item>
              <Descriptions.Item label="Tối đa/năm">
                {config?.annual_leave_days || 12} ngày
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </Card>
  );
}

/* ── Main Page ───────────────────────────────────────── */
export default function LeaveManagement() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  if (!isAdmin) {
    return (
      <div style={{ padding: '0 4px' }}>
        <MyLeaveCard />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <Tabs
        defaultActiveKey="balances"
        items={[
          {
            key: 'balances',
            label: <span><CalendarOutlined /> Số phép nhân viên</span>,
            children: <BalanceTable />,
          },
          {
            key: 'config',
            label: <span><SettingOutlined /> Cấu hình thời gian tính phép</span>,
            children: <LeaveConfigTab />,
          },
        ]}
      />
    </div>
  );
}
