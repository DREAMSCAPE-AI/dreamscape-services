-- Minimal ML seed matching actual schema
DO $$
DECLARE
    user1_id text;
    user2_id text;
BEGIN
    SELECT id INTO user1_id FROM users LIMIT 1;
    SELECT id INTO user2_id FROM users OFFSET 1 LIMIT 1;

    UPDATE users SET "onboardingCompleted" = TRUE WHERE id IN (user1_id, user2_id);

    -- UserVectors (vector is JSONB not array)
    INSERT INTO user_vectors (id, "userId", vector, "primarySegment", "segmentConfidence", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), user1_id, '[0.7, 0.8, 0.5, 0.9, 0.6, 0.4, 0.7, 0.5]'::jsonb, 'ADVENTURE_SEEKER', 0.85, NOW(), NOW()),
        (gen_random_uuid(), user2_id, '[0.3, 0.5, 0.8, 0.4, 0.7, 0.2, 0.6, 0.7]'::jsonb, 'LUXURY_TRAVELER', 0.90, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING;

    -- ItemVectors (check actual schema)
    INSERT INTO item_vectors (id, "destinationId", "destinationName", "destinationType", vector, country, "popularityScore", "bookingCount", "searchCount", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), 'DEST001', 'Paris', 'CITY', '[0.5, 0.9, 0.7, 0.6, 0.5, 0.8, 0.9, 0.8]'::jsonb, 'France', 0.95, 1000, 5000, NOW(), NOW()),
        (gen_random_uuid(), 'DEST002', 'Bali', 'BEACH', '[0.8, 0.6, 0.6, 0.7, 0.6, 0.3, 0.7, 0.7]'::jsonb, 'Indonesia', 0.88, 800, 4000, NOW(), NOW())
    ON CONFLICT ("destinationId") DO NOTHING;

    -- Recommendations
    INSERT INTO recommendations (id, "userId", "destinationId", "destinationName", "destinationType", score, confidence, "contextType", "contextData", status, "viewedAt", "createdAt", "updatedAt")
    SELECT
        gen_random_uuid(), u.id, iv."destinationId", iv."destinationName", iv."destinationType",
        0.85, 0.80, 'PERSONALIZED', '{}'::jsonb,
        CASE (row_number() OVER ()) % 4 WHEN 0 THEN 'BOOKED' WHEN 1 THEN 'CLICKED' WHEN 2 THEN 'VIEWED' ELSE 'NOT_VIEWED' END::"RecommendationStatus",
        NOW() - interval '10 days', NOW() - interval '15 days', NOW()
    FROM users u CROSS JOIN item_vectors iv WHERE u.id IN (user1_id, user2_id) LIMIT 6;

    -- SearchHistory
    INSERT INTO search_history (id, "userId", origin, destination, "departureDate", "returnDate", passengers, "cabinClass", "searchedAt", "resultsCount")
    SELECT
        gen_random_uuid(), u.id, 'Paris', iv."destinationName",
        NOW() + interval '30 days', NOW() + interval '37 days', 2, 'ECONOMY',
        NOW() - interval '20 days', 50
    FROM users u CROSS JOIN item_vectors iv WHERE u.id IN (user1_id, user2_id) LIMIT 4;

    RAISE NOTICE '✅ Minimal ML data created!';
END $$;
