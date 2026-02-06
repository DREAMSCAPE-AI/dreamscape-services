import { Response } from 'express';
import { prisma } from '@dreamscape/db';
import { AuthRequest } from '../middleware/auth';
import ConsentService from '../services/ConsentService';
import PrivacyPolicyService from '../services/PrivacyPolicyService';
import GdprRequestService from '../services/GdprRequestService';
import { userKafkaService } from '../services/KafkaService';

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, error: message });
};

/**
 * Get current privacy policy (public endpoint)
 */
export const getCurrentPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await PrivacyPolicyService.getCurrentPolicy();

    res.json({
      success: true,
      data: policy
    });
  } catch (error: any) {
    if (error.message.includes('No active privacy policy found')) {
      return sendError(res, 404, 'No active privacy policy found');
    }
    console.error('Error fetching current policy:', error);
    sendError(res, 500, 'Failed to fetch current policy');
  }
};

/**
 * Get all privacy policy versions (public endpoint)
 */
export const getAllPolicyVersions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const versions = await PrivacyPolicyService.getAllVersions();

    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error('Error fetching policy versions:', error);
    sendError(res, 500, 'Failed to fetch policy versions');
  }
};

/**
 * Accept privacy policy (requires authentication)
 * Body: { policyId }
 */
export const acceptPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const { policyId } = req.body;

    if (!policyId) {
      return sendError(res, 400, 'Policy ID is required');
    }

    if (typeof policyId !== 'string') {
      return sendError(res, 400, 'Policy ID must be a string');
    }

    // Get IP and user agent from request
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const acceptance = await PrivacyPolicyService.acceptPolicy(
      userId,
      policyId,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'Policy accepted successfully',
      data: acceptance
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Duplicate key - policy already accepted
      res.json({
        success: true,
        message: 'Policy already accepted'
      });
      return;
    }
    if (error.message.includes('Policy not found')) {
      return sendError(res, 404, 'Policy not found');
    }
    console.error('Error accepting policy:', error);
    sendError(res, 500, 'Failed to accept policy');
  }
};

/**
 * Get user consent settings (requires authentication)
 */
export const getUserConsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const consent = await ConsentService.getUserConsent(userId);

    res.json({
      success: true,
      data: consent
    });
  } catch (error) {
    console.error('Error fetching user consent:', error);
    sendError(res, 500, 'Failed to fetch user consent');
  }
};

/**
 * Update user consent settings (requires authentication)
 * Body: { analytics?, marketing?, preferences? }
 */
export const updateConsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const { analytics, marketing, preferences } = req.body;

    // Validate boolean fields if provided
    if (analytics !== undefined && typeof analytics !== 'boolean') {
      return sendError(res, 400, 'Analytics must be a boolean');
    }

    if (marketing !== undefined && typeof marketing !== 'boolean') {
      return sendError(res, 400, 'Marketing must be a boolean');
    }

    if (preferences !== undefined && typeof preferences !== 'boolean') {
      return sendError(res, 400, 'Preferences must be a boolean');
    }

    // Check if at least one field is provided
    if (analytics === undefined && marketing === undefined && preferences === undefined) {
      return sendError(res, 400, 'At least one consent field must be provided');
    }

    // Get IP and user agent from request
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const updatedConsent = await ConsentService.updateConsent(
      userId,
      { analytics, marketing, preferences },
      ipAddress,
      userAgent
    );

    // Publish Kafka event (non-blocking)
    userKafkaService.publishConsentUpdated({
      userId,
      analytics: updatedConsent.analytics,
      marketing: updatedConsent.marketing,
      functional: updatedConsent.functional,
      preferences: updatedConsent.preferences,
      updatedAt: updatedConsent.lastUpdatedAt.toISOString(),
      ipAddress: ipAddress || undefined,
    }).catch(err => console.warn('[GDPR] Failed to publish consent event:', err));

    res.json({
      success: true,
      message: 'Consent updated successfully',
      data: updatedConsent
    });
  } catch (error) {
    console.error('Error updating consent:', error);
    sendError(res, 500, 'Failed to update consent');
  }
};

