import express from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/AuthService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation middleware
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
    .withMessage('Password is required')
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

// Helper function to handle validation errors
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

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', signupValidation, async (req: express.Request, res: express.Response) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const result = await AuthService.signup(req.body);
    
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
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
router.post('/login', loginValidation, async (req: express.Request, res: express.Response) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const result = await AuthService.login(req.body);
    
    const statusCode = result.success ? 200 : 401;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/auth/profile
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
 * @route   PUT /api/auth/profile
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
 * @route   POST /api/auth/change-password
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
 * @route   POST /api/auth/verify-token
 * @desc    Verify if token is valid
 * @access  Private
 */
router.post('/verify-token', authenticateToken, (req: AuthRequest, res: express.Response) => {
  // If we reach here, the token is valid (middleware passed)
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticateToken, (req: AuthRequest, res: express.Response) => {
  // Since we're using stateless JWT, logout is handled client-side
  // This endpoint is mainly for consistency and potential future server-side logout logic
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
