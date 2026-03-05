-- Seed ML Data - Realistic Dataset for Training
-- Generates 100 users, 50 destinations, 1000+ recommendations
-- All data is coherent and realistic

DO $$
DECLARE
    -- User segment definitions (8D vectors + preferences)
    user_segments JSON := '[
        {
            "segment": "ADVENTURE_SEEKER",
            "vector": [0.6, 0.7, 0.4, 0.9, 0.5, 0.3, 0.6, 0.4],
            "travel_types": ["ADVENTURE", "NATURE"],
            "budget_range": {"min": 1000, "max": 3000},
            "activity_level": "HIGH",
            "accommodation": "STANDARD",
            "nationalities": ["FR", "DE", "UK", "US", "AU"]
        },
        {
            "segment": "LUXURY_TRAVELER",
            "vector": [0.8, 0.6, 0.9, 0.3, 0.7, 0.8, 0.9, 0.8],
            "travel_types": ["RELAXATION", "CULTURAL"],
            "budget_range": {"min": 5000, "max": 15000},
            "activity_level": "LOW",
            "accommodation": "LUXURY",
            "nationalities": ["US", "UK", "AE", "CH", "JP"]
        },
        {
            "segment": "BUDGET_BACKPACKER",
            "vector": [0.5, 0.8, 0.2, 0.7, 0.6, 0.4, 0.5, 0.3],
            "travel_types": ["ADVENTURE", "CULTURAL", "NATURE"],
            "budget_range": {"min": 500, "max": 1500},
            "activity_level": "HIGH",
            "accommodation": "BASIC",
            "nationalities": ["FR", "ES", "DE", "NL", "AU"]
        },
        {
            "segment": "FAMILY_EXPLORER",
            "vector": [0.7, 0.5, 0.6, 0.6, 0.9, 0.6, 0.8, 0.7],
            "travel_types": ["BEACH", "CULTURAL", "RELAXATION"],
            "budget_range": {"min": 3000, "max": 7000},
            "activity_level": "MODERATE",
            "accommodation": "PREMIUM",
            "nationalities": ["FR", "UK", "DE", "US", "CA"]
        },
        {
            "segment": "BUSINESS_TRAVELER",
            "vector": [0.4, 0.5, 0.7, 0.4, 0.3, 0.9, 0.7, 0.6],
            "travel_types": ["BUSINESS"],
            "budget_range": {"min": 2000, "max": 5000},
            "activity_level": "LOW",
            "accommodation": "PREMIUM",
            "nationalities": ["US", "UK", "FR", "DE", "JP"]
        },
        {
            "segment": "CULTURE_ENTHUSIAST",
            "vector": [0.5, 0.9, 0.5, 0.5, 0.4, 0.7, 0.8, 0.5],
            "travel_types": ["CULTURAL", "CULINARY"],
            "budget_range": {"min": 2000, "max": 5000},
            "activity_level": "MODERATE",
            "accommodation": "STANDARD",
            "nationalities": ["FR", "IT", "ES", "JP", "UK"]
        }
    ]'::JSON;

    -- Destination definitions (50 destinations)
    destinations JSON := '[
        {"id": "PAR", "name": "Paris", "type": "CITY", "country": "France", "vector": [0.6, 0.9, 0.7, 0.5, 0.6, 0.9, 0.9, 0.9], "popularity": 0.95},
        {"id": "LON", "name": "London", "type": "CITY", "country": "UK", "vector": [0.5, 0.8, 0.8, 0.6, 0.5, 0.9, 0.8, 0.9], "popularity": 0.93},
        {"id": "NYC", "name": "New York", "type": "CITY", "country": "USA", "vector": [0.4, 0.7, 0.9, 0.7, 0.5, 1.0, 0.9, 0.95], "popularity": 0.96},
        {"id": "TOK", "name": "Tokyo", "type": "CITY", "country": "Japan", "vector": [0.5, 0.9, 0.7, 0.6, 0.5, 0.9, 1.0, 0.85], "popularity": 0.92},
        {"id": "ROM", "name": "Rome", "type": "CITY", "country": "Italy", "vector": [0.7, 0.95, 0.6, 0.5, 0.6, 0.8, 0.95, 0.88], "popularity": 0.91},
        {"id": "BAR", "name": "Barcelona", "type": "CITY", "country": "Spain", "vector": [0.8, 0.8, 0.6, 0.6, 0.6, 0.8, 0.9, 0.87], "popularity": 0.89},
        {"id": "DUB", "name": "Dubai", "type": "CITY", "country": "UAE", "vector": [0.9, 0.4, 0.9, 0.5, 0.7, 0.9, 0.8, 0.92], "popularity": 0.88},
        {"id": "SIN", "name": "Singapore", "type": "CITY", "country": "Singapore", "vector": [0.9, 0.7, 0.8, 0.6, 0.6, 1.0, 0.95, 0.86], "popularity": 0.85},

        {"id": "BAL", "name": "Bali", "type": "BEACH", "country": "Indonesia", "vector": [0.9, 0.6, 0.4, 0.7, 0.6, 0.3, 0.7, 0.82], "popularity": 0.88},
        {"id": "MAL", "name": "Maldives", "type": "BEACH", "country": "Maldives", "vector": [1.0, 0.3, 0.8, 0.3, 0.8, 0.1, 0.6, 0.75], "popularity": 0.84},
        {"id": "CAN", "name": "Cancun", "type": "BEACH", "country": "Mexico", "vector": [0.9, 0.4, 0.6, 0.6, 0.7, 0.2, 0.8, 0.81], "popularity": 0.83},
        {"id": "PUK", "name": "Phuket", "type": "BEACH", "country": "Thailand", "vector": [0.9, 0.5, 0.3, 0.7, 0.6, 0.2, 0.8, 0.79], "popularity": 0.80},
        {"id": "SAN", "name": "Santorini", "type": "BEACH", "country": "Greece", "vector": [0.9, 0.7, 0.7, 0.4, 0.7, 0.3, 0.85, 0.86], "popularity": 0.87},

        {"id": "REY", "name": "Reykjavik", "type": "NATURE", "country": "Iceland", "vector": [0.1, 0.8, 0.6, 0.8, 0.5, 0.2, 0.6, 0.71], "popularity": 0.76},
        {"id": "BAN", "name": "Banff", "type": "NATURE", "country": "Canada", "vector": [0.3, 0.6, 0.6, 0.9, 0.6, 0.1, 0.5, 0.68], "popularity": 0.72},
        {"id": "PAT", "name": "Patagonia", "type": "NATURE", "country": "Argentina", "vector": [0.2, 0.7, 0.5, 0.95, 0.5, 0.1, 0.4, 0.65], "popularity": 0.69},
        {"id": "NZL", "name": "Queenstown", "type": "NATURE", "country": "New Zealand", "vector": [0.4, 0.6, 0.6, 0.9, 0.5, 0.2, 0.6, 0.73], "popularity": 0.74},
        {"id": "SWI", "name": "Swiss Alps", "type": "NATURE", "country": "Switzerland", "vector": [0.2, 0.5, 0.8, 0.8, 0.6, 0.3, 0.7, 0.77], "popularity": 0.81},

        {"id": "KYO", "name": "Kyoto", "type": "CULTURAL", "country": "Japan", "vector": [0.5, 0.95, 0.5, 0.4, 0.5, 0.6, 0.9, 0.78], "popularity": 0.83},
        {"id": "MAR", "name": "Marrakech", "type": "CULTURAL", "country": "Morocco", "vector": [0.9, 0.9, 0.3, 0.6, 0.6, 0.5, 0.85, 0.74], "popularity": 0.77},
        {"id": "IST", "name": "Istanbul", "type": "CULTURAL", "country": "Turkey", "vector": [0.6, 0.9, 0.5, 0.6, 0.6, 0.7, 0.9, 0.79], "popularity": 0.82},
        {"id": "PRA", "name": "Prague", "type": "CULTURAL", "country": "Czech Republic", "vector": [0.4, 0.9, 0.4, 0.5, 0.5, 0.7, 0.8, 0.76], "popularity": 0.80},

        {"id": "LIS", "name": "Lisbon", "type": "CITY", "country": "Portugal", "vector": [0.7, 0.8, 0.5, 0.6, 0.6, 0.7, 0.85, 0.82], "popularity": 0.84},
        {"id": "AMS", "name": "Amsterdam", "type": "CITY", "country": "Netherlands", "vector": [0.5, 0.7, 0.7, 0.6, 0.5, 0.8, 0.8, 0.85], "popularity": 0.86},
        {"id": "BER", "name": "Berlin", "type": "CITY", "country": "Germany", "vector": [0.4, 0.8, 0.5, 0.6, 0.5, 0.9, 0.75, 0.81], "popularity": 0.83},
        {"id": "VIE", "name": "Vienna", "type": "CITY", "country": "Austria", "vector": [0.5, 0.9, 0.7, 0.4, 0.6, 0.8, 0.85, 0.84], "popularity": 0.82},
        {"id": "BUD", "name": "Budapest", "type": "CITY", "country": "Hungary", "vector": [0.5, 0.85, 0.4, 0.5, 0.5, 0.7, 0.8, 0.78], "popularity": 0.79},

        {"id": "BKK", "name": "Bangkok", "type": "CITY", "country": "Thailand", "vector": [0.9, 0.7, 0.3, 0.7, 0.6, 0.8, 0.9, 0.80], "popularity": 0.85},
        {"id": "HKG", "name": "Hong Kong", "type": "CITY", "country": "China", "vector": [0.8, 0.6, 0.8, 0.5, 0.5, 1.0, 0.95, 0.88], "popularity": 0.87},
        {"id": "SEO", "name": "Seoul", "type": "CITY", "country": "South Korea", "vector": [0.6, 0.7, 0.6, 0.6, 0.5, 0.9, 0.9, 0.83], "popularity": 0.84},

        {"id": "CPT", "name": "Cape Town", "type": "NATURE", "country": "South Africa", "vector": [0.7, 0.6, 0.5, 0.8, 0.6, 0.4, 0.7, 0.72], "popularity": 0.75},
        {"id": "RIO", "name": "Rio de Janeiro", "type": "BEACH", "country": "Brazil", "vector": [0.9, 0.6, 0.5, 0.8, 0.6, 0.6, 0.8, 0.78], "popularity": 0.81},
        {"id": "LIM", "name": "Lima", "type": "CULTURAL", "country": "Peru", "vector": [0.7, 0.8, 0.4, 0.6, 0.6, 0.6, 0.9, 0.73], "popularity": 0.74},

        {"id": "EDI", "name": "Edinburgh", "type": "CULTURAL", "country": "UK", "vector": [0.3, 0.9, 0.6, 0.5, 0.5, 0.6, 0.75, 0.79], "popularity": 0.78},
        {"id": "DUB2", "name": "Dublin", "type": "CULTURAL", "country": "Ireland", "vector": [0.4, 0.8, 0.6, 0.5, 0.5, 0.7, 0.8, 0.77], "popularity": 0.76},
        {"id": "COP", "name": "Copenhagen", "type": "CITY", "country": "Denmark", "vector": [0.3, 0.7, 0.8, 0.6, 0.6, 0.8, 0.75, 0.83], "popularity": 0.81},
        {"id": "STO", "name": "Stockholm", "type": "CITY", "country": "Sweden", "vector": [0.2, 0.7, 0.8, 0.6, 0.6, 0.8, 0.7, 0.82], "popularity": 0.80},

        {"id": "MIL", "name": "Milan", "type": "CITY", "country": "Italy", "vector": [0.6, 0.8, 0.8, 0.5, 0.5, 0.9, 0.9, 0.87], "popularity": 0.86},
        {"id": "VEN", "name": "Venice", "type": "CULTURAL", "country": "Italy", "vector": [0.6, 0.95, 0.7, 0.4, 0.6, 0.5, 0.85, 0.88], "popularity": 0.89},
        {"id": "FLO", "name": "Florence", "type": "CULTURAL", "country": "Italy", "vector": [0.7, 0.95, 0.6, 0.5, 0.6, 0.6, 0.9, 0.86], "popularity": 0.85},

        {"id": "MEX", "name": "Mexico City", "type": "CULTURAL", "country": "Mexico", "vector": [0.7, 0.9, 0.4, 0.6, 0.6, 0.8, 0.95, 0.76], "popularity": 0.78},
        {"id": "BUE", "name": "Buenos Aires", "type": "CITY", "country": "Argentina", "vector": [0.7, 0.8, 0.5, 0.6, 0.5, 0.8, 0.9, 0.77], "popularity": 0.79},

        {"id": "ZUR", "name": "Zurich", "type": "CITY", "country": "Switzerland", "vector": [0.3, 0.6, 0.9, 0.5, 0.5, 0.8, 0.75, 0.84], "popularity": 0.82},
        {"id": "MUN", "name": "Munich", "type": "CITY", "country": "Germany", "vector": [0.4, 0.8, 0.7, 0.6, 0.6, 0.7, 0.85, 0.83], "popularity": 0.81},

        {"id": "SAF", "name": "Safari Kenya", "type": "NATURE", "country": "Kenya", "vector": [0.9, 0.5, 0.7, 0.8, 0.7, 0.1, 0.6, 0.70], "popularity": 0.74},
        {"id": "GBR", "name": "Great Barrier Reef", "type": "NATURE", "country": "Australia", "vector": [0.9, 0.4, 0.6, 0.8, 0.6, 0.1, 0.5, 0.71], "popularity": 0.76},
        {"id": "MAC", "name": "Machu Picchu", "type": "CULTURAL", "country": "Peru", "vector": [0.6, 0.95, 0.5, 0.8, 0.5, 0.2, 0.7, 0.75], "popularity": 0.85},

        {"id": "VAN", "name": "Vancouver", "type": "CITY", "country": "Canada", "vector": [0.4, 0.6, 0.7, 0.7, 0.6, 0.7, 0.7, 0.79], "popularity": 0.80},
        {"id": "SYD", "name": "Sydney", "type": "CITY", "country": "Australia", "vector": [0.8, 0.6, 0.7, 0.7, 0.6, 0.8, 0.8, 0.84], "popularity": 0.87},
        {"id": "MEL", "name": "Melbourne", "type": "CITY", "country": "Australia", "vector": [0.7, 0.7, 0.7, 0.6, 0.6, 0.8, 0.85, 0.82], "popularity": 0.83}
    ]'::JSON;

    segment JSON;
    dest JSON;
    user_id TEXT;
    user_ids TEXT[] := ARRAY[]::TEXT[];
    dest_id TEXT;
    dest_ids TEXT[] := ARRAY[]::TEXT[];
    i INT;
    j INT;
    rec_status TEXT;
    rec_score FLOAT;
    viewed_date TIMESTAMP;

