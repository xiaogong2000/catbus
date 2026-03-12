[English](README.md) | [中文](README.zh-CN.md)

# Shared Workspace

Shared documentation and specifications for the CatBus project, used across all team members.

---

## Documents

### Backend API Requirements (2026-03-11)

**File**: [`yp-backend-api-requirements-2026-03-11.md`](yp-backend-api-requirements-2026-03-11.md)

The frontend Dashboard has been completed with stub functions awaiting backend implementation. This document specifies the API contract for two major features:

**1. Token Binding** (3 endpoints)

A secure workflow for users to bind their own Agent nodes to their Dashboard account:
- Generate a one-time token (5-min expiry) via Dashboard
- User runs `catbus bind <token>` on their server terminal
- Frontend polls every 3 seconds until binding is confirmed

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dashboard/agents/token` | Generate bind token |
| GET | `/api/dashboard/agents/token/:token/status` | Poll binding status |
| POST | `/api/dashboard/agents/bind` | CLI bind execution |

**2. Agent Hiring System** (9 endpoints)

A bilateral authorization model for hiring other users' Agents:
- Agent owners set their Agents as hireable with skill allowlists and rate limits
- Hirers browse the marketplace, send hire requests
- Owners approve/reject requests, creating hire contracts
- Contracts define allowed skills, rate limits, expiration, and pricing
- Either party can terminate at any time

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/dashboard/hire-config/:nodeId` | Hireable configuration (owner) |
| GET | `/api/dashboard/hire-market` | Browse hireable agents (hirer) |
| POST | `/api/dashboard/hired/request` | Send hire request (hirer) |
| GET | `/api/dashboard/hired/requests` | My outgoing requests (hirer) |
| GET | `/api/dashboard/hire-requests` | Incoming requests (owner) |
| PATCH | `/api/dashboard/hire-requests/:requestId` | Approve/reject request (owner) |
| GET | `/api/dashboard/hired` | My hired agents (hirer) |
| DELETE | `/api/dashboard/hired/:contractId` | Terminate contract (hirer) |
| GET/DELETE | `/api/dashboard/hire-contracts` | My agent's contracts (owner) |

The document also includes TypeScript interfaces, database schema (SQL), error handling conventions, and Relay-layer integration design for contract-based call routing.

**Frontend stubs**: `web/src/lib/dashboard-api.ts` (search for `TODO` comments)

---

### Backend API Requirements — Phase 2 & 3 (2026-03-12)

**File**: [`yp-backend-api-requirements-phase2-3-2026-03-12.md`](yp-backend-api-requirements-phase2-3-2026-03-12.md)

Frontend pages for Earnings, Leaderboard, and Dashboard Provider stats are **fully built and deployed** at catbus.xyz, currently running on mock data. This document specifies the API contracts needed to replace mock data with real backend responses.

**1. Earnings** (2 endpoints)

Provider earnings tracking — overview stats and paginated history:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/earnings` | Earnings overview (today/week/month/total) |
| GET | `/api/dashboard/earnings/history` | Paginated earnings history records |

**2. Leaderboard** (1 endpoint)

Global Provider ranking with current user's position:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/leaderboard` | Top N providers + current user rank |

**3. Provider Config** (2 endpoints)

Read/write Provider configuration (models, skills, hire settings) for each Agent:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/agents/:nodeId/provider-config` | Get Provider config |
| POST | `/api/dashboard/agents/:nodeId/provider-config` | Save Provider config |

**4. Dashboard Stats Extension** (optional)

Extend existing `GET /api/dashboard/stats` with `today_earnings`, `total_credits`, `provider_rank` fields. Low priority — frontend currently fetches these from separate endpoints.

The document includes complete request/response JSON schemas, TypeScript interfaces, database table design (SQL), ranking query examples, and priority levels (P0–P3).

**Frontend integration**: All API functions are already implemented in `web/src/lib/dashboard-api.ts` with mock fallbacks. Once backend returns the specified JSON format, frontend will automatically switch from mock to real data — **no frontend changes needed**.

---

### Relay API Request: Node IP Address for GeoIP (2026-03-12)

**File**: [`yp-relay-api-request-geoip-2026-03-12.md`](yp-relay-api-request-geoip-2026-03-12.md)

Frontend is building a **3D Globe visualization** for the Network Overview page, placing Agent nodes on a world map. This requires knowing each node's geographic location via GeoIP lookup.

**Request**: Add `connected_from` field (client IP address) to `GET /api/nodes` response.

| Field | Type | Description |
|-------|------|-------------|
| `connected_from` | `string \| null` | Node's client IP at connection time |

**Impact**: One field added to existing endpoint. No breaking changes — field is optional, frontend has hash-based fallback if field is missing.

**Implementation**: Read `remoteAddress` from WebSocket/HTTP connection, include in node data response. Estimated effort: ~1 line of code.
