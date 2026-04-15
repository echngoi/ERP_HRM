import { Card, Grid, Space, Tag, Typography } from 'antd';

const { Paragraph, Title, Text } = Typography;

export default function AdminSectionPage({
  title,
  description,
  badge,
  extra,
  children,
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  return (
    <Card bordered={false} style={{ borderRadius: isMobile ? 12 : 20 }} className="admin-section-page">
      <Space direction="vertical" size={isMobile ? 12 : 20} style={{ width: '100%' }}>
        <div className="admin-section-page__head">
          <Space direction="vertical" size={isMobile ? 4 : 8}>
            <Space align="center" size={8} wrap>
              <Title level={isMobile ? 5 : 3} style={{ margin: 0 }}>{title}</Title>
              {badge ? <Tag color="blue">{badge}</Tag> : null}
            </Space>
            {!isMobile && (
              <>
                <Paragraph style={{ marginBottom: 0, maxWidth: 720, color: '#4b5563' }}>
                  {description}
                </Paragraph>
                <Text type="secondary">
                  Dữ liệu bên dưới đang được tải trực tiếp từ API quản trị.
                </Text>
              </>
            )}
          </Space>

          {extra ? <div className="admin-section-page__extra">{extra}</div> : null}
        </div>

        {children}
      </Space>
    </Card>
  );
}
