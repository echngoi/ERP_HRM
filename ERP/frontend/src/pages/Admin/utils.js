export function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

export function formatRoleLabel(role) {
  if (!role) return '-';
  return String(role).toUpperCase();
}

const ROLE_LABELS = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  staff: 'Nhân viên',
};

export function formatRoleDisplayName(role) {
  const normalized = String(role || '').toLowerCase();
  return ROLE_LABELS[normalized] || (normalized ? normalized : '-');
}

export function formatBooleanStatus(value) {
  return value ? 'Đang hoạt động' : 'Đã khóa';
}

export { ROLE_LABELS };

