import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import logoUrl from '../../../Frontend/assets/images/logo.png';
import { logout } from '../services/auth';
import { formatAlertBadge, getHomeAlertCount } from '../utils/homeAlertBadge';

const navItems = [
  { to: '/home', label: 'Trang chủ', icon: 'H' },
  { to: '/devices', label: 'Thiết bị', icon: 'D' },
  { to: '/analytics', label: 'Phân tích', icon: 'A' },
  { to: '/automation', label: 'Tự động hóa', icon: '⚙' },
  { to: '/settings', label: 'Cài đặt', icon: 'S' },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [alertCount, setAlertCount] = useState(() => getHomeAlertCount());

  useEffect(() => {
    const syncBadge = () => setAlertCount(getHomeAlertCount());
    syncBadge();
    const timer = window.setInterval(syncBadge, 2000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-row">
            <img className="brand-logo" src={logoUrl} alt="Smart Farm" />
            <span className="brand-name">Smart Farm</span>
          </div>

          <nav className="side-nav" aria-label="Điều hướng chính">
            {navItems.map((item) => {
              const badge =
                item.to === '/home' && alertCount > 0 ? formatAlertBadge(alertCount) : null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {badge ? (
                    <span className="nav-badge" aria-label={`${alertCount} cảnh báo`}>
                      {badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Đăng xuất
        </button>
      </aside>

      <main className="app-main">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
