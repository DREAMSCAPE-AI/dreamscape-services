import { Router, Request, Response } from 'express';
import { ParsedQs } from 'qs';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Helper function to safely parse query parameters from Express
const parseQueryValue = (value: unknown, defaultValue: string = ''): string => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return parseQueryValue(value[0]);
  return defaultValue;
};

// Helper function to parse pagination parameters
const getPaginationParams = (page: unknown, pageSize: unknown) => {
  const pageNum = Math.max(1, parseInt(parseQueryValue(page, '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(parseQueryValue(pageSize, '10'), 10) || 10));
  const offset = (pageNum - 1) * limit;
  
  return { pageNum, limit, offset };
};

// Helper function to safely parse array parameters from query
const parseArrayParam = (param: unknown): string[] => {
  if (!param) return [];
  if (Array.isArray(param)) {
    return param
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'toString' in item) return String(item);
        return '';
      })
      .filter(Boolean);
  }
  if (typeof param === 'string') return [param];
  return [];
};

// Search hotels
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      cityCode,
      latitude,
      longitude,
      checkInDate,
      checkOutDate,
      adults = 1,
      roomQuantity = 1,
      radius,
      radiusUnit,
      hotelIds,
      ratings,
      amenities,
      priceRange,
      currency,
      lang,
      page = '1',
      pageSize = '10'
    } = req.query;

    if (!checkInDate || !checkOutDate) {
      res.status(400).json({
        error: 'Missing required parameters: checkInDate, checkOutDate'
      });
      return;
    }

    if (!cityCode && (!latitude || !longitude)) {
      res.status(400).json({
        error: 'Either cityCode or latitude/longitude coordinates are required'
      });
      return;
    }

    const searchParams: any = {
      checkInDate: checkInDate as string,
      checkOutDate: checkOutDate as string,
      adults: parseInt(adults as string),
      roomQuantity: roomQuantity ? parseInt(roomQuantity as string) : 1
    };
    
    // Add location parameters with type safety
    const cityCodeStr = parseQueryValue(cityCode);
    const latitudeNum = parseFloat(parseQueryValue(latitude));
    const longitudeNum = parseFloat(parseQueryValue(longitude));
    
    if (cityCodeStr) {
      searchParams.cityCode = cityCodeStr;
    } else if (!isNaN(latitudeNum) && !isNaN(longitudeNum)) {
      searchParams.latitude = latitudeNum;
      searchParams.longitude = longitudeNum;
    }
    
    // Add optional parameters only if they are provided
    if (radius) searchParams.radius = parseInt(radius as string);
    if (radiusUnit) searchParams.radiusUnit = radiusUnit as string;
    if (hotelIds) searchParams.hotelIds = hotelIds as string;
    
    // Handle array parameters with proper type safety
    const ratingsArray = parseArrayParam(ratings);
    const amenitiesArray = parseArrayParam(amenities);
    
    if (ratingsArray.length > 0) searchParams.ratings = ratingsArray as string[];
    if (amenitiesArray.length > 0) searchParams.amenities = amenitiesArray as string[];
    
    if (priceRange) searchParams.priceRange = priceRange as string;
    if (currency) searchParams.currency = currency as string;
    if (lang) searchParams.lang = lang as string;
    
    // Add pagination parameters with proper type safety
    const { pageNum, limit, offset } = getPaginationParams(page, pageSize);
    
    searchParams.page = { offset, limit };

    try {
      const result = await AmadeusService.searchHotels(searchParams);
      res.json({
        data: result.data || [],
        meta: {
          pagination: {
            page: pageNum,
            pageSize: limit,
            total: result.meta?.count || 0,
            totalPages: Math.ceil((result.meta?.count || 0) / limit)
          }
        }
      });
    } catch (error) {
      console.error('Hotel search error:', error);
      res.status(500).json({
        error: 'Failed to search hotels',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? (error as any).response?.data : undefined
      });
    }
  } catch (error) {
    console.error('Hotel search error:', error);
    res.status(500).json({
      error: 'Failed to search hotels',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get hotel details
router.get('/details/:hotelId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hotelId } = req.params;
    const { adults = '1', roomQuantity = '1', checkInDate, checkOutDate } = req.query;

    if (!hotelId) {
      res.status(400).json({
        error: 'Missing required parameter: hotelId'
      });
      return;
    }

    // Get hotel details using the hotel list API with the specific hotel ID
    const result = await AmadeusService.searchHotels({
      hotelIds: hotelId,
      adults: parseInt(adults as string),
      roomQuantity: parseInt(roomQuantity as string),
      checkInDate: checkInDate as string || new Date().toISOString().split('T')[0],
      checkOutDate: checkOutDate as string || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      page: { limit: 1, offset: 0 }
    });

    if (!result.data || result.data.length === 0) {
      res.status(404).json({
        error: 'Hotel not found'
      });
      return;
    }

    res.json({
      data: result.data[0],
      meta: result.meta
    });
  } catch (error) {
    console.error('Hotel details error:', error);
    res.status(500).json({
      error: 'Failed to get hotel details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Hotel Ratings
router.get('/ratings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hotelIds } = req.query;

    if (!hotelIds) {
      res.status(400).json({
        error: 'Missing required parameter: hotelIds'
      });
      return;
    }

    // Convert hotelIds to a comma-separated string, handling both string and array inputs
    const hotelIdsString = (Array.isArray(hotelIds) 
      ? (hotelIds as string[]).filter(Boolean).join(',') 
      : (hotelIds as string)?.trim?.()) ?? '';
    
    // Use searchHotels to get hotel details including ratings
    const result = await AmadeusService.searchHotels({
      hotelIds: hotelIdsString,
      checkInDate: new Date().toISOString().split('T')[0],
      checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      adults: 1,
      page: { limit: 50, offset: 0 }
    });
    
    // Extract and format ratings from hotel data
    const ratings = result.data?.map((hotel: any) => ({
      hotelId: hotel.hotelId,
      rating: hotel.rating || null,
      reviewCount: hotel.reviewCount || 0,
      amenities: hotel.amenities || []
    })) || [];
    
    res.json({
      data: ratings,
      meta: {
        count: ratings.length
      }
    });
  } catch (error) {
    console.error('Hotel ratings error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get hotel ratings';
    res.status(500).json({
      error: 'Failed to get hotel ratings',
      message: errorMessage
    });
  }
});

// Hotel Booking
router.post('/bookings', async (req: Request, res: Response): Promise<void> => {
  try {
    // Note: createHotelBooking method doesn't exist in AmadeusService
    // This is a placeholder for future implementation
    res.status(501).json({
      error: 'Not implemented',
      message: 'Hotel booking functionality is not yet implemented'
    });
  } catch (error) {
    console.error('Hotel booking error:', error);
    res.status(500).json({
      error: 'Failed to create hotel booking',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Hotel List
router.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      cityCode,
      latitude,
      longitude,
      hotelIds,
      radius = '5',
      radiusUnit = 'KM',
      page = '1',
      pageSize = '10'
    } = req.query;

    // Handle pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(pageSize as string) || 10));
    const offset = (pageNum - 1) * limit;

    // Use searchHotels with the hotelIds parameter to get the list
    const result = await AmadeusService.searchHotels({
      cityCode: cityCode as string | undefined,
      latitude: latitude ? parseFloat(latitude as string) : undefined,
      longitude: longitude ? parseFloat(longitude as string) : undefined,
      hotelIds: hotelIds as string | undefined,
      radius: radius ? parseInt(radius as string) : 5,
      radiusUnit: radiusUnit as string || 'KM',
      checkInDate: new Date().toISOString().split('T')[0], // Required but not used for listing
      checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Required but not used for listing
      adults: 1,
      page: { offset, limit }
    });

    res.json({
      data: result.data || [],
      meta: {
        pagination: {
          page: pageNum,
          pageSize: limit,
          total: result.meta?.count || 0,
          totalPages: Math.ceil((result.meta?.count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Hotel list error:', error);
    res.status(500).json({
      error: 'Failed to get hotel list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get hotel images
router.get('/:hotelId/images', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hotelId } = req.params;
    const { adults = '1', roomQuantity = '1', checkInDate, checkOutDate } = req.query;

    if (!hotelId) {
      res.status(400).json({
        error: 'Hotel ID is required'
      });
      return;
    }

    // Get hotel details using the search endpoint with the specific hotel ID
    const result = await AmadeusService.searchHotels({
      hotelIds: hotelId,
      adults: parseInt(adults as string),
      roomQuantity: parseInt(roomQuantity as string),
      checkInDate: checkInDate as string || new Date().toISOString().split('T')[0],
      checkOutDate: checkOutDate as string || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      page: { limit: 1, offset: 0 }
    });
    
    // Extract images from the first hotel result
    const hotel = result?.data?.[0];
    const images = hotel?.media?.images || [];
    
    // If no images found, provide default image
    if (images.length === 0) {
      images.push({
        url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
        category: 'HOTEL',
        type: 'ROOM',
        width: 1200,
        height: 800
      });
    }
    
    res.json({
      data: images,
      meta: {
        count: images.length,
        hotelId: hotelId
      }
    });
  } catch (error) {
    console.error('Hotel images error:', error);
    // Return a default image on error
    res.json({
      data: [{
        url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
        category: 'HOTEL',
        type: 'ROOM',
        width: 1200,
        height: 800
      }],
      meta: {
        count: 1,
        hotelId: req.params.hotelId,
        error: 'Failed to fetch hotel images',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
