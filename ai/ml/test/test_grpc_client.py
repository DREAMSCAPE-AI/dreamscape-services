"""
US-IA-012 - gRPC Client Test

Simple Python client to test the ML gRPC service.

Usage:
    # Ensure gRPC server is running
    python test_grpc_client.py

Expected:
    - Returns top-20 predictions for test user
    - Latency < 100ms
    - Valid scores [0-1]

@module ml/test
"""

import sys
import os
import time
import grpc

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Import generated protobuf code
try:
    import proto.recommendation_pb2 as pb2
    import proto.recommendation_pb2_grpc as pb2_grpc
except ImportError:
    print("❌ Protobuf code not generated. Run:")
    print("   python -m grpc_tools.protoc -I./proto --python_out=./proto --grpc_python_out=./proto ./proto/recommendation.proto")
    sys.exit(1)


def test_get_recommendations():
    """
    Test GetRecommendations RPC call.
    """
    print("🧪 Testing GetRecommendations...")

    # Create gRPC channel
    channel = grpc.insecure_channel('localhost:50051')
    stub = pb2_grpc.RecommendationServiceStub(channel)

    # Create request
    request = pb2.RecommendationRequest(
        user_id='test-user-001',
        top_k=10,
        model_version='v1.0',
        exclude_seen=[],
    )

    # Call service
    try:
        start_time = time.time()
        response = stub.GetRecommendations(request, timeout=5.0)
        latency = int((time.time() - start_time) * 1000)

        print(f"✅ GetRecommendations successful")
        print(f"   - Latency: {latency}ms")
        print(f"   - Model version: {response.model_version}")
        print(f"   - Inference time: {response.inference_time_ms}ms")
        print(f"   - From cache: {response.from_cache}")
        print(f"   - Total candidates: {response.total_candidates}")
        print(f"   - Warnings: {list(response.warnings)}")
        print(f"   - Results: {len(response.items)} items")

        if response.items:
            print("\n   Top 5 recommendations:")
            for i, item in enumerate(response.items[:5], 1):
                print(f"      {i}. {item.item_id} (score: {item.score:.4f})")

        # Validate scores
        for item in response.items:
            assert 0 <= item.score <= 1, f"Invalid score: {item.score}"

        print("\n✅ All validations passed")
        return True

    except grpc.RpcError as e:
        print(f"❌ gRPC error: {e.code()} - {e.details()}")
        return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_health_check():
    """
    Test HealthCheck RPC call.
    """
    print("\n🧪 Testing HealthCheck...")

    channel = grpc.insecure_channel('localhost:50051')
    stub = pb2_grpc.RecommendationServiceStub(channel)

    request = pb2.HealthCheckRequest(service='recommendation')

    try:
        response = stub.HealthCheck(request, timeout=2.0)

        status_map = {
            0: 'UNKNOWN',
            1: 'SERVING',
            2: 'NOT_SERVING',
            3: 'SERVICE_UNKNOWN',
        }

        print(f"✅ HealthCheck successful")
        print(f"   - Status: {status_map.get(response.status, 'UNKNOWN')}")
        print(f"   - Model ready: {response.model_ready}")
        print(f"   - Cache connected: {response.cache_connected}")
        print(f"   - Uptime: {response.uptime_seconds}s")
        print(f"   - Metadata: {dict(response.metadata)}")

        assert response.status == 1, "Service not SERVING"
        assert response.model_ready, "Model not ready"

        print("\n✅ Health check passed")
        return True

    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_get_model_info():
    """
    Test GetModelInfo RPC call.
    """
    print("\n🧪 Testing GetModelInfo...")

    channel = grpc.insecure_channel('localhost:50051')
    stub = pb2_grpc.RecommendationServiceStub(channel)

    request = pb2.ModelInfoRequest(model_version='v1.0')

    try:
        response = stub.GetModelInfo(request, timeout=2.0)

        print(f"✅ GetModelInfo successful")
        print(f"   - Model version: {response.model_version}")
        print(f"   - Trained at: {response.trained_at}")
        print(f"   - Users: {response.num_users}")
        print(f"   - Items: {response.num_items}")
        print(f"   - Model type: {response.model_type}")
        print(f"   - Hyperparameters: {dict(response.hyperparameters)}")
        print(f"   - Metrics: {dict(response.metrics)}")

        assert response.num_users > 0, "No users in model"
        assert response.num_items > 0, "No items in model"

        print("\n✅ Model info validated")
        return True

    except Exception as e:
        print(f"❌ GetModelInfo failed: {e}")
        return False


def run_all_tests():
    """
    Run all test cases.
    """
    print("=" * 60)
    print("US-IA-012 - gRPC Service Integration Tests")
    print("=" * 60)

    tests = [
        ("Health Check", test_health_check),
        ("Get Model Info", test_get_model_info),
        ("Get Recommendations", test_get_recommendations),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ Test '{test_name}' crashed: {e}")
            results.append((test_name, False))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1


if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)
