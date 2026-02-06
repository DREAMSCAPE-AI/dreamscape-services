import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getCurrentPolicy,
  getAllPolicyVersions,
  acceptPolicy,
  getUserConsent,
  updateConsent,
  getConsentHistory,
  requestDataExport,
  requestDataDeletion,
  getUserRequests,
  getRequestById,
  downloadExport
} from '../controllers/gdprController';

const router = Router();

/**
 * Privacy Policy Routes
 */

/**
 * GET /api/v1/users/gdpr/privacy-policy
 * Get current active privacy policy (public endpoint)
 */
router.get('/privacy-policy', getCurrentPolicy);

/**
 * GET /api/v1/users/gdpr/privacy-policy/versions
 * Get all privacy policy versions (public endpoint)
 */
router.get('/privacy-policy/versions', getAllPolicyVersions);

/**
 * POST /api/v1/users/gdpr/privacy-policy/accept
 * Accept a privacy policy (requires authentication)
 * Body: { policyId }
 */
router.post('/privacy-policy/accept', authenticateToken, acceptPolicy);

/**
 * Consent Management Routes (all require authentication)
 */

/**
 * GET /api/v1/users/gdpr/consent
 * Get user consent settings
 */
router.get('/consent', authenticateToken, getUserConsent);

/**
 * PUT /api/v1/users/gdpr/consent
 * Update user consent settings
 * Body: { analytics?, marketing?, preferences? }
 */
router.put('/consent', authenticateToken, updateConsent);

/**
 * GET /api/v1/users/gdpr/consent/history
 * Get user consent change history
 */
router.get('/consent/history', authenticateToken, getConsentHistory);

/**
 * Data Rights Routes (all require authentication)
 */

/**
 * POST /api/v1/users/gdpr/data-export
 * Request data export
 */
router.post('/data-export', authenticateToken, requestDataExport);

/**
 * POST /api/v1/users/gdpr/data-deletion
 * Request data deletion
 * Body: { reason? }
 */
router.post('/data-deletion', authenticateToken, requestDataDeletion);

/**
 * GET /api/v1/users/gdpr/requests
 * Get all GDPR requests for authenticated user
 */
router.get('/requests', authenticateToken, getUserRequests);

/**
 * GET /api/v1/users/gdpr/requests/:id
 * Get specific GDPR request by ID
 * Params: id (request ID)
 */
router.get('/requests/:id', authenticateToken, getRequestById);

/**
 * GET /api/v1/users/gdpr/data-export/:id/download
 * Download export data for a completed export request
 * Params: id (request ID)
 */
router.get('/data-export/:id/download', authenticateToken, downloadExport);

export default router;
