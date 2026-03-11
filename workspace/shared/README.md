[English](README.md) | [中文](README.zh-CN.md)

# Shared Workspace

Shared documentation and specifications for the CatBus project, used across all team members.

---

## Documents

### Backend API Requirements (2026-03-11)

**File**: [`backend-api-requirements-2026-03-11.md`](backend-api-requirements-2026-03-11.md)

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
