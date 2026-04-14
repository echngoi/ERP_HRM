import { useEffect, useState } from 'react';
import { SoundOutlined } from '@ant-design/icons';
import { getActiveAnnouncements } from '../services/announcementApi';
import './AnnouncementMarquee.css';

export default function AnnouncementMarquee() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getActiveAnnouncements()
      .then(r => setItems(r.data || []))
      .catch(() => {});
    const timer = setInterval(() => {
      getActiveAnnouncements()
        .then(r => setItems(r.data || []))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!items.length) return null;

  const first = items[0];
  const allText = items.map(i => i.content).join('   ●   ');

  return (
    <div
      className="announcement-marquee"
      style={{ background: first.bg_color || '#1677ff' }}
    >
      <span className="announcement-marquee__icon" style={{ color: first.text_color || '#fff' }}>
        <SoundOutlined />
      </span>
      <div className="announcement-marquee__track">
        <span
          className="announcement-marquee__text"
          style={{
            color: first.text_color || '#fff',
            fontFamily: first.font_family || 'inherit',
            fontSize: first.font_size ? `${first.font_size}px` : '14px',
            animationDuration: `${first.speed || 20}s`,
          }}
        >
          {allText}
        </span>
      </div>
    </div>
  );
}
