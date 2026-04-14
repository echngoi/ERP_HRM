import { useEffect, useState } from 'react';
import { Button, Card, Col, message, Row, Space, Spin, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { getSiteConfigAdmin, uploadSiteLogo } from '../../services/siteConfigApi';

const { Title, Text } = Typography;

const LOGO_KEYS = [
  { key: 'login_logo', label: 'Logo trang đăng nhập', desc: 'Hiển thị ở trang Login và sidebar. Khuyến nghị: PNG/SVG, tối đa 2MB.' },
  { key: 'favicon', label: 'Logo tab trình duyệt (Favicon)', desc: 'Icon hiển thị trên tab trình duyệt. Khuyến nghị: SVG/ICO/PNG, kích thước 32×32 hoặc lớn hơn.' },
];

export default function LogoConfigPage() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});

  const load = () => {
    setLoading(true);
    getSiteConfigAdmin()
      .then(res => {
        const map = {};
        (Array.isArray(res.data) ? res.data : []).forEach(c => { map[c.key] = c; });
        setConfigs(map);
      })
      .catch(() => message.error('Không thể tải cấu hình'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (key, file) => {
    setUploading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await uploadSiteLogo(key, file);
      message.success('Tải lên thành công');
      setConfigs(prev => ({ ...prev, [key]: res.data }));
    } catch (err) {
      message.error(err?.response?.data?.detail || 'Tải lên thất bại');
    } finally {
      setUploading(prev => ({ ...prev, [key]: false }));
    }
    return false; // prevent default upload
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4}>Cấu hình Logo doanh nghiệp</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Tải lên logo để thay đổi hình ảnh thương hiệu trên hệ thống ERP.
      </Text>
      <Row gutter={[24, 24]}>
        {LOGO_KEYS.map(({ key, label, desc }) => {
          const config = configs[key];
          const imageUrl = config?.image_url;
          return (
            <Col xs={24} md={12} key={key}>
              <Card title={label} bordered>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>{desc}</Text>
                {imageUrl && (
                  <div style={{
                    marginBottom: 16,
                    padding: 16,
                    background: key === 'login_logo' ? 'linear-gradient(135deg, #0f172a, #1e3a8a)' : '#f0f2f5',
                    borderRadius: 12,
                    textAlign: 'center',
                  }}>
                    <img
                      src={imageUrl}
                      alt={label}
                      style={{
                        maxWidth: key === 'favicon' ? 48 : 200,
                        maxHeight: key === 'favicon' ? 48 : 120,
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                )}
                <Upload
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                  showUploadList={false}
                  beforeUpload={(file) => handleUpload(key, file)}
                >
                  <Button icon={<UploadOutlined />} loading={uploading[key]}>
                    {imageUrl ? 'Thay đổi' : 'Tải lên'}
                  </Button>
                </Upload>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
