import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

export const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

export const verifyJWT = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token type'
      });
    }

    req.user = {
      id: decoded.userId,
      username: decoded.username,
      discriminator: decoded.discriminator,
      avatar: decoded.avatar,
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('JWT Authentication Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

export const authenticateDiscord = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Discord access token required'
      });
    }

    const discordToken = authHeader.substring(7);

    try {
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${discordToken}`
        },
        timeout: 10000
      });

      const user = userResponse.data;

      req.user = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email,
        locale: user.locale,
        verified: user.verified,
        mfa_enabled: user.mfa_enabled,
        discordToken: discordToken
      };

      next();
    } catch (discordError) {
      if (discordError.response?.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or expired Discord token'
        });
      }

      console.error('Discord API Error:', discordError.message);
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Unable to verify Discord token'
      });
    }
  } catch (error) {
    console.error('Discord Authentication Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);

    if (decoded && decoded.type === 'access') {
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        discriminator: decoded.discriminator,
        avatar: decoded.avatar,
        email: decoded.email
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Refresh token required'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    }

    req.tokenData = { userId: decoded.userId };
    next();
  } catch (error) {
    console.error('Token Refresh Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Token refresh failed'
    });
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  next();
};
