# Test Service

Minimal service for E2E CI/CD pipeline validation.

## Purpose

This service exists to test the complete CI/CD flow:
- ✅ Service change detection
- ✅ npm install (without package-lock.json)
- ✅ Lint execution
- ✅ Build execution
- ✅ Test execution
- ✅ Repository Dispatch trigger

## Scripts

All scripts are minimal and always succeed:
- `npm run lint` - Always passes
- `npm run build` - Always passes
- `npm test` - Always passes

## E2E Validation

This service validates that the CI pipeline can:
1. Detect service-level changes
2. Install dependencies without lock files
3. Execute all build steps successfully
4. Trigger the Repository Dispatch to dreamscape-tests

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
