# Production-Grade Authentication & Session Management System

## Overview

This document describes the comprehensive authentication and session management system implemented for the FoodMatrix backend. The system includes JWT-based authentication, role-based access control (RBAC), session management, and production-grade security middleware.

## Architecture

### Components

1. **Authentication Middleware** (`src/middlewares/auth.middleware.ts`)
   - JWT token verification
   - Session validation
   - Email verification checks
   - User data attachment to requests

2. **Authorization Middleware** (`src/middlewares/authorization.middleware.ts`)
   - Role-based access control (RBAC)
   - Account membership verification
   - Primary admin checks
   - Resource ownership validation

3. **Security Middleware** (`src/middlewares/security.middleware.ts`)
   - Rate limiting (IP and user-based)
   - Request size limiting
   - Input sanitization
   - Parameter pollution prevention
   - Security headers
   - Request ID tracking

4. **Validation Middleware** (`src/middlewares/validation.middleware.ts`)
   - Zod-based request validation
   - Multi-target validation (body, query, params)
   - Conditional and partial validation
   - File upload validation

5. **Authentication Service** (`src/services/auth.service.ts`)
   - Login with session creation
   - Token refresh
   - Logout (single and all devices)
   - Session management
   - Session verification

6. **Authentication Controller** (`src/controllers/auth.controller.ts`)
   - HTTP request handlers for auth operations

7. **Validation Schemas** (`src/validators/auth.validators.ts`)
   - Zod schemas for all auth operations

## Features

### 1. JWT-Based Authentication

- **Access Tokens**: Short-lived tokens (default: 60 minutes)
- **Refresh Tokens**: Long-lived tokens (default: 7 days)
- **Token Rotation**: New tokens generated on refresh
- **Session Binding**: Tokens linked to specific sessions

### 2. Session Management

- **Multi-Device Support**: Users can have multiple active sessions
- **Session Tracking**: IP address, user agent, timestamps
- **Session Expiration**: Automatic expiration handling
- **Session Revocation**: Logout from specific devices or all devices

### 3. Role-Based Access Control (RBAC)

#### Role Hierarchy
```
viewer (1) < creator (2) < admin (3) < super_admin (4)
```

#### Middleware Functions

- `requireRole(role, accountIdParam)`: Require minimum role level
- `requirePrimaryAdmin(accountIdParam)`: Only primary admin can access
- `requireAccountMembership(accountIdParam)`: Any account member can access
- `requireOwnership(userIdParam)`: Only resource owner can access

### 4. Security Features

#### Rate Limiting
- **Login**: 5 attempts per 15 minutes (per IP/user)
- **Token Refresh**: 20 attempts per 15 minutes
- **Logout All**: 3 attempts per hour
- **General**: 100 requests per 15 minutes (configurable)

#### Input Security
- XSS prevention
- SQL injection prevention
- Parameter pollution prevention
- Request size limiting
- Input sanitization

#### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy

### 5. Validation

- Strong password requirements (min 8 chars, uppercase, lowercase, number)
- Email format validation
- Phone number validation
- UUID validation for IDs
- Custom validation rules

## API Endpoints

### Authentication Routes (`/api/v1/auth`)

| Method | Endpoint | Description | Access | Rate Limit |
|--------|----------|-------------|--------|------------|
| POST | `/login` | Login user | Public | 5/15min |
| POST | `/refresh` | Refresh access token | Public | 20/15min |
| POST | `/logout` | Logout current session | Private | - |
| POST | `/logout-all` | Logout all sessions | Private | 3/hour |
| GET | `/sessions` | Get active sessions | Private | - |
| DELETE | `/sessions/:sessionId` | Revoke specific session | Private | - |
| GET | `/verify` | Verify current session | Private | - |
| GET | `/me` | Get current user | Private | - |

## Usage Examples

### 1. Basic Authentication

```typescript
import { Router } from "express";
import { authenticate } from "../middlewares";

const router = Router();

// Protected route
router.get("/profile", authenticate, (req, res) => {
  // req.user is available here
  res.json({ user: req.user });
});
```

### 2. Role-Based Access

```typescript
import { Router } from "express";
import { authenticate, requireRole } from "../middlewares";

const router = Router();

// Only admins can access
router.post(
  "/accounts/:accountId/settings",
  authenticate,
  requireRole("admin"),
  controller.updateSettings
);

// Only primary admin can delete account
router.delete(
  "/accounts/:accountId",
  authenticate,
  requirePrimaryAdmin(),
  controller.deleteAccount
);
```

### 3. Request Validation

```typescript
import { Router } from "express";
import { validate } from "../middlewares";
import { loginSchema } from "../validators/auth.validators";

const router = Router();

router.post(
  "/login",
  validate(loginSchema, "body"),
  controller.login
);
```

### 4. Rate Limiting

```typescript
import { Router } from "express";
import { rateLimit, strictRateLimit } from "../middlewares";

const router = Router();

// IP-based rate limiting
router.post(
  "/public-endpoint",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  }),
  controller.handler
);

// User-based rate limiting (if authenticated)
router.post(
  "/sensitive-endpoint",
  strictRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  }),
  controller.handler
);
```

