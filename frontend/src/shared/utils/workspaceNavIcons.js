import {
  IconAddressBook,
  IconBook,
  IconBuildingMonument,
  IconCertificate,
  IconChecklist,
  IconFileDescription,
  IconGlobe,
  IconHome,
  IconInbox,
  IconInfoCircle,
  IconLink,
  IconLock,
  IconMapPins,
  IconMicroscope,
  IconSchool,
  IconSearch,
  IconSend,
  IconSignature,
  IconUser,
  IconWorld,
} from '@tabler/icons-vue';

const createIconMeta = (icon, tone = 'sky') => ({ icon, tone });

export const workspaceIconToneClass = (tone = 'sky', prefix = 'deasy-nav-item__icon') => `${prefix}--${tone}`;

export const resolveWorkspaceAreaIcon = (name = '') => {
  const normalized = String(name).toLowerCase();
  if (normalized.includes('academ')) return createIconMeta(IconBook, 'amber');
  if (normalized.includes('invest')) return createIconMeta(IconMicroscope, 'violet');
  if (normalized.includes('vincul')) return createIconMeta(IconLink, 'emerald');
  if (normalized.includes('intern')) return createIconMeta(IconWorld, 'sky');
  if (normalized.includes('perfil')) return createIconMeta(IconUser, 'sky');
  if (normalized.includes('firma')) return createIconMeta(IconSignature, 'sky');
  return createIconMeta(IconHome, 'slate');
};

export const resolveWorkspaceSectionIcon = (name = '') => {
  const normalized = String(name).toLowerCase();
  if (normalized.includes('coord')) return createIconMeta(IconBuildingMonument, 'sky');
  if (normalized.includes('docen')) return createIconMeta(IconSchool, 'amber');
  if (normalized.includes('admin')) return createIconMeta(IconLock, 'slate');
  return createIconMeta(IconChecklist, 'sky');
};

export const resolveWorkspaceCargoIcon = (name = '') => {
  const normalized = String(name).toLowerCase();
  if (normalized.includes('docen')) return createIconMeta(IconSchool, 'amber');
  if (normalized.includes('coord')) return createIconMeta(IconBuildingMonument, 'sky');
  if (normalized.includes('admin')) return createIconMeta(IconLock, 'slate');
  return createIconMeta(IconChecklist, 'sky');
};

export const resolveWorkspaceProcessIcon = (process = {}) => {
  const normalized = String(process?.name || '').toLowerCase();
  if (normalized.includes('firma')) return createIconMeta(IconSignature, process?.access_source === 'flow' ? 'emerald' : 'sky');
  if (normalized.includes('perfil')) return createIconMeta(IconUser, 'sky');
  if (normalized.includes('academ')) return createIconMeta(IconBook, 'amber');
  if (normalized.includes('unidad')) return createIconMeta(IconBuildingMonument, 'sky');
  if (normalized.includes('invest')) return createIconMeta(IconMicroscope, 'violet');
  if (normalized.includes('vincul')) return createIconMeta(IconLink, 'emerald');
  if (normalized.includes('intern')) return createIconMeta(IconWorld, 'sky');
  if (normalized.includes('document')) return createIconMeta(IconFileDescription, 'amber');
  if (process?.access_source === 'flow') return createIconMeta(IconSend, 'emerald');
  return createIconMeta(IconChecklist, 'violet');
};

export const resolveWorkspaceUnitGroupIcon = (group = {}) => {
  const label = `${group?.label ?? ''} ${group?.name ?? ''}`.toLowerCase();
  if (label.includes('consol')) return createIconMeta(IconChecklist, 'sky');
  if (label.includes('univers')) return createIconMeta(IconGlobe, 'sky');
  if (label.includes('facult')) return createIconMeta(IconMapPins, 'amber');
  if (label.includes('carrera')) return createIconMeta(IconSchool, 'amber');
  if (label.includes('depart')) return createIconMeta(IconBuildingMonument, 'sky');
  return createIconMeta(IconBuildingMonument, 'sky');
};

export const resolveWorkspaceProfileMenuIcon = (iconName = '', label = '') => {
  const normalizedIcon = String(iconName).toLowerCase();
  const normalizedLabel = String(label).toLowerCase();
  if (normalizedIcon === 'user' || normalizedLabel.includes('inicio')) return createIconMeta(IconHome, 'sky');
  if (normalizedLabel.includes('forma')) return createIconMeta(IconSchool, 'amber');
  if (normalizedLabel.includes('exper')) return createIconMeta(IconChecklist, 'violet');
  if (normalizedLabel.includes('refer')) return createIconMeta(IconAddressBook, 'sky');
  if (normalizedLabel.includes('capac')) return createIconMeta(IconBook, 'emerald');
  if (normalizedLabel.includes('certificaci') && !normalizedLabel.includes('firma')) return createIconMeta(IconCertificate, 'amber');
  if (normalizedLabel.includes('invest')) return createIconMeta(IconMicroscope, 'violet');
  if (normalizedLabel.includes('firma')) return createIconMeta(IconSignature, 'sky');
  if (normalizedIcon === 'info-circle') return createIconMeta(IconInfoCircle, 'slate');
  return createIconMeta(IconChecklist, 'sky');
};

export const resolveWorkspaceAdminGroupIcon = (groupKey = '') => {
  const normalized = String(groupKey).toLowerCase();
  if (normalized.includes('academ')) return createIconMeta(IconSchool, 'amber');
  if (normalized.includes('proceso')) return createIconMeta(IconChecklist, 'violet');
  if (normalized.includes('usuario')) return createIconMeta(IconUser, 'sky');
  if (normalized.includes('contrat')) return createIconMeta(IconFileDescription, 'emerald');
  if (normalized.includes('seguridad')) return createIconMeta(IconLock, 'slate');
  return createIconMeta(IconInbox, 'sky');
};

export const resolveWorkspaceAdminTableIcon = (tableName = '') => {
  const normalized = String(tableName).toLowerCase();
  if (/person|user/.test(normalized)) return createIconMeta(IconUser, 'sky');
  if (/role|permission|security|resource|action/.test(normalized)) return createIconMeta(IconLock, 'slate');
  if (/unit|cargo|position|term|relation/.test(normalized)) return createIconMeta(IconBuildingMonument, 'sky');
  if (/process|task|template|workflow/.test(normalized)) return createIconMeta(IconChecklist, 'violet');
  if (/document|signature/.test(normalized)) return createIconMeta(IconSignature, 'sky');
  if (/contract|vacanc|offer|aplication/.test(normalized)) return createIconMeta(IconFileDescription, 'emerald');
  if (/search|query|filter/.test(normalized)) return createIconMeta(IconSearch, 'sky');
  return createIconMeta(IconInfoCircle, 'slate');
};
