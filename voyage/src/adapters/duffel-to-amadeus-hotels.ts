/**
 * Adapter : Duffel Stays result[] → shape Amadeus attendue par HotelOfferMapper
 *
 * HotelOfferMapper.mapAmadeusToSimplified() est assez souple (optional chaining),
 * on produit un objet minimal compatible.
 */

/**
 * Shape réelle d'un StaysSearchResult Duffel :
 * {
 *   id: string,                          ← search result ID (à passer à searchResults.fetchAllRates si besoin)
 *   check_in_date: string,
 *   check_out_date: string,
 *   accommodation: {
 *     id: string,                        ← accommodation ID (stable, utilisable pour getStayDetails)
 *     name: string,
 *     rating: number | null,             ← étoiles (1-5)
 *     review_score: number | null,
 *     review_count: number | null,
 *     location: {
 *       geographic_coordinates: { latitude, longitude },
 *       address: { line_one, city_name, postal_code, country_code }
 *     },
 *     amenities: Array<{ type: string, description: string }>,
 *     photos: Array<{ url: string }>
 *   },
 *   guests: Array<{ type: 'adult' | 'child' }>,
 *   rooms: number,
 *   cheapest_rate_total_amount: string,  ← seul tarif garanti présent après search()
 *   cheapest_rate_currency: string,
 *   cheapest_rate_base_amount: string | null,
 *   expires_at: string
 * }
 */
export function duffelToAmadeusHotels(duffelResults: any[]): any[] {
  if (!Array.isArray(duffelResults)) return [];

  return duffelResults.map((result: any) => {
    const accommodation = result.accommodation || result;

    // Prix : après un search() simple, seul cheapest_rate_* est garanti.
    // rates[] n'est rempli que si on a appelé searchResults.fetchAllRates().
    const firstRate = Array.isArray(result.rates) && result.rates.length > 0
      ? result.rates[0]
      : null;

    const totalAmount = firstRate?.total_amount
      || result.cheapest_rate_total_amount
      || '0';
    const currency = firstRate?.currency
      || result.cheapest_rate_currency
      || 'EUR';
    const baseAmount = firstRate?.base_amount
      || result.cheapest_rate_base_amount
      || totalAmount;

    // Coordonnées & adresse
    const geoCoords = accommodation.location?.geographic_coordinates
      || accommodation.geographic_coordinates
      || {};
    const address = accommodation.location?.address
      || accommodation.address
      || {};

    // Photos → format uri attendu par le mapper
    const images = (accommodation.photos || accommodation.images || [])
      .slice(0, 8)
      .map((p: any) => ({ uri: p.url || p.uri || String(p) }));

    // Amenities → tableau de strings
    const amenities: string[] = (accommodation.amenities || [])
      .map((a: any) => {
        if (typeof a === 'string') return a;
        return a.type || a.description || a.name || '';
      })
      .filter(Boolean);

    const hotelId = accommodation.id
      || result.id
      || `duffel_${Math.random().toString(36).substring(2, 8)}`;

    // Offer ID : utiliser result.id (search result) comme offer ID
    // → c'est cet ID qu'on passera à searchResults.fetchAllRates() + quotes.create()
    const offerId = firstRate?.id || result.id || `offer_${Date.now()}`;

    const adultsCount = Array.isArray(result.guests)
      ? result.guests.filter((g: any) => g.type === 'adult').length || 1
      : result.adults || 1;

    return {
      type: 'hotel-offer',
      hotel: {
        type: 'hotel',
        hotelId,
        name: accommodation.name || 'Unknown Hotel',
        cityCode: address.city_code || null,
        latitude: geoCoords.latitude ?? null,
        longitude: geoCoords.longitude ?? null,
        rating: accommodation.rating != null ? String(accommodation.rating) : undefined,
        ratings: accommodation.review_score != null ? {
          overall: accommodation.review_score,
          numberOfReviews: accommodation.review_count || 0,
        } : undefined,
        amenities,
        media: images,
        address: {
          lines: [address.line_one || ''].filter(Boolean),
          cityName: address.city_name || address.city || '',
          postalCode: address.postal_code || '',
          countryCode: address.country_code || '',
        },
        contact: accommodation.phone_number
          ? { phone: accommodation.phone_number }
          : undefined,
        description: accommodation.description
          ? { text: accommodation.description }
          : undefined,
      },
      available: true,
      offers: [
        {
          id: offerId,
          checkInDate: result.check_in_date || '',
          checkOutDate: result.check_out_date || '',
          rateCode: firstRate?.rate_plan_code || 'RAC',
          room: {
            type: firstRate?.room_type || 'STANDARD',
            typeEstimated: {
              beds: firstRate?.beds ?? null,
              bedType: firstRate?.bed_type ?? null,
            },
            description: { text: firstRate?.description || '' },
          },
          guests: { adults: adultsCount },
          price: {
            currency,
            total: totalAmount,
            base: baseAmount,
            taxes: [],
          },
          policies: {
            cancellations: (firstRate?.cancellation_policies || []).map((p: any) => ({
              type: p.refundable ? 'FULL_REFUND' : 'NON_REFUNDABLE',
              deadline: p.deadline || null,
              amount: p.penalty_amount || '0',
            })),
          },
        },
      ],
    };
  });
}
