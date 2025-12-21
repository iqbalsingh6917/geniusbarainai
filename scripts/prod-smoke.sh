#!/usr/bin/env bash
set -euo pipefail

REQUIRED_VARS=(PROD_API_BASE_URL SUPERADMIN_TOKEN TEACHER_TOKEN BP_TOKEN)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required env: $var"
    exit 1
  fi
done

API="${PROD_API_BASE_URL%/}"

check() {
  local name="$1"
  local url="$2"
  local token="${3:-}"
  echo "Testing ${name}: ${url}"
  local code
  if [[ -n "$token" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $token" "$url")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  fi
  if [[ "$code" == "200" ]]; then
    echo "✓ ${name} (${code})"
  else
    echo "✗ ${name} (status ${code})"
    exit 1
  fi
}

check "health" "${API}/api/health"
check "superadmin analytics summary" "${API}/api/superadmin/analytics/assessments/summary" "$SUPERADMIN_TOKEN"
check "bp dashboard overview" "${API}/api/bp/dashboard/overview" "$BP_TOKEN"
check "teacher analytics summary" "${API}/api/teacher/analytics/assessments/summary" "$TEACHER_TOKEN"

echo "All smoke checks passed."
