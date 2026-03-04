import { checkGuildPermissions, fetchGuildMember, fetchGuildRoles } from './discord.js';

const PERMISSION_FLAGS = {
  ADMINISTRATOR: 0x00000008n,
  MANAGE_GUILD: 0x00000020n,
  MANAGE_CHANNELS: 0x00000010n,
  MANAGE_ROLES: 0x10000000n,
  MANAGE_MESSAGES: 0x00002000n,
  KICK_MEMBERS: 0x00000002n,
  BAN_MEMBERS: 0x00000004n,
  VIEW_AUDIT_LOG: 0x00000080n,
  MODERATE_MEMBERS: 0x0000010000000000n,
  MANAGE_WEBHOOKS: 0x80000000n,
  MANAGE_GUILD_EXPRESSIONS: 0x40000000n,
  CREATE_GUILD_EXPRESSIONS: 0x0000080000000000n,
  VIEW_GUILD_ANALYTICS: 0x0000200000000000n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 0x0000400000000000n,
  READ_MESSAGE_HISTORY: 0x00010000n,
  MENTION_EVERYONE: 0x00020000n,
  USE_EXTERNAL_EMOJIS: 0x00040000n,
  ADD_REACTIONS: 0x00000040n,
  CONNECT: 0x00100000n,
  SPEAK: 0x00200000n,
  MUTE_MEMBERS: 0x00400000n,
  DEAFEN_MEMBERS: 0x00800000n,
  MOVE_MEMBERS: 0x01000000n,
  USE_VAD: 0x02000000n,
  PRIORITY_SPEAKER: 0x00000100n,
  STREAM: 0x00000200n,
  CHANGE_NICKNAME: 0x04000000n,
  MANAGE_NICKNAMES: 0x08000000n,
  USE_APPLICATION_COMMANDS: 0x8000000000n,
  REQUEST_TO_SPEAK: 0x0100000000n,
  USE_EMBEDDED_ACTIVITIES: 0x0000008000000000n,
  USE_EXTERNAL_STICKERS: 0x0000002000000000n,
  SEND_MESSAGES: 0x00000800n,
  SEND_MESSAGES_IN_THREADS: 0x0000004000000000n,
  CREATE_PUBLIC_THREADS: 0x0000008000000000n,
  CREATE_PRIVATE_THREADS: 0x0000010000000000n,
  EMBED_LINKS: 0x00004000n,
  ATTACH_FILES: 0x00008000n
};

export const hasPermission = (permissionString, permissionFlag) => {
  const permissions = BigInt(permissionString || '0');
  const flag = typeof permissionFlag === 'string' ? PERMISSION_FLAGS[permissionFlag] : permissionFlag;

  if (!flag) return false;

  const hasAdmin = (permissions & PERMISSION_FLAGS.ADMINISTRATOR) === PERMISSION_FLAGS.ADMINISTRATOR;
  const hasSpecific = (permissions & flag) === flag;

  return hasAdmin || hasSpecific;
};

export const hasAnyPermission = (permissionString, permissionFlags) => {
  const permissions = BigInt(permissionString || '0');
  const hasAdmin = (permissions & PERMISSION_FLAGS.ADMINISTRATOR) === PERMISSION_FLAGS.ADMINISTRATOR;

  if (hasAdmin) return true;

  for (const flag of permissionFlags) {
    const permFlag = typeof flag === 'string' ? PERMISSION_FLAGS[flag] : flag;
    if (permFlag && (permissions & permFlag) === permFlag) {
      return true;
    }
  }

  return false;
};

export const hasAllPermissions = (permissionString, permissionFlags) => {
  const permissions = BigInt(permissionString || '0');
  const hasAdmin = (permissions & PERMISSION_FLAGS.ADMINISTRATOR) === PERMISSION_FLAGS.ADMINISTRATOR;

  if (hasAdmin) return true;

  for (const flag of permissionFlags) {
    const permFlag = typeof flag === 'string' ? PERMISSION_FLAGS[flag] : flag;
    if (!permFlag || (permissions & permFlag) !== permFlag) {
      return false;
    }
  }

  return true;
};

export const getPermissionNames = (permissionString) => {
  const permissions = BigInt(permissionString || '0');
  const names = [];

  for (const [name, flag] of Object.entries(PERMISSION_FLAGS)) {
    if ((permissions & flag) === flag) {
      names.push(name);
    }
  }

  return names;
};

