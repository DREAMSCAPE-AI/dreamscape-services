import express from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '@services/AuthService';
import { authenticateToken, authenticateRefreshToken, AuthRequest } from '@middleware/auth';
import { loginLimiter, registerLimiter, refreshLimiter } from '@middleware/rateLimiter';
import authKafkaService from '@services/KafkaService';

const router = express.Router();

const signupValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean value')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

const handleValidationErrors = (req: express.Request, res: express.Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return true;
  }
  return false;
};

const setRefreshTokenCookie = (res: express.Response, refreshToken: string, rememberMe: boolean = false) => {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/'
  });
};

const conditionalRateLimit = (limiter: any) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers['x-test-rate-limit']) {
      return next();
    }
    return limiter(req, res, next);
  };
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', conditionalRateLimit(registerLimiter), signupValidation, async (req: express.Request, res: express.Response) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const result = await AuthService.signup(req.body);
    
    if (result.success && result.data) {
      setRefreshTokenCookie(res, result.data.tokens.refreshToken, false);
      
      const { refreshToken, ...tokensWithoutRefresh } = result.data.tokens;
      result.data.tokens = tokensWithoutRefresh as any;
      
      res.status(201).json(result);
    } else {
      const statusCode = result.message === 'Email already exists' ? 409 : 400;
      res.status(statusCode).json(result);
    }
  } catch (error) {
    console.error('Signup route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login', conditionalRateLimit(loginLimiter), loginValidation, async (req: express.Request, res: express.Response) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const result = await AuthService.login(req.body);

    if (result.success && result.data) {
      setRefreshTokenCookie(res, result.data.tokens.refreshToken, req.body.rememberMe || false);

      const { refreshToken, ...tokensWithoutRefresh } = result.data.tokens;
      result.data.tokens = tokensWithoutRefresh as any;

      // Publish Kafka event - DR-374 / DR-376
      authKafkaService.publishLogin({
        userId: result.data.user.id,
        email: result.data.user.email,
        timestamp: new Date(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }).catch(err => console.error('[Login] Failed to publish Kafka event:', err));
    }

    const statusCode = result.success ? 200 : 401;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Refresh token route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const result = await AuthService.getUserProfile(req.user.id);
    
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Get profile route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
], async (req: AuthRequest, res: express.Response) => {
  try {
    if (handleValidationErrors(req, res)) return;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const result = await AuthService.updateProfile(req.user.id, req.body);
    
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Update profile route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticateToken, changePasswordValidation, async (req: AuthRequest, res: express.Response) => {
  try {
    if (handleValidationErrors(req, res)) return;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);

    if (result.success) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      // Publish Kafka event - DR-374 / DR-376
      authKafkaService.publishPasswordChanged({
        userId: req.user.id,
        timestamp: new Date(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown'
      }).catch(err => console.error('[ChangePassword] Failed to publish Kafka event:', err));
    }

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Change password route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Private (refresh token required)
 */
router.post('/refresh', conditionalRateLimit(refreshLimiter), async (req: express.Request, res: express.Response) => {
  try {
    let refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      const refreshCookie = cookies.find(cookie => cookie.trim().startsWith('refreshToken='));
      if (refreshCookie) {
        refreshToken = refreshCookie.split('=')[1].trim();
        refreshToken = refreshToken.split(';')[0];
      }
    }
    
    if (!refreshToken) {
      refreshToken = req.body.refreshToken;
    }
    
    
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: 'Refresh token not provided'
      });
      return;
    }

    const result = await AuthService.refreshToken(refreshToken);

    if (result.success && result.data) {
      setRefreshTokenCookie(res, result.data.tokens.refreshToken, false);

      const { refreshToken: newRefreshToken, ...tokensWithoutRefresh } = result.data.tokens;
      result.data.tokens = tokensWithoutRefresh as any;

      // Publish Kafka event - DR-374 / DR-376
      if (result.data.user?.id) {
        authKafkaService.publishTokenRefreshed({
          userId: result.data.user.id,
          timestamp: new Date(),
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown'
        }).catch(err => console.error('[TokenRefresh] Failed to publish Kafka event:', err));
      }
    }

    const statusCode = result.success ? 200 : 401;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Refresh token route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/auth/verify-token
 * @desc    Verify if token is valid
 * @access  Private
 */
router.post('/verify-token', authenticateToken, (req: AuthRequest, res: express.Response) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and revoke refresh token
 * @access  Private
 */
router.post('/logout', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.cookies) {
      console.error('Cookies not available - cookie-parser middleware missing?');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const refreshToken = req.cookies.refreshToken;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    let loggedOutUserId: string | undefined;

    if (refreshToken) {
      const logoutResult = await AuthService.logout(refreshToken, accessToken);
      // Extract userId from logout result if available
      if (logoutResult && typeof logoutResult === 'object' && 'userId' in logoutResult) {
        loggedOutUserId = (logoutResult as any).userId;
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    // Publish Kafka event - DR-374 / DR-376
    if (loggedOutUserId) {
      authKafkaService.publishLogout({
        userId: loggedOutUserId,
        timestamp: new Date(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown'
      }).catch(err => console.error('[Logout] Failed to publish Kafka event:', err));
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post('/logout-all', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    const result = await AuthService.logoutAllDevices(req.user.id, accessToken);
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Logout all devices route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/test/reset', async (req, res) => {
  const result = await AuthService.resetTestData();
  res.status(200).json(result);
});

router.post('/test/cleanup', async (req, res) => {
  const result = await AuthService.resetTestData();
  res.status(200).json(result);
});

export default router;