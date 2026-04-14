import { useEffect, useState } from 'react';
import {
  EnvironmentOutlined,
  FacebookOutlined,
  GlobalOutlined,
  InstagramOutlined,
  LinkedinOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  TwitterOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import { getActiveFooterItems } from '../services/footerApi';
import './AppFooter.css';

const ICON_MAP = {
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

function getIcon(name) {
  return ICON_MAP[name] || null;
}

export default function AppFooter() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getActiveFooterItems()
      .then(r => setItems(r.data?.results || r.data || []))
      .catch(() => {});
  }, []);

  if (!items.length) return null;

  const contacts = items.filter(i => i.section === 'CONTACT');
  const copyrights = items.filter(i => i.section === 'COPYRIGHT');
  const socials = items.filter(i => i.section === 'SOCIAL');
  const partners = items.filter(i => i.section === 'PARTNER');
  const certs = items.filter(i => i.section === 'CERTIFICATION');

  return (
    <footer className="erp-footer">
      <div className="erp-footer__inner">
        {/* Row 1: Contact + Social */}
        <div className="erp-footer__top">
          {contacts.length > 0 && (
            <div className="erp-footer__section erp-footer__contact">
              <h4 className="erp-footer__heading">Liên hệ</h4>
              <ul className="erp-footer__list">
                {contacts.map(c => (
                  <li key={c.id} className="erp-footer__list-item">
                    {c.icon && <span className="erp-footer__icon">{getIcon(c.icon)}</span>}
                    <span>{c.value || c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {socials.length > 0 && (
            <div className="erp-footer__section erp-footer__social">
              <h4 className="erp-footer__heading">Kết nối</h4>
              <div className="erp-footer__social-icons">
                {socials.map(s => (
                  <a
                    key={s.id}
                    href={s.value || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="erp-footer__social-link"
                    title={s.label}
                  >
                    {s.icon ? getIcon(s.icon) : <GlobalOutlined />}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Partners + Certifications */}
        {(partners.length > 0 || certs.length > 0) && (
          <div className="erp-footer__middle">
            {partners.length > 0 && (
              <div className="erp-footer__section">
                <h4 className="erp-footer__heading">Đối tác</h4>
                <div className="erp-footer__logos">
                  {partners.map(p => (
                    <div key={p.id} className="erp-footer__logo-item" title={p.label}>
                      {p.image_url
                        ? <img src={p.image_url} alt={p.label} className="erp-footer__logo-img" />
                        : <span className="erp-footer__logo-text">{p.label}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
            {certs.length > 0 && (
              <div className="erp-footer__section">
                <h4 className="erp-footer__heading">Chứng nhận</h4>
                <div className="erp-footer__logos">
                  {certs.map(c => (
                    <div key={c.id} className="erp-footer__logo-item" title={c.label}>
                      {c.image_url
                        ? <img src={c.image_url} alt={c.label} className="erp-footer__logo-img" />
                        : (
                          <span className="erp-footer__cert-badge">
                            <SafetyCertificateOutlined />
                            <span>{c.label}</span>
                          </span>
                        )
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Copyright */}
        {copyrights.length > 0 && (
          <div className="erp-footer__bottom">
            {copyrights.map(c => (
              <span key={c.id} className="erp-footer__copyright">{c.value || c.label}</span>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
