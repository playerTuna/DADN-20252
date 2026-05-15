import type { NavKey } from '../types/dashboard';

export const sidebarItems: {
  key: NavKey;
  label: string;
  icon: 'home' | 'bar-chart-2' | 'share-2' | 'clock';
}[] = [
  { key: 'home', label: 'Trang chủ', icon: 'home' },
  { key: 'analytics', label: 'Phân tích', icon: 'bar-chart-2' },
  { key: 'devices', label: 'Thiết bị', icon: 'share-2' },
  { key: 'automation', label: 'Tự động hóa', icon: 'clock' },
];