### 5. Multi-Target Validation

```typescript
import { Router } from "express";
import { validateMultiple } from "../middlewares";
import { z } from "zod";

const router = Router();

router.get(
  "/users/:userId/posts",
  validateMultiple({
    params: z.object({ userId: z.string().uuid() }),
    query: z.object({ page: z.string().optional() }),
  }),
  controller.getUserPosts
);
```

## Client Integration

### Login Flow

```typescript
// 1. Login
const response = await fetch("/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    emailOrUsername: "user@example.com",
    password: "SecurePass123",
  }),
});

const { accessToken, refreshToken, user } = await response.json();

// Store tokens securely
localStorage.setItem("accessToken", accessToken);
localStorage.setItem("refreshToken", refreshToken);
```

### Making Authenticated Requests

```typescript
const response = await fetch("/api/v1/protected-resource", {
  headers: {
    "Authorization": `Bearer ${accessToken}`,
  },
});
```

### Token Refresh

```typescript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (response.ok) {
    const { accessToken, refreshToken: newRefreshToken } = await response.json();
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", newRefreshToken);
    return accessToken;
  } else {
    // Refresh failed, redirect to login
    window.location.href = "/login";
  }
}

// Axios interceptor example
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newAccessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return axios(originalRequest);
    }

    return Promise.reject(error);
  }
);
```

### Logout

```typescript
// Logout from current device
await fetch("/api/v1/auth/logout", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
  },
});

// Logout from all devices
await fetch("/api/v1/auth/logout-all", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
  },
});

// Clear local storage
localStorage.removeItem("accessToken");
localStorage.removeItem("refreshToken");
```

## Security Best Practices

### 1. Token Storage

- **Frontend**: Use httpOnly cookies for production (more secure than localStorage)
- **Mobile**: Use secure storage (Keychain on iOS, KeyStore on Android)
- **Never**: Store tokens in regular cookies without httpOnly flag

### 2. HTTPS Only

Always use HTTPS in production to prevent token interception.

### 3. Token Expiration

- Keep access tokens short-lived (15-60 minutes)
- Refresh tokens can be longer (7-30 days)
- Implement automatic token refresh

### 4. Session Management

- Monitor active sessions
- Allow users to revoke sessions
- Implement session timeout
- Track suspicious activity

### 5. Rate Limiting

- Implement on all public endpoints
- Use stricter limits for sensitive operations
- Consider using Redis for distributed rate limiting in production

### 6. Input Validation

- Validate all inputs on both client and server
- Sanitize user inputs
- Use parameterized queries for database operations

## Database Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_is_valid ON sessions(is_valid);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Environment Variables

Required environment variables:

```env
# JWT Configuration
ACCESS_TOKEN_SECRET=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRY_MINUTES=60

REFRESH_TOKEN_SECRET=your-refresh-secret-key-min-32-chars
REFRESH_TOKEN_EXPIRATION_MINUTES=10080  # 7 days

# Token for email verification
TOKEN_SECRET=your-token-secret-min-32-chars
TOKEN_EXPIRATION_MINUTES=60

# OTP Configuration
OTP_EXPIRATION_MINUTES=10
```

## Monitoring & Logging

All authentication events are logged with appropriate levels:

- **INFO**: Successful logins, logouts, token refreshes
- **WARN**: Failed authentication attempts, invalid tokens, rate limit hits
- **ERROR**: System errors, unexpected failures

Example log entry:
```json
{
  "level": "info",
  "message": "Login successful",
  "userId": "user-123",
  "email": "user@example.com",
  "sessionId": "session-456",
  "ip": "192.168.1.1",
  "timestamp": "2025-12-10T10:15:30.000Z"
}
```

## Testing

### Manual Testing with cURL

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"user@example.com","password":"SecurePass123"}'

# Use access token
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Refresh token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Migration Guide

If you have existing user routes, migrate them to use the new middleware:

### Before
```typescript
router.get("/users/:id", controller.getUser);
```

### After
```typescript
import { authenticate, requireOwnership } from "../middlewares";

router.get(
  "/users/:userId",
  authenticate,
  requireOwnership("userId"),
  controller.getUser
);
```

## Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Token has expired
   - Token secret mismatch
   - Solution: Refresh token or login again

2. **"Session expired or invalid"**
   - Session was revoked
   - Session expired
   - Solution: Login again

3. **"Too many requests"**
   - Rate limit exceeded
   - Solution: Wait for the retry-after period

4. **"Validation failed"**
   - Request data doesn't match schema
   - Solution: Check error details and fix request data

## Future Enhancements

1. **Redis Integration**: Replace in-memory rate limiting with Redis
2. **OAuth Support**: Add Google, GitHub, etc.
3. **2FA/MFA**: Implement two-factor authentication
4. **Device Fingerprinting**: Enhanced session security
5. **Audit Logging**: Detailed audit trail
6. **IP Whitelisting**: For admin operations
7. **Geolocation Blocking**: Block requests from specific regions
8. **Anomaly Detection**: ML-based suspicious activity detection

## Support

For issues or questions, please refer to:
- Project README
- API Documentation
- Security Guidelines
- Contact: support@foodmatrix.com
