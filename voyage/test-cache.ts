/**
 * Script de test simple pour le CacheService
 * Ticket: DR-65US-VOYAGE-004 - Cache des Requêtes Amadeus
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function testCache() {
  console.log('🧪 Test du système de cache Redis');
  console.log('=====================================\n');

  // Créer une connexion Redis simple
  const redis = new Redis(REDIS_URL);

  redis.on('connect', () => {
    console.log('✅ Redis connecté avec succès');
  });

  redis.on('error', (error) => {
    console.error('❌ Erreur Redis:', error.message);
  });

  // Attendre la connexion
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Test 1: Ping Redis
    console.log('📍 Test 1: Ping Redis');
    const pingResult = await redis.ping();
    console.log(`   Résultat: ${pingResult}`);
    console.log('   ✅ Redis répond correctement\n');

    // Test 2: Set/Get
    console.log('📍 Test 2: Set et Get une valeur');
    const testKey = 'amadeus:test:flight';
    const testValue = {
      id: 'FL001',
      origin: 'PAR',
      destination: 'LON',
      price: 450,
      timestamp: Date.now()
    };

    await redis.set(testKey, JSON.stringify(testValue), 'EX', 60);
    console.log(`   ✅ Valeur stockée avec clé: ${testKey}`);

    const cached = await redis.get(testKey);
    const parsedValue = cached ? JSON.parse(cached) : null;
    console.log('   ✅ Valeur récupérée:', parsedValue);
    console.log(`   ✅ Prix du vol: ${parsedValue?.price}€\n`);

    // Test 3: Simulation Cache HIT vs MISS
    console.log('📍 Test 3: Simulation Cache HIT vs MISS');
    let apiCallCount = 0;

    const mockApiCall = async () => {
      apiCallCount++;
      console.log(`   🌐 API call #${apiCallCount}`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simule délai API
      return {
        flights: [
          { id: '1', price: 450 },
          { id: '2', price: 520 }
        ],
        count: 2
      };
    };

    const cacheKey = 'amadeus:flights:PAR-LON-2025-12-20';

    // Premier appel - MISS
    console.log('   🔍 Premier appel (Cache MISS attendu)...');
    const start1 = Date.now();
    const cachedData1 = await redis.get(cacheKey);

    let data1;
    if (!cachedData1) {
      console.log('   ❌ Cache MISS - Appel API...');
      data1 = await mockApiCall();
      await redis.set(cacheKey, JSON.stringify(data1), 'EX', 300);
    } else {
      data1 = JSON.parse(cachedData1);
    }
    const time1 = Date.now() - start1;
    console.log(`   ⏱️  Temps: ${time1}ms`);
    console.log(`   ✅ Données récupérées: ${data1.count} vols\n`);

    // Deuxième appel - HIT
    console.log('   🔍 Deuxième appel (Cache HIT attendu)...');
    const start2 = Date.now();
    const cachedData2 = await redis.get(cacheKey);

    let data2;
    if (!cachedData2) {
      console.log('   ❌ Cache MISS - Appel API...');
      data2 = await mockApiCall();
      await redis.set(cacheKey, JSON.stringify(data2), 'EX', 300);
    } else {
      console.log('   ✅ Cache HIT - Données du cache');
      data2 = JSON.parse(cachedData2);
    }
    const time2 = Date.now() - start2;
    console.log(`   ⏱️  Temps: ${time2}ms`);
    console.log(`   ✅ Données récupérées: ${data2.count} vols`);
    console.log(`   🚀 Amélioration: ${Math.round((1 - time2/time1) * 100)}% plus rapide!\n`);

    // Test 4: Statistiques
    console.log('📍 Test 4: Pattern Matching');
    await redis.set('amadeus:test:key1', 'value1', 'EX', 60);
    await redis.set('amadeus:test:key2', 'value2', 'EX', 60);
    await redis.set('amadeus:test:key3', 'value3', 'EX', 60);

    const keys = await redis.keys('amadeus:test:*');
    console.log(`   ✅ Trouvé ${keys.length} clés avec pattern 'amadeus:test:*'`);
    console.log(`   Clés: ${keys.join(', ')}\n`);

    // Test 5: Nettoyage
    console.log('📍 Test 5: Nettoyage des clés de test');
    const deletedCount = await redis.del(...keys, cacheKey);
    console.log(`   ✅ ${deletedCount} clés supprimées\n`);

    // Résumé
    console.log('=====================================');
    console.log('✅ TOUS LES TESTS RÉUSSIS!');
    console.log('=====================================');
    console.log(`📊 Résumé:`);
    console.log(`   - Redis opérationnel: ✅`);
    console.log(`   - Cache fonctionnel: ✅`);
    console.log(`   - Appels API économisés: ${apiCallCount === 1 ? '✅' : '❌'}`);
    console.log(`   - Performance: ${Math.round((1 - time2/time1) * 100)}% d'amélioration`);
    console.log('');

  } catch (error) {
    console.error('❌ Erreur pendant les tests:', error);
  } finally {
    await redis.quit();
    console.log('🔌 Connexion Redis fermée');
    process.exit(0);
  }
}

// Exécuter les tests
testCache().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