export const requireGuildPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const userId = req.user?.id;

      if (!guildId) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Guild ID required'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
      }

      const result = await checkGuildPermissions(guildId, userId, permission);

      if (!result.success) {
        return res.status(result.status || 500).json({
          success: false,
          error: 'Permission Check Failed',
          message: result.error
        });
      }

      if (!result.hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `You need ${Array.isArray(permission) ? permission.join(' or ') : permission} permission to access this resource`
        });
      }

      req.permissions = {
        isAdministrator: result.isAdministrator,
        hasManageServer: result.hasManageServer,
        permissions: result.permissions,
        roles: result.roles
      };

      next();
    } catch (error) {
      console.error('Require Guild Permission Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Permission check failed'
      });
    }
  };
};

export const requireManageServer = requireGuildPermission('MANAGE_GUILD');
export const requireAdministrator = requireGuildPermission('ADMINISTRATOR');

export const requireModerator = async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const userId = req.user?.id;

    if (!guildId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Guild ID and user authentication required'
      });
    }

    const result = await checkGuildPermissions(guildId, userId, [
      'ADMINISTRATOR',
      'MANAGE_GUILD',
      'MODERATE_MEMBERS',
      'KICK_MEMBERS',
      'BAN_MEMBERS',
      'MANAGE_MESSAGES'
    ]);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        error: 'Permission Check Failed',
        message: result.error
      });
    }

    if (!result.hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Moderator permissions required'
      });
    }

    req.permissions = {
      isAdministrator: result.isAdministrator,
      hasManageServer: result.hasManageServer,
      permissions: result.permissions,
      roles: result.roles
    };

    next();
  } catch (error) {
    console.error('Require Moderator Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Permission check failed'
    });
  }
};

export const requireGuildAccess = async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const userId = req.user?.id;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Guild ID required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required'
      });
    }

    const memberResult = await fetchGuildMember(guildId, userId);

    if (!memberResult.success) {
      if (memberResult.status === 404) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You are not a member of this guild'
        });
      }

      return res.status(memberResult.status || 500).json({
        success: false,
        error: 'Error',
        message: memberResult.error
      });
    }

    req.guildMember = memberResult.member;
    next();
  } catch (error) {
    console.error('Require Guild Access Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Guild access check failed'
    });
  }
};

export const checkRoleHierarchy = async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const { targetUserId } = req.body;
    const userId = req.user?.id;

    if (!targetUserId) {
      return next();
    }

    const [requesterResult, targetResult] = await Promise.all([
      fetchGuildMember(guildId, userId),
      fetchGuildMember(guildId, targetUserId)
    ]);

    if (!requesterResult.success) {
      return res.status(requesterResult.status || 500).json({
        success: false,
        error: 'Error',
        message: 'Failed to fetch requester member data'
      });
    }

    if (!targetResult.success) {
      return res.status(targetResult.status || 500).json({
        success: false,
        error: 'Error',
        message: 'Failed to fetch target member data'
      });
    }

    const rolesResult = await fetchGuildRoles(guildId);
    if (!rolesResult.success) {
      return res.status(rolesResult.status || 500).json({
        success: false,
        error: 'Error',
        message: 'Failed to fetch guild roles'
      });
    }

    const roles = rolesResult.roles;
    const roleMap = new Map(roles.map(r => [r.id, r.position]));

    const requesterHighestRole = Math.max(
      ...requesterResult.member.roles.map(id => roleMap.get(id) || 0)
    );
    const targetHighestRole = Math.max(
      ...targetResult.member.roles.map(id => roleMap.get(id) || 0)
    );

    if (requesterHighestRole <= targetHighestRole) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You cannot perform this action on a user with equal or higher role'
      });
    }

    next();
  } catch (error) {
    console.error('Check Role Hierarchy Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Role hierarchy check failed'
    });
  }
};

export const validateGuildOwnership = async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const userId = req.user?.id;

    const memberResult = await fetchGuildMember(guildId, userId);

    if (!memberResult.success) {
      return res.status(memberResult.status || 500).json({
        success: false,
        error: 'Error',
        message: memberResult.error
      });
    }

    const permissions = BigInt(memberResult.member.permissions || '0');
    const isOwner = memberResult.member.user?.id === memberResult.member.guild?.owner_id;
    const isAdministrator = (permissions & PERMISSION_FLAGS.ADMINISTRATOR) === PERMISSION_FLAGS.ADMINISTRATOR;

    if (!isOwner && !isAdministrator) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Guild ownership or Administrator permission required'
      });
    }

    req.isGuildOwner = isOwner;
    next();
  } catch (error) {
    console.error('Validate Guild Ownership Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Ownership validation failed'
    });
  }
};

export const permissionBits = PERMISSION_FLAGS;
