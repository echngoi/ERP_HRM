import { useEffect, useState } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  ColorPicker,
  DatePicker,
  Form,
  Grid,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from '../../services/announcementApi';

const { Text } = Typography;

const FONT_OPTIONS = [
  { value: 'inherit', label: 'Mặc định (hệ thống)' },
  { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
];

function colorToHex(c) {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && c.toHexString) return c.toHexString();
  return '#1677ff';
}

export default function AnnouncementConfigPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    getAnnouncements()
      .then(r => setData(r.data?.results || r.data || []))
      .catch(() => message.error('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      content: '',
      is_active: true,
      start_date: null,
      end_date: null,
      font_family: 'inherit',
      font_size: 14,
      text_color: '#ffffff',
      bg_color: '#1677ff',
      speed: 20,
      priority: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      values.text_color = colorToHex(values.text_color);
      values.bg_color = colorToHex(values.bg_color);
      values.start_date = values.start_date ? values.start_date.toISOString() : null;
      values.end_date = values.end_date ? values.end_date.toISOString() : null;
      setSaving(true);
      if (editing) {
        await updateAnnouncement(editing.id, values);
        message.success('Đã cập nhật');
      } else {
        await createAnnouncement(values);
        message.success('Đã tạo thông báo');
      }
      setModalOpen(false);
      load();
    } catch {
      /* validation */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteAnnouncement(id);
    message.success('Đã xóa');
    load();
  };

  const handleToggle = async (record, checked) => {
    await updateAnnouncement(record.id, { is_active: checked });
    load();
  };

  const columns = [
    {
      title: 'Nội dung',
      dataIndex: 'content',
      ellipsis: true,
      width: '35%',
      render: (text, rec) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 24,
              borderRadius: 3,
              background: rec.bg_color || '#1677ff',
              flexShrink: 0,
            }}
          />
          <Text
            style={{
              fontFamily: rec.font_family || 'inherit',
              color: rec.text_color || '#000',
              background: rec.bg_color || '#1677ff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 13,
              maxWidth: 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}
          >
            {text}
          </Text>
        </div>
      ),
    },
    {
      title: 'Font',
      dataIndex: 'font_family',
      width: 140,
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || 'Mặc định'}</Text>,
    },
    {
      title: 'Cỡ',
      dataIndex: 'font_size',
      width: 60,
      align: 'center',
      render: v => `${v}px`,
    },
    {
      title: 'Tốc độ',
      dataIndex: 'speed',
      width: 70,
      align: 'center',
      render: v => `${v}s`,
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      width: 70,
      align: 'center',
    },
    {
      title: 'Lịch hiển thị',
      key: 'schedule',
      width: 180,
      render: (_, rec) => {
        if (!rec.start_date && !rec.end_date) return <Text type="secondary" style={{ fontSize: 12 }}>Không giới hạn</Text>;
        const fmt = 'DD/MM/YY HH:mm';
        return (
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            {rec.start_date && <div>Từ: {dayjs(rec.start_date).format(fmt)}</div>}
            {rec.end_date && <div>Đến: {dayjs(rec.end_date).format(fmt)}</div>}
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      width: 100,
      align: 'center',
      render: (val, rec) => (
        <Switch
          checked={val}
          onChange={(checked) => handleToggle(rec, checked)}
          checkedChildren="BẬT"
          unCheckedChildren="TẮT"
          size="small"
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, rec) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          <Popconfirm title="Xóa thông báo này?" onConfirm={() => handleDelete(rec.id)} okText="Xóa" cancelText="Huỷ">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 4 }}>
      <Card
        title="Quản lý thông báo chạy (Marquee)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm thông báo
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editing ? 'Chỉnh sửa thông báo' : 'Thêm thông báo mới'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Huỷ"
        width={isMobile ? '100%' : 580}
        className={isMobile ? 'erp-modal-mobile' : ''}
        style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="content"
            label="Nội dung thông báo"
            rules={[{ required: true, message: 'Nhập nội dung' }]}
          >
            <Input.TextArea rows={3} placeholder="Nhập nội dung thông báo..." maxLength={500} showCount />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="font_family" label="Font chữ">
              <Select options={FONT_OPTIONS} />
            </Form.Item>
            <Form.Item name="font_size" label="Cỡ chữ (px)">
              <InputNumber min={10} max={30} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="text_color" label="Màu chữ">
              <ColorPicker format="hex" showText />
            </Form.Item>
            <Form.Item name="bg_color" label="Màu nền">
              <ColorPicker format="hex" showText />
            </Form.Item>
            <Form.Item name="speed" label="Tốc độ (giây)">
              <InputNumber min={5} max={120} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="priority" label="Thứ tự ưu tiên">
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
              <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="start_date" label="Bắt đầu hiển thị">
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Không giới hạn" />
            </Form.Item>
            <Form.Item name="end_date" label="Kết thúc hiển thị">
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Không giới hạn" />
            </Form.Item>
          </div>

          {/* Preview */}
          <Form.Item noStyle shouldUpdate>
            {() => {
              const values = form.getFieldsValue();
              const bgColor = colorToHex(values.bg_color) || '#1677ff';
              const txtColor = colorToHex(values.text_color) || '#fff';
              return (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Xem trước:</Text>
                  <div
                    style={{
                      background: bgColor,
                      borderRadius: 8,
                      padding: '8px 14px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        color: txtColor,
                        fontFamily: values.font_family || 'inherit',
                        fontSize: values.font_size ? `${values.font_size}px` : '14px',
                      }}
                    >
                      {values.content || 'Nội dung thông báo sẽ hiển thị ở đây...'}
                    </span>
                  </div>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
