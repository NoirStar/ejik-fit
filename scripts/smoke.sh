#!/usr/bin/env bash
set -euo pipefail

curl --noproxy '*' --fail --silent http://localhost:8000/health | grep -q 'ejik-fit-api'
curl --noproxy '*' --fail --silent 'http://localhost:8000/api/postings?limit=1' | grep -q 'items'
curl --noproxy '*' --fail --silent http://localhost:3000/ | grep -q '이직핏'
