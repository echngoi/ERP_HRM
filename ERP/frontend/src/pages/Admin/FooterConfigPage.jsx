import { useEffect, useState } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FacebookOutlined,
  GlobalOutlined,
  InstagramOutlined,
  LinkedinOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TwitterOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  createFooterItem,
  deleteFooterItem,
  getFooterItems,
  updateFooterItem,
} from '../../services/footerApi';

const { Text } = Typography;

const SECTION_OPTIONS = [
  { value: 'CONTACT', label: 'Thông tin liên hệ', color: 'blue' },
  { value: 'COPYRIGHT', label: 'Bản quyền', color: 'default' },
  { value: 'SOCIAL', label: 'Mạng xã hội', color: 'purple' },
  { value: 'PARTNER', label: 'Đối tác', color: 'gold' },
  { value: 'CERTIFICATION', label: 'Chứng nhận', color: 'green' },
];

const SECTION_MAP = Object.fromEntries(SECTION_OPTIONS.map(s => [s.value, s]));

const ICON_OPTIONS = [
  { value: '', label: '(Không có icon)' },
  { value: 'EnvironmentOutlined', label: '📍 Địa chỉ' },
  { value: 'PhoneOutlined', label: '📞 Điện thoại' },
  { value: 'MailOutlined', label: '✉️ Email' },
  { value: 'GlobalOutlined', label: '🌐 Website' },
  { value: 'FacebookOutlined', label: 'Facebook' },
  { value: 'TwitterOutlined', label: 'Twitter' },
  { value: 'InstagramOutlined', label: 'Instagram' },
  { value: 'LinkedinOutlined', label: 'LinkedIn' },
  { value: 'YoutubeOutlined', label: 'YouTube' },
  { value: 'SafetyCertificateOutlined', label: '🛡️ Chứng nhận' },
];

export default function FooterConfigPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    getFooterItems()
      .then(r => setData(r.data?.results || r.data || []))
      .catch(() => message.error('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = (section) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      section: section !== 'ALL' ? section : 'CONTACT',
      label: '',
      value: '',
      icon: '',
      image_url: '',
      is_active: true,
      sort_order: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({ ...record });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await updateFooterItem(editing.id, values);
        message.success('Đã cập nhật');
      } else {
        await createFooterItem(values);
        message.success('Đã tạo mục mới');
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
    await deleteFooterItem(id);
    message.success('Đã xóa');
    load();
  };

  const handleToggle = async (record, checked) => {
    await updateFooterItem(record.id, { is_active: checked });
    load();
  };

  const filtered = activeTab === 'ALL' ? data : data.filter(i => i.section === activeTab);

  const columns = [
    {
      title: 'Phân loại',
      dataIndex: 'section',
      width: 140,
      render: v => {
        const s = SECTION_MAP[v];
        return s ? <Tag color={s.color}>{s.label}</Tag> : v;
      },
    },
    {
      title: 'Nhãn',
      dataIndex: 'label',
      ellipsis: true,
      width: '25%',
      render: (text, rec) => (
        <Space size={6}>
          {rec.icon && <span style={{ color: '#3b82f6' }}>{getIconNode(rec.icon)}</span>}
          <Text strong style={{ fontSize: 13 }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Giá trị / URL',
      dataIndex: 'value',
      ellipsis: true,
    },
    {
      title: 'Ảnh',
      dataIndex: 'image_url',
      width: 80,
      align: 'center',
      render: v => v ? <img src={v} alt="" style={{ height: 28, borderRadius: 4 }} /> : '-',
    },
    {
      title: 'Thứ tự',
      dataIndex: 'sort_order',
      width: 70,
      align: 'center',
    },
    {
      title: 'Hiển thị',
      dataIndex: 'is_active',
      width: 90,
      align: 'center',
      render: (val, rec) => (
        <Switch
          checked={val}
          onChange={checked => handleToggle(rec, checked)}
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
          <Popconfirm title="Xóa mục này?" onConfirm={() => handleDelete(rec.id)} okText="Xóa" cancelText="Huỷ">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sectionVal = Form.useWatch('section', form);

  const tabItems = [
    { key: 'ALL', label: `Tất cả (${data.length})` },
    ...SECTION_OPTIONS.map(s => ({
      key: s.value,
      label: `${s.label} (${data.filter(i => i.section === s.value).length})`,
    })),
  ];

  return (
    <div style={{ padding: 4 }}>
      <Card
        title="Quản lý Footer"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(activeTab)}>
            Thêm mục
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
          style={{ marginBottom: 8 }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      <Modal
        title={editing ? 'Chỉnh sửa mục footer' : 'Thêm mục footer'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Huỷ"
        width={540}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="section"
            label="Phân loại"
            rules={[{ required: true, message: 'Chọn phân loại' }]}
          >
            <Select options={SECTION_OPTIONS.map(s => ({ value: s.value, label: s.label }))} />
          </Form.Item>

          <Form.Item
            name="label"
            label="Nhãn hiển thị"
            rules={[{ required: true, message: 'Nhập nhãn' }]}
          >
            <Input placeholder="VD: Địa chỉ công ty, Facebook, SSL Certificate..." maxLength={200} />
          </Form.Item>

          <Form.Item
            name="value"
            label={sectionVal === 'SOCIAL' ? 'URL liên kết' : sectionVal === 'COPYRIGHT' ? 'Nội dung bản quyền' : 'Giá trị / URL'}
          >
            <Input.TextArea
              rows={2}
              placeholder={
                sectionVal === 'SOCIAL' ? 'https://facebook.com/...' :
                sectionVal === 'COPYRIGHT' ? '© 2026 Công ty ABC. All rights reserved.' :
                sectionVal === 'CONTACT' ? 'Số 123, Đường ABC, Quận 1, TP.HCM' :
                'Nhập giá trị...'
              }
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="icon" label="Icon">
              <Select options={ICON_OPTIONS} allowClear placeholder="Chọn icon" />
            </Form.Item>
            <Form.Item name="sort_order" label="Thứ tự sắp xếp">
              <InputNumber min={0} max={999} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          {(sectionVal === 'PARTNER' || sectionVal === 'CERTIFICATION') && (
            <Form.Item name="image_url" label="URL ảnh / logo">
              <Input placeholder="https://example.com/logo.png" />
            </Form.Item>
          )}

          <Form.Item name="is_active" label="Hiển thị" valuePropName="checked">
            <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

const ICON_NODES = {
  EnvironmentOutlined: <EnvironmentOutlined />,
  PhoneOutlined: <PhoneOutlined />,
  MailOutlined: <MailOutlined />,
  GlobalOutlined: <GlobalOutlined />,
  FacebookOutlined: <FacebookOutlined />,
  TwitterOutlined: <TwitterOutlined />,
  InstagramOutlined: <InstagramOutlined />,
  LinkedinOutlined: <LinkedinOutlined />,
  YoutubeOutlined: <YoutubeOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
};

function getIconNode(name) {
  return ICON_NODES[name] || null;
}