BEGIN
    RAISE NOTICE '🌍 Starting realistic ML data generation...';

    -- ========================================
    -- STEP 1: Create 100 Users with realistic profiles
    -- ========================================
    RAISE NOTICE '👥 Creating 100 users across 6 segments...';

    FOR i IN 1..100 LOOP
        -- Select random segment
        segment := (user_segments->((RANDOM() * 5)::INT))::JSON;

        -- Insert user
        INSERT INTO users (
            id, email, password, "firstName", "lastName", "dateOfBirth", nationality,
            "userCategory", "onboardingCompleted", role, "isVerified", created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            'user' || i || '@dreamscape.test',
            '$2a$10$dummyhashedpasswordforseeding',
            'User',
            'Test' || i,
            NOW() - (INTERVAL '1 year' * (25 + RANDOM() * 35)), -- Age 25-60
            (segment->'nationalities'->>((RANDOM() * (jsonb_array_length((segment->'nationalities')::jsonb) - 1))::INT)),
            (CASE WHEN segment->>'segment' = 'BUSINESS_TRAVELER' THEN 'BUSINESS' ELSE 'LEISURE' END)::"UserCategory",
            TRUE,
            'USER'::"Role",
            TRUE,
            NOW() - (INTERVAL '1 day' * (RANDOM() * 365)),
            NOW()
        ) RETURNING id INTO user_id;

        user_ids := array_append(user_ids, user_id);

        -- Insert UserVector
        INSERT INTO user_vectors (
            id, "userId", vector, "primarySegment", "segmentConfidence", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid(),
            user_id,
            jsonb_build_array(
                (segment->'vector'->>0)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>1)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>2)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>3)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>4)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>5)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>6)::FLOAT + (RANDOM() * 0.2 - 0.1),
                (segment->'vector'->>7)::FLOAT + (RANDOM() * 0.2 - 0.1)
            ),
            segment->>'segment',
            0.75 + RANDOM() * 0.2,
            NOW() - (INTERVAL '1 day' * (RANDOM() * 30)),
            NOW()
        );

        -- Insert TravelOnboardingProfile (for 80% of users)
        IF RANDOM() < 0.8 THEN
            INSERT INTO travel_onboarding_profiles (
                id, "userId", "travelTypes", "globalBudgetRange",
                "activityLevel", "accommodationLevel", "travelWithChildren",
                "climatePreferences", "riskTolerance", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                user_id,
                (SELECT ARRAY_AGG(value::TEXT::"TravelType")
                 FROM jsonb_array_elements_text((segment->'travel_types')::jsonb)),
                segment->'budget_range',
                (segment->>'activity_level')::"ActivityLevel",
                (segment->>'accommodation')::"ComfortLevel",
                CASE WHEN segment->>'segment' = 'FAMILY_EXPLORER' THEN TRUE ELSE RANDOM() < 0.3 END,
                ARRAY['WARM'],
                'MODERATE'::"RiskTolerance",
                NOW() - (INTERVAL '1 day' * (RANDOM() * 60)),
                NOW()
            );
        END IF;

        -- Insert UserPreferences
        INSERT INTO user_preferences (
            id, "userId", "budgetRange", "preferredCabinClass"
        ) VALUES (
            gen_random_uuid(),
            user_id,
            segment->'budget_range',
            CASE
                WHEN segment->>'segment' = 'LUXURY_TRAVELER' THEN 'BUSINESS'
                WHEN segment->>'segment' = 'BUDGET_BACKPACKER' THEN 'ECONOMY'
                ELSE 'PREMIUM_ECONOMY'
            END
        );
    END LOOP;

    RAISE NOTICE '✅ Created 100 users';

    -- ========================================
    -- STEP 2: Create 50 Destinations
    -- ========================================
    RAISE NOTICE '🏖️  Creating 50 destinations...';

    FOR i IN 0..49 LOOP
        dest := (destinations->i)::JSON;

        INSERT INTO item_vectors (
            id, "destinationId", "destinationType", name, vector, country,
            "popularityScore", "bookingCount", "searchCount", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid(),
            dest->>'id',
            dest->>'type',
            dest->>'name',
            jsonb_build_array(
                (dest->'vector'->>0)::FLOAT,
                (dest->'vector'->>1)::FLOAT,
                (dest->'vector'->>2)::FLOAT,
                (dest->'vector'->>3)::FLOAT,
                (dest->'vector'->>4)::FLOAT,
                (dest->'vector'->>5)::FLOAT,
                (dest->'vector'->>6)::FLOAT,
                (dest->'vector'->>7)::FLOAT
            ),
            dest->>'country',
            (dest->>'popularity')::FLOAT,
            (500 + RANDOM() * 2000)::INT,
            (2000 + RANDOM() * 8000)::INT,
            NOW() - (INTERVAL '1 day' * (RANDOM() * 180)),
            NOW()
        ) RETURNING "destinationId" INTO dest_id;

        dest_ids := array_append(dest_ids, dest_id);
    END LOOP;

    RAISE NOTICE '✅ Created 50 destinations';

    -- ========================================
    -- STEP 3: Create Recommendations (1500-2000 recommendations)
    -- ========================================
    RAISE NOTICE '⭐ Creating realistic recommendations...';

    FOR i IN 1..ARRAY_LENGTH(user_ids, 1) LOOP
        user_id := user_ids[i];

        -- Each user gets 15-20 recommendations
        FOR j IN 1..(15 + (RANDOM() * 5)::INT) LOOP
            dest_id := dest_ids[(RANDOM() * (ARRAY_LENGTH(dest_ids, 1) - 1) + 1)::INT];

            -- Realistic status distribution:
            -- 60% GENERATED, 25% VIEWED, 10% CLICKED, 4% BOOKED, 1% REJECTED
            DECLARE
                rand FLOAT := RANDOM();
            BEGIN
                IF rand < 0.60 THEN
                    rec_status := 'GENERATED';
                    viewed_date := NULL;
                ELSIF rand < 0.85 THEN
                    rec_status := 'VIEWED';
                    viewed_date := NOW() - (INTERVAL '1 day' * (RANDOM() * 30));
                ELSIF rand < 0.95 THEN
                    rec_status := 'CLICKED';
                    viewed_date := NOW() - (INTERVAL '1 day' * (RANDOM() * 20));
                ELSIF rand < 0.99 THEN
                    rec_status := 'BOOKED';
                    viewed_date := NOW() - (INTERVAL '1 day' * (RANDOM() * 15));
                ELSE
                    rec_status := 'REJECTED';
                    viewed_date := NOW() - (INTERVAL '1 day' * (RANDOM() * 25));
                END IF;
            END;

            -- Score depends on status (higher for clicked/booked)
            rec_score := CASE rec_status
                WHEN 'BOOKED' THEN 0.85 + RANDOM() * 0.12
                WHEN 'CLICKED' THEN 0.75 + RANDOM() * 0.15
                WHEN 'VIEWED' THEN 0.65 + RANDOM() * 0.20
                WHEN 'REJECTED' THEN 0.40 + RANDOM() * 0.20
                ELSE 0.50 + RANDOM() * 0.30
            END;

            INSERT INTO recommendations (
                id, "userId", "userVectorId", "itemVectorId",
                "destinationId", "destinationName", "destinationType",
                score, confidence, "contextType", "contextData", status,
                "viewedAt", "expiresAt", "createdAt", "updatedAt"
            )
            SELECT
                gen_random_uuid(),
                user_id,
                uv.id,
                iv.id,
                dest_id,
                iv.name,
                iv."destinationType",
                rec_score,
                0.75 + RANDOM() * 0.20,
                'PERSONALIZED',
                '{}'::jsonb,
                rec_status::"RecommendationStatus",
                viewed_date,
                NOW() + INTERVAL '30 days',
                NOW() - (INTERVAL '1 day' * (RANDOM() * 45)),
                NOW()
            FROM user_vectors uv
            INNER JOIN item_vectors iv ON iv."destinationId" = dest_id
            WHERE uv."userId" = user_id
            LIMIT 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Created recommendations';

    -- ========================================
    -- STEP 4: Create Search History (500-800 searches)
    -- ========================================
    RAISE NOTICE '🔍 Creating search history...';

    FOR i IN 1..ARRAY_LENGTH(user_ids, 1) LOOP
        user_id := user_ids[i];

        -- Each user has 5-8 searches
        FOR j IN 1..(5 + (RANDOM() * 3)::INT) LOOP
            dest_id := dest_ids[(RANDOM() * (ARRAY_LENGTH(dest_ids, 1) - 1) + 1)::INT];

            INSERT INTO search_history (
                id, "userId", "sessionId", origin, destination,
                "departureDate", "returnDate", passengers, "cabinClass",
                "searchedAt", "resultsCount"
            )
            SELECT
                gen_random_uuid(),
                user_id,
                gen_random_uuid(),
                CASE (RANDOM() * 5)::INT
                    WHEN 0 THEN 'Paris'
                    WHEN 1 THEN 'London'
                    WHEN 2 THEN 'New York'
                    WHEN 3 THEN 'Tokyo'
                    ELSE 'Berlin'
                END,
                iv.name,
                NOW() + (INTERVAL '1 day' * (30 + RANDOM() * 60)),
                NOW() + (INTERVAL '1 day' * (37 + RANDOM() * 60)),
                to_jsonb(1 + (RANDOM() * 3)::INT),
                CASE (RANDOM() * 3)::INT
                    WHEN 0 THEN 'ECONOMY'
                    WHEN 1 THEN 'PREMIUM_ECONOMY'
                    ELSE 'BUSINESS'
                END,
                NOW() - (INTERVAL '1 day' * (RANDOM() * 60)),
                (20 + (RANDOM() * 80)::INT)
            FROM item_vectors iv
            WHERE iv."destinationId" = dest_id
            LIMIT 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Created search history';

    -- ========================================
    -- Statistics
    -- ========================================
    RAISE NOTICE '';
    RAISE NOTICE '📊 DATASET STATISTICS:';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Users: %', (SELECT COUNT(*) FROM users WHERE "onboardingCompleted" = TRUE);
    RAISE NOTICE 'User Vectors: %', (SELECT COUNT(*) FROM user_vectors);
    RAISE NOTICE 'Onboarding Profiles: %', (SELECT COUNT(*) FROM travel_onboarding_profiles);
    RAISE NOTICE 'Destinations: %', (SELECT COUNT(*) FROM item_vectors);
    RAISE NOTICE 'Recommendations: %', (SELECT COUNT(*) FROM recommendations);
    RAISE NOTICE '  - GENERATED: %', (SELECT COUNT(*) FROM recommendations WHERE status = 'GENERATED');
    RAISE NOTICE '  - VIEWED: %', (SELECT COUNT(*) FROM recommendations WHERE status = 'VIEWED');
    RAISE NOTICE '  - CLICKED: %', (SELECT COUNT(*) FROM recommendations WHERE status = 'CLICKED');
    RAISE NOTICE '  - BOOKED: %', (SELECT COUNT(*) FROM recommendations WHERE status = 'BOOKED');
    RAISE NOTICE '  - REJECTED: %', (SELECT COUNT(*) FROM recommendations WHERE status = 'REJECTED');
    RAISE NOTICE 'Search History: %', (SELECT COUNT(*) FROM search_history);
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ Realistic ML dataset generation completed!';

END $$;
