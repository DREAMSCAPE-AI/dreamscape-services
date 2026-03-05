-- Final ML seed matching real schemas
DO $$
DECLARE
    user1_id text;
    user2_id text;
    uv1_id text;
    uv2_id text;
    iv1_id text;
    iv2_id text;
BEGIN
    SELECT id INTO user1_id FROM users LIMIT 1;
    SELECT id INTO user2_id FROM users OFFSET 1 LIMIT 1;

    UPDATE users SET "onboardingCompleted" = TRUE WHERE id IN (user1_id, user2_id);

    -- UserVectors
    INSERT INTO user_vectors (id, "userId", vector, "primarySegment", "segmentConfidence", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), user1_id, '[0.7, 0.8, 0.5, 0.9, 0.6, 0.4, 0.7, 0.5]'::jsonb, 'ADVENTURE_SEEKER', 0.85, NOW(), NOW()),
        (gen_random_uuid(), user2_id, '[0.3, 0.5, 0.8, 0.4, 0.7, 0.2, 0.6, 0.7]'::jsonb, 'LUXURY_TRAVELER', 0.90, NOW(), NOW())
    ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = NOW();

    SELECT id INTO uv1_id FROM user_vectors WHERE "userId" = user1_id LIMIT 1;
    SELECT id INTO uv2_id FROM user_vectors WHERE "userId" = user2_id LIMIT 1;

    -- ItemVectors
    INSERT INTO item_vectors (id, "destinationId", "destinationType", name, vector, country, "popularityScore", "bookingCount", "searchCount", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), 'DEST001', 'CITY', 'Paris', '[0.5, 0.9, 0.7, 0.6, 0.5, 0.8, 0.9, 0.8]'::jsonb, 'France', 0.95, 1000, 5000, NOW(), NOW()),
        (gen_random_uuid(), 'DEST002', 'BEACH', 'Bali', '[0.8, 0.6, 0.6, 0.7, 0.6, 0.3, 0.7, 0.7]'::jsonb, 'Indonesia', 0.88, 800, 4000, NOW(), NOW())
    ON CONFLICT ("destinationId", "destinationType") DO UPDATE SET "updatedAt" = NOW();

    SELECT id INTO iv1_id FROM item_vectors WHERE "destinationId" = 'DEST001' LIMIT 1;
    SELECT id INTO iv2_id FROM item_vectors WHERE "destinationId" = 'DEST002' LIMIT 1;

    -- Recommendations
    INSERT INTO recommendations (id, "userId", "userVectorId", "itemVectorId", "destinationId", "destinationName", "destinationType", score, confidence, "contextType", "contextData", status, "viewedAt", "expiresAt", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), user1_id, uv1_id, iv1_id, 'DEST001', 'Paris', 'CITY', 0.90, 0.85, 'PERSONALIZED', '{}'::jsonb, 'VIEWED'::"RecommendationStatus", NOW() - interval '10 days', NOW() + interval '30 days', NOW() - interval '15 days', NOW()),
        (gen_random_uuid(), user1_id, uv1_id, iv2_id, 'DEST002', 'Bali', 'BEACH', 0.82, 0.80, 'PERSONALIZED', '{}'::jsonb, 'CLICKED'::"RecommendationStatus", NOW() - interval '5 days', NOW() + interval '30 days', NOW() - interval '12 days', NOW()),
        (gen_random_uuid(), user2_id, uv2_id, iv1_id, 'DEST001', 'Paris', 'CITY', 0.88, 0.83, 'PERSONALIZED', '{}'::jsonb, 'BOOKED'::"RecommendationStatus", NOW() - interval '8 days', NOW() + interval '30 days', NOW() - interval '14 days', NOW()),
        (gen_random_uuid(), user2_id, uv2_id, iv2_id, 'DEST002', 'Bali', 'BEACH', 0.95, 0.92, 'PERSONALIZED', '{}'::jsonb, 'VIEWED'::"RecommendationStatus", NOW() - interval '3 days', NOW() + interval '30 days', NOW() - interval '10 days', NOW());

    -- SearchHistory skipped (requires sessionId, not critical for ML testing)

    RAISE NOTICE '✅ ML data created: 2 users, 2 user_vectors, 2 item_vectors, 4 recommendations';
END $$;