/**
 * Get user consent history (requires authentication)
 */
export const getConsentHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const history = await ConsentService.getConsentHistory(userId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching consent history:', error);
    sendError(res, 500, 'Failed to fetch consent history');
  }
};

/**
 * Request data export (requires authentication)
 */
export const requestDataExport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const gdprRequest = await GdprRequestService.requestDataExport(userId);

    // Process the export immediately
    await GdprRequestService.processExport(gdprRequest.id);

    // Publish Kafka event (non-blocking)
    userKafkaService.publishGdprExportRequested({
      requestId: gdprRequest.id,
      userId,
      requestedAt: gdprRequest.requestedAt.toISOString(),
      expiresAt: gdprRequest.expiresAt?.toISOString() || '',
    }).catch(err => console.warn('[GDPR] Failed to publish export event:', err));

    res.status(201).json({
      success: true,
      message: 'Data export request created',
      data: gdprRequest
    });
  } catch (error) {
    console.error('Error creating data export request:', error);
    sendError(res, 500, 'Failed to create data export request');
  }
};

/**
 * Request data deletion (requires authentication)
 * Body: { reason? }
 */
export const requestDataDeletion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const { reason } = req.body;

    if (reason !== undefined && typeof reason !== 'string') {
      return sendError(res, 400, 'Reason must be a string');
    }

    const gdprRequest = await GdprRequestService.requestDataDeletion(userId, reason);

    // Publish Kafka event (non-blocking)
    userKafkaService.publishGdprDeletionRequested({
      requestId: gdprRequest.id,
      userId,
      reason: reason || undefined,
      requestedAt: gdprRequest.requestedAt.toISOString(),
    }).catch(err => console.warn('[GDPR] Failed to publish deletion event:', err));

    res.status(201).json({
      success: true,
      message: 'Data deletion request created',
      data: gdprRequest
    });
  } catch (error) {
    console.error('Error creating data deletion request:', error);
    sendError(res, 500, 'Failed to create data deletion request');
  }
};

/**
 * Get all GDPR requests for authenticated user
 */
export const getUserRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const requests = await GdprRequestService.getUserRequests(userId);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching user requests:', error);
    sendError(res, 500, 'Failed to fetch user requests');
  }
};

/**
 * Get specific GDPR request by ID (requires authentication)
 * Params: id (request ID)
 */
export const getRequestById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!id) {
      return sendError(res, 400, 'Request ID is required');
    }

    const request = await GdprRequestService.getRequestById(id, userId);

    res.json({
      success: true,
      data: request
    });
  } catch (error: any) {
    if (error.message.includes('Request not found')) {
      return sendError(res, 404, 'Request not found');
    }
    if (error.message.includes('Unauthorized')) {
      return sendError(res, 403, 'Access denied');
    }
    console.error('Error fetching request:', error);
    sendError(res, 500, 'Failed to fetch request');
  }
};

/**
 * Download export data (requires authentication)
 * Params: id (request ID)
 */
export const downloadExport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!id) {
      return sendError(res, 400, 'Request ID is required');
    }

    const exportData = await GdprRequestService.getExportData(id, userId);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="dreamscape-data-export.json"');

    res.json(exportData);
  } catch (error: any) {
    if (error.message.includes('Request not found')) {
      return sendError(res, 404, 'Request not found');
    }
    if (error.message.includes('Export is not completed yet')) {
      return sendError(res, 400, 'Export is not completed yet');
    }
    if (error.message.includes('Export data not available')) {
      return sendError(res, 404, 'Export data not available');
    }
    if (error.message.includes('Unauthorized')) {
      return sendError(res, 403, 'Access denied');
    }
    console.error('Error downloading export:', error);
    sendError(res, 500, 'Failed to download export data');
  }
};
