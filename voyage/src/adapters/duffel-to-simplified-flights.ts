/**
 * Adapter : Duffel Offer[] → SimplifiedFlightOfferDTO[]
 *
 * Bypasse FlightOfferMapper (trop strict pour Duffel shape) et produit
 * directement le format consommé par le frontend et l'ai-service.
 */

export interface SimplifiedFlightOffer {
  id: string;
  price: {
    total: number;
    currency: string;
  };
  duration: string;        // ISO 8601, e.g. "PT5H30M"
  stops: number;
  departure: {
    airport: string;
    time: Date;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: Date;
    terminal?: string;
  };
  airline: {
    code: string;
    name?: string;
  };
  cabinClass: string;
  availableSeats: number;
  isRefundable: boolean;
  baggageAllowance: {
    checkedBags: number;
    cabinBags: number;
  };
  // Champs additionnels pour le scoring ai-service
  expiresAt?: string;
  bookingToken?: string;   // = offer.id (utilisé pour créer l'order)
}

/**
 * Convertit une durée ISO 8601 Duffel ("PT5H30M", "PT2H00M") en string compatible Amadeus.
 * Duffel utilise déjà ISO 8601, donc pas de conversion nécessaire.
 */
function normalizeDuration(durationStr: string | null | undefined): string {
  if (!durationStr) return 'PT0H0M';
  return durationStr; // Duffel retourne déjà "PT2H15M" format
}

/**
 * Extrait le nombre de bagages enregistrés depuis les données passagers Duffel.
 */
function extractCheckedBags(offer: any): number {
  const firstPassenger = offer.passengers?.[0];
  if (!firstPassenger) return 0;
  const checkedBag = firstPassenger.baggages?.find((b: any) => b.type === 'checked');
  return checkedBag?.quantity ?? 0;
}

/**
 * Extrait la classe de cabine depuis les données passagers Duffel.
 */
function extractCabinClass(offer: any): string {
  const firstPassenger = offer.passengers?.[0];
  const cabin = firstPassenger?.cabin_class || offer.cabin_class || 'economy';
  const map: Record<string, string> = {
    economy: 'ECONOMY',
    premium_economy: 'PREMIUM_ECONOMY',
    business: 'BUSINESS',
    first: 'FIRST',
  };
  return map[cabin] || 'ECONOMY';
}

/**
 * Convertit un tableau d'offres Duffel en SimplifiedFlightOffer[].
 */
export function duffelToSimplifiedFlights(duffelOffers: any[]): SimplifiedFlightOffer[] {
  if (!Array.isArray(duffelOffers)) return [];

  const results: SimplifiedFlightOffer[] = [];

  for (const offer of duffelOffers) {
    try {
      // Slice principal (aller)
      const firstSlice = offer.slices?.[0];
      if (!firstSlice) continue;

      const segments: any[] = firstSlice.segments || [];
      if (segments.length === 0) continue;

      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      // Prix
      const totalAmount = parseFloat(offer.total_amount || '0');
      if (isNaN(totalAmount)) continue;

      // Compagnie (marketing carrier du premier segment)
      const airlineCode = firstSegment.marketing_carrier?.iata_code ||
                          firstSegment.operating_carrier?.iata_code ||
                          offer.owner?.iata_code || 'ZZ';
      const airlineName = firstSegment.marketing_carrier?.name ||
                          offer.owner?.name || undefined;

      // Aéroports
      const departureAirport = firstSegment.origin?.iata_code || '';
      const arrivalAirport = lastSegment.destination?.iata_code || '';

      // Dates
      const departureTime = new Date(firstSegment.departing_at);
      const arrivalTime = new Date(lastSegment.arriving_at);

      // Stops = segments - 1
      const stops = Math.max(0, segments.length - 1);

      // Durée (slice duration ou calcul depuis seg)
      const duration = normalizeDuration(firstSlice.duration);

      // Places disponibles
      const availableSeats = offer.available_services?.length ?? 0;

      // Remboursable
      const isRefundable = offer.conditions?.refund_before_departure?.allowed === true;

      results.push({
        id: offer.id,
        price: {
          total: totalAmount,
          currency: offer.total_currency || 'EUR',
        },
        duration,
        stops,
        departure: {
          airport: departureAirport,
          time: departureTime,
          terminal: firstSegment.origin?.terminal ?? undefined,
        },
        arrival: {
          airport: arrivalAirport,
          time: arrivalTime,
          terminal: lastSegment.destination?.terminal ?? undefined,
        },
        airline: {
          code: airlineCode,
          name: airlineName,
        },
        cabinClass: extractCabinClass(offer),
        availableSeats,
        isRefundable,
        baggageAllowance: {
          checkedBags: extractCheckedBags(offer),
          cabinBags: 1,
        },
        expiresAt: offer.expires_at,
        bookingToken: offer.id,
      });
    } catch (err) {
      console.warn('[DuffelAdapter] Failed to convert offer:', err);
    }
  }

  return results;
}
