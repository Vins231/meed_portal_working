export interface UserPermissions {
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_move_to_tender: boolean;
  can_award: boolean;
  can_view_reports: boolean;
  can_view_all_divisions: boolean;
  own_division?: string;
  modules: string[];
}

const ROLE_DEFAULTS: Record<string, UserPermissions> = {
  SuperAdmin: {
    can_add: true, can_edit: true, can_delete: true,
    can_move_to_tender: true, can_award: true,
    can_view_reports: true, can_view_all_divisions: true,
    modules: ['planning','approval','tender','awarded',
              'bg','reports','activity','admin','calendar']
  },
  Admin: {
    can_add: true, can_edit: true, can_delete: true,
    can_move_to_tender: true, can_award: true,
    can_view_reports: true, can_view_all_divisions: true,
    modules: ['planning','approval','tender','awarded',
              'bg','reports','activity','admin','calendar']
  },
  Manager: {
    can_add: true, can_edit: true, can_delete: false,
    can_move_to_tender: true, can_award: true,
    can_view_reports: true, can_view_all_divisions: false,
    modules: ['planning','approval','tender','awarded',
              'bg','reports','calendar']
  },
  Engineer: {
    can_add: true, can_edit: true, can_delete: false,
    can_move_to_tender: false, can_award: false,
    can_view_reports: true, can_view_all_divisions: false,
    modules: ['planning','approval','tender','awarded',
              'bg','reports','calendar']
  },
  Viewer: {
    can_add: false, can_edit: false, can_delete: false,
    can_move_to_tender: false, can_award: false,
    can_view_reports: true, can_view_all_divisions: true,
    modules: ['planning','approval','tender','awarded',
              'bg','reports','calendar']
  },
  Agency: {
    can_add: false, can_edit: false, can_delete: false,
    can_move_to_tender: false, can_award: false,
    can_view_reports: false, can_view_all_divisions: false,
    modules: ['awarded']
  }
};

export const getPermissions = (user: any): UserPermissions => {
  if (!user) return ROLE_DEFAULTS.Viewer;
  if (user.role === 'SuperAdmin') 
    return ROLE_DEFAULTS.SuperAdmin;
  const defaults = ROLE_DEFAULTS[user.role] 
    || ROLE_DEFAULTS.Viewer;
  if (user.permissions && 
      Object.keys(user.permissions).length > 0) {
    return { ...defaults, ...user.permissions };
  }
  return defaults;
};

export const canDo = {
  add: (user: any): boolean =>
    getPermissions(user).can_add,

  edit: (user: any, record?: any): boolean => {
    if (!user) return false;
    if (user.role === 'SuperAdmin' || 
        user.role === 'Admin') return true;
    const p = getPermissions(user);
    if (!p.can_edit) return false;
    if (record && !p.can_view_all_divisions) {
      if (record.division && 
          record.division !== user.division) 
        return false;
    }
    return true;
  },

  delete: (user: any): boolean =>
    getPermissions(user).can_delete,

  moveToTender: (user: any): boolean =>
    getPermissions(user).can_move_to_tender,

  award: (user: any): boolean =>
    getPermissions(user).can_award,

  viewModule: (user: any, module: string): boolean => {
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    return getPermissions(user).modules.includes(module);
  },
};
