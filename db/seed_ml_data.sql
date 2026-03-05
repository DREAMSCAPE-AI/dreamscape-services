-- Seed ML Data for DREAMSCAPE - Simplified version
-- Creates minimal data for ML pipeline testing

DO $$
DECLARE
    user1_id text;
    user2_id text;
    uv1_id text;
    uv2_id text;
    iv1_id text;
    iv2_id text;
    iv3_id text;
BEGIN
    -- Get first two users
    SELECT id INTO user1_id FROM users LIMIT 1;
    SELECT id INTO user2_id FROM users OFFSET 1 LIMIT 1;

    -- Mark users as onboarding completed
    UPDATE users SET "onboardingCompleted" = TRUE WHERE id IN (user1_id, user2_id);

    -- Create TravelOnboardingProfiles (simplified - use text arrays)
    INSERT INTO travel_onboarding_profiles (id, "userId", "travelTypes", "globalBudgetRange", "activityLevel", "accommodationLevel", "travelWithChildren", "climatePreferences", "riskTolerance", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), user1_id, ARRAY['ADVENTURE', 'CULTURAL']::"TravelType"[], '{"min": 1000, "max": 3000}'::jsonb, 'HIGH', 'COMFORT', false, ARRAY['WARM'], 'MEDIUM', NOW(), NOW()),
        (gen_random_uuid(), user2_id, ARRAY['RELAXATION', 'BEACH']::"TravelType"[], '{"min": 2000, "max": 5000}'::jsonb, 'LOW', 'LUXURY', true, ARRAY['HOT'], 'LOW', NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING;

    -- Create UserVectors (8D)
    INSERT INTO user_vectors (id, "userId", vector, "primarySegment", "segmentConfidence", "lastCalculatedAt", "interactionCount", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), user1_id, ARRAY[0.7, 0.8, 0.5, 0.9, 0.6, 0.4, 0.7, 0.5]::float8[], 'ADVENTURE_SEEKER', 0.85, NOW(), 10, NOW(), NOW()),
        (gen_random_uuid(), user2_id, ARRAY[0.3, 0.5, 0.8, 0.4, 0.7, 0.2, 0.6, 0.7]::float8[], 'LUXURY_TRAVELER', 0.90, NOW(), 15, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING
    RETURNING id INTO uv1_id;

    -- Create ItemVectors (destinations)
    INSERT INTO item_vectors (id, "destinationId", "destinationName", "destinationType", vector, country, "popularityScore", "bookingCount", "searchCount", "lastUpdatedAt", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), 'DEST001', 'Paris', 'CITY', ARRAY[0.5, 0.9, 0.7, 0.6, 0.5, 0.8, 0.9, 0.8]::float8[], 'France', 0.95, 1000, 5000, NOW(), NOW(), NOW()),
        (gen_random_uuid(), 'DEST002', 'Bali', 'BEACH', ARRAY[0.8, 0.6, 0.6, 0.7, 0.6, 0.3, 0.7, 0.7]::float8[], 'Indonesia', 0.88, 800, 4000, NOW(), NOW(), NOW()),
        (gen_random_uuid(), 'DEST003', 'Tokyo', 'CITY', ARRAY[0.6, 0.9, 0.8, 0.7, 0.5, 0.9, 0.8, 0.9]::float8[], 'Japan', 0.92, 1200, 6000, NOW(), NOW(), NOW())
    ON CONFLICT ("destinationId") DO NOTHING;

    -- Create Recommendations (simplified)
    INSERT INTO recommendations (id, "userId", "itemVectorId", "destinationId", "destinationName", "destinationType", score, confidence, "contextType", "contextData", status, "viewedAt", "createdAt", "updatedAt")
    SELECT
        gen_random_uuid(),
        u.id,
        iv.id,
        iv."destinationId",
        iv."destinationName",
        iv."destinationType",
        0.85,
        0.80,
        'PERSONALIZED',
        '{}'::jsonb,
        CASE (row_number() OVER ()) % 4
            WHEN 0 THEN 'BOOKED'
            WHEN 1 THEN 'CLICKED'
            WHEN 2 THEN 'VIEWED'
            ELSE 'NOT_VIEWED'
        END::"RecommendationStatus",
        NOW() - interval '10 days',
        NOW() - interval '15 days',
        NOW()
    FROM users u
    CROSS JOIN item_vectors iv
    WHERE u.id IN (user1_id, user2_id)
    LIMIT 10;

    -- Create SearchHistory
    INSERT INTO search_history (id, "userId", origin, destination, "departureDate", "returnDate", passengers, "cabinClass", "searchedAt", "resultsCount")
    SELECT
        gen_random_uuid(),
        u.id,
        'Paris',
        iv."destinationName",
        NOW() + interval '30 days',
        NOW() + interval '37 days',
        2,
        'ECONOMY',
        NOW() - interval '20 days',
        50
    FROM users u
    CROSS JOIN item_vectors iv
    WHERE u.id IN (user1_id, user2_id)
    LIMIT 6;

    RAISE NOTICE 'ML data seeded successfully!';
END $$;
