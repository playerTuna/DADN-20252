import type { NavKey } from '../types/dashboard';

export const sidebarItems: {
  key: NavKey;
  label: string;
  icon: 'home' | 'bar-chart-2' | 'share-2';
}[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
  { key: 'devices', label: 'Devices', icon: 'share-2' },
];
