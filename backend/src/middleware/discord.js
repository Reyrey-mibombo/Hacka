import axios from 'axios';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const discordApi = axios.create({
  baseURL: DISCORD_API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const fetchDiscordUser = async (accessToken) => {
  try {
    const response = await discordApi.get('/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      success: true,
      user: response.data
    };
  } catch (error) {
    console.error('Fetch Discord User Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch user',
      status: error.response?.status || 500
    };
  }
};

export const fetchUserGuilds = async (accessToken) => {
  try {
    const response = await discordApi.get('/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      success: true,
      guilds: response.data
    };
  } catch (error) {
    console.error('Fetch User Guilds Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch guilds',
      status: error.response?.status || 500
    };
  }
};

export const fetchGuildDetails = async (guildId, withCounts = false) => {
  try {
    const url = `/guilds/${guildId}${withCounts ? '?with_counts=true' : ''}`;
    const response = await discordApi.get(url, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    return {
      success: true,
      guild: response.data
    };
  } catch (error) {
    console.error('Fetch Guild Details Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch guild details',
      status: error.response?.status || 500
    };
  }
};

export const fetchGuildChannels = async (guildId) => {
  try {
    const response = await discordApi.get(`/guilds/${guildId}/channels`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    return {
      success: true,
      channels: response.data
    };
  } catch (error) {
    console.error('Fetch Guild Channels Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch channels',
      status: error.response?.status || 500
    };
  }
};

export const fetchGuildRoles = async (guildId) => {
  try {
    const response = await discordApi.get(`/guilds/${guildId}/roles`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    return {
      success: true,
      roles: response.data
    };
  } catch (error) {
    console.error('Fetch Guild Roles Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch roles',
      status: error.response?.status || 500
    };
  }
};

export const fetchGuildMember = async (guildId, userId) => {
  try {
    const response = await discordApi.get(`/guilds/${guildId}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    return {
      success: true,
      member: response.data
    };
  } catch (error) {
    console.error('Fetch Guild Member Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch member',
      status: error.response?.status || 500
    };
  }
};

export const fetchGuildMembers = async (guildId, limit = 1000) => {
  try {
    const response = await discordApi.get(`/guilds/${guildId}/members?limit=${limit}`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    return {
      success: true,
      members: response.data
    };
  } catch (error) {
    console.error('Fetch Guild Members Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch members',
      status: error.response?.status || 500
    };
  }
};

export const checkGuildPermissions = async (guildId, userId, requiredPermissions = null) => {
  try {
    const memberResult = await fetchGuildMember(guildId, userId);

    if (!memberResult.success) {
      return {
        success: false,
        hasPermission: false,
        error: memberResult.error,
        status: memberResult.status
      };
    }

    const member = memberResult.member;
    const permissions = BigInt(member.permissions || '0');

    const PERMISSION_FLAGS = {
      ADMINISTRATOR: 0x00000008n,
      MANAGE_GUILD: 0x00000020n,
      MANAGE_CHANNELS: 0x00000010n,
      MANAGE_ROLES: 0x10000000n,
      MANAGE_MESSAGES: 0x00002000n,
      KICK_MEMBERS: 0x00000002n,
      BAN_MEMBERS: 0x00000004n,
      VIEW_AUDIT_LOG: 0x00000080n,
      MODERATE_MEMBERS: 0x0000010000000000n
    };

    const isAdministrator = (permissions & PERMISSION_FLAGS.ADMINISTRATOR) === PERMISSION_FLAGS.ADMINISTRATOR;
    const hasManageServer = (permissions & PERMISSION_FLAGS.MANAGE_GUILD) === PERMISSION_FLAGS.MANAGE_GUILD;

    let hasRequiredPermissions = true;
    if (requiredPermissions && !isAdministrator) {
      const requiredPerms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      for (const perm of requiredPerms) {
        const permFlag = PERMISSION_FLAGS[perm];
        if (permFlag && (permissions & permFlag) !== permFlag) {
          hasRequiredPermissions = false;
          break;
        }
      }
    }

    return {
      success: true,
      hasPermission: isAdministrator || hasManageServer || hasRequiredPermissions,
      isAdministrator,
      hasManageServer,
      permissions: member.permissions,
      roles: member.roles,
      hasRequiredPermissions: isAdministrator || hasRequiredPermissions
    };
  } catch (error) {
    console.error('Check Guild Permissions Error:', error.message);
    return {
      success: false,
      hasPermission: false,
      error: 'Failed to check permissions',
      status: 500
    };
  }
};

export const isBotInGuild = async (guildId) => {
  try {
    const result = await fetchGuildDetails(guildId);
    return result.success;
  } catch {
    return false;
  }
};

export const getGuildIconUrl = (guildId, iconHash, size = 128) => {
  if (!iconHash) return null;
  const format = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${format}?size=${size}`;
};

export const getUserAvatarUrl = (userId, avatarHash, discriminator = '0', size = 128) => {
  if (!avatarHash) {
    const defaultAvatarIndex = parseInt(discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
  }
  const format = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}?size=${size}`;
};

export const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await axios.post(
      'https://discord.com/api/oauth2/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      tokenData: response.data
    };
  } catch (error) {
    console.error('Exchange Code Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || 'Failed to exchange code',
      status: error.response?.status || 500
    };
  }
};

export const refreshDiscordToken = async (refreshToken, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await axios.post(
      'https://discord.com/api/oauth2/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      tokenData: response.data
    };
  } catch (error) {
    console.error('Refresh Token Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || 'Failed to refresh token',
      status: error.response?.status || 500
    };
  }
};

export const revokeDiscordToken = async (token, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    await axios.post(
      'https://discord.com/api/oauth2/token/revoke',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Revoke Token Error:', error.message);
    return {
      success: false,
      error: error.response?.data?.error_description || 'Failed to revoke token',
      status: error.response?.status || 500
    };
  }
};
