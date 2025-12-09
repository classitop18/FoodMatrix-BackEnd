# FoodMatrix Backend

> A robust, production-ready backend API for the FoodMatrix application - A comprehensive food budget management and meal planning platform.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.0+-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-green.svg)](https://orm.drizzle.team/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup](#database-setup)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Queue System](#queue-system)
- [Logging](#logging)
- [Security](#security)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

FoodMatrix Backend is a scalable, enterprise-grade REST API built with TypeScript and Express.js. It provides comprehensive functionality for managing household food budgets, meal planning, multi-user accounts, and automated grocery list generation.

### Key Capabilities

- **Multi-Household Management**: Support for individual and family accounts with role-based access control
- **Budget Tracking**: Real-time food spending tracking with weekly, monthly, and annual budget allocations
- **Member Management**: Internal and external member support with customizable roles
- **Email Notifications**: Queue-based email system using BullMQ and Redis
- **Secure Authentication**: JWT-based authentication with MFA support
- **Production Logging**: Winston-based structured logging with daily rotation

---

## ✨ Features

### Core Features

- ✅ **User Management**
  - User registration and authentication
  - Email verification with OTP
  - Multi-factor authentication (MFA) support
  - Profile management with address and geolocation

- ✅ **Account System**
  - Multi-household account support (individual/family)
  - Unique account number generation
  - Role-based access control (Owner, Super Admin, Member, Viewer)
  - Budget allocation and tracking

- ✅ **Budget Management**
  - Flexible budget periods (weekly, monthly, annual)
  - Category-based allocation (groceries, dining, emergency)
  - Spending streak tracking
  - Budget override management with admin approval

- ✅ **Member Management**
  - Internal members (non-user household members)
  - External members (invited users)
  - Role-based permissions
  - Member demographics tracking

- ✅ **Email System**
  - Queue-based email processing
  - Handlebars template support
  - Retry mechanism for failed emails
  - Email job monitoring via Bull Board

### Technical Features

- 🔒 **Security**: Helmet.js, CORS, bcrypt password hashing, JWT tokens
- 📊 **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- 🚀 **Performance**: Redis-based queue system for async operations
- 📝 **Logging**: Winston with daily log rotation and multiple transports
- 🛠️ **Developer Experience**: TypeScript, hot-reload, ESLint, Prettier
- 🔄 **Graceful Shutdown**: Proper cleanup of connections and resources

---

## 🛠️ Tech Stack

### Core Technologies

| Technology      | Version | Purpose               |
| --------------- | ------- | --------------------- |
| **Node.js**     | 18+     | Runtime environment   |
| **TypeScript**  | 5.0+    | Type-safe development |
| **Express.js**  | 5.2+    | Web framework         |
| **PostgreSQL**  | 15+     | Primary database      |
| **Drizzle ORM** | 0.45+   | Type-safe ORM         |
| **Redis**       | 7+      | Queue and caching     |
| **BullMQ**      | 5.65+   | Job queue management  |

### Key Dependencies

#### Production Dependencies

```json
{
  "express": "^5.2.1", // Web framework
  "drizzle-orm": "^0.45.0", // Type-safe ORM
  "@neondatabase/serverless": "^1.0.2", // Neon DB driver
  "bcrypt": "^6.0.0", // Password hashing
  "jsonwebtoken": "^9.0.3", // JWT authentication
  "bullmq": "^5.65.1", // Queue system
  "ioredis": "^5.8.2", // Redis client
  "winston": "^3.19.0", // Logging
  "nodemailer": "^7.0.11", // Email sending
  "handlebars": "^4.7.8", // Email templates
  "helmet": "^8.1.0", // Security headers
  "cors": "^2.8.5", // CORS middleware
  "zod": "^4.1.13", // Schema validation
  "dotenv": "^17.2.3" // Environment variables
}
```

#### Development Dependencies

```json
{
  "typescript": "^5.0+", // TypeScript compiler
  "ts-node-dev": "^2.0.0", // Development server
  "drizzle-kit": "^0.31.8", // Database migrations
  "prettier": "^3.7.4", // Code formatting
  "@types/*": "latest" // TypeScript definitions
}
```

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│              (Web, Mobile, Third-party APIs)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Server                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Security   │  │  Middleware  │  │   Logging    │      │
│  │ (Helmet/CORS)│  │   (Morgan)   │  │  (Winston)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Routes     │ │  Modules │ │    Queues    │
│              │ │          │ │              │
│ • Auth       │ │ • User   │ │ • Email      │
│ • Account    │ │ • Account│ │ • Notif.     │
│ • Member     │ │ • Member │ │              │
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
        ┌─────────────────────────────┐
        │      Database Layer         │
        │   (Drizzle ORM + Neon)      │
        └─────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────┐          ┌──────────────┐
│  PostgreSQL  │          │    Redis     │
│   Database   │          │   (Queue)    │
└──────────────┘          └──────────────┘
```

### Module Structure

The application follows a modular architecture:

- **Routes**: HTTP endpoint definitions
- **Modules**: Business logic and controllers
- **Database**: Schema, migrations, and ORM configuration
- **Queues**: Background job processing
- **Utils**: Shared utilities (logger, JWT, bcrypt, etc.)
- **Types**: TypeScript type definitions

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - Comes with Node.js
- **PostgreSQL** (v15 or higher) - [Download](https://www.postgresql.org/download/)
- **Redis** (v7 or higher) - [Download](https://redis.io/download/)
- **Git** - [Download](https://git-scm.com/)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd FoodMatrix-App/backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` with your configuration (see [Environment Configuration](#environment-configuration)).

4. **Set up the database**

```bash
# Generate database migrations
npm run db:generate

# Push schema to database
npm run db:push
```

5. **Start the development server**

```bash
npm run dev
```

The server will start at `http://localhost:3000` (or your configured PORT).

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/foodmatrix

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@foodmatrix.com

# Application URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Optional: Bull Board (Queue Dashboard)
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=admin123
```

### Database Setup

#### Using Neon Database (Recommended for Production)

1. Create a Neon account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Update `DATABASE_URL` in `.env`

#### Using Local PostgreSQL

```bash
# Create database
createdb foodmatrix

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://localhost:5432/foodmatrix

# Run migrations
npm run db:push
```

#### Database Management

```bash
# Generate new migration
npm run db:generate

# Push schema changes to database
npm run db:push

# Open Drizzle Studio (Database GUI)
npm run db:studio
```

---

## 📜 Available Scripts

### Development

| Script    | Command         | Description                              |
| --------- | --------------- | ---------------------------------------- |
| **dev**   | `npm run dev`   | Start development server with hot-reload |
| **build** | `npm run build` | Compile TypeScript to JavaScript         |
| **start** | `npm start`     | Start production server (requires build) |

### Code Quality

| Script     | Command          | Description                      |
| ---------- | ---------------- | -------------------------------- |
| **lint**   | `npm run lint`   | Run ESLint to check code quality |
| **format** | `npm run format` | Format code with Prettier        |

### Database

| Script          | Command               | Description                     |
| --------------- | --------------------- | ------------------------------- |
| **db:generate** | `npm run db:generate` | Generate database migrations    |
| **db:push**     | `npm run db:push`     | Push schema changes to database |
| **db:studio**   | `npm run db:studio`   | Open Drizzle Studio (GUI)       |

### Complete Workflow

```bash
# Development workflow
npm run dev              # Start development server

# Before committing
npm run lint             # Check for linting errors
npm run format           # Format code

# Database changes
npm run db:generate      # Generate migrations
npm run db:push          # Apply to database

# Production deployment
npm run build            # Build for production
npm start                # Start production server
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── database/              # Database layer
│   │   ├── schema.ts          # Drizzle schema definitions
│   │   ├── enums.ts           # Database enums
│   │   ├── relations.ts       # Table relationships
│   │   ├── db.ts              # Database connection
│   │   └── index.ts           # Database exports
│   │
│   ├── modules/               # Business logic modules
│   │   ├── user/              # User module
│   │   ├── account/           # Account module
│   │   └── member/            # Member module
│   │
│   ├── routes/                # API routes
│   │   ├── index.ts           # Route aggregator
│   │   └── v1/                # API v1 routes
│   │
│   ├── queues/                # Background jobs
│   │   ├── email.queue.ts     # Email queue
│   │   ├── jobs/              # Job definitions
│   │   ├── worker/            # Queue workers
│   │   ├── config/            # Queue configuration
│   │   └── types/             # Queue types
│   │
│   ├── email/                 # Email templates & service
│   │   ├── templates/         # Handlebars templates
│   │   └── email.service.ts   # Email service
│   │
│   ├── utils/                 # Utility functions
│   │   ├── logger.utils.ts    # Winston logger
│   │   ├── jwt.utils.ts       # JWT helpers
│   │   ├── bcrypt.utils.ts    # Password hashing
│   │   ├── env.config.ts      # Environment config
│   │   └── response.utils.ts  # Response helpers
│   │
│   ├── types/                 # TypeScript types
│   │   └── index.ts           # Type definitions
│   │
│   └── index.ts               # Application entry point
│
├── drizzle/                   # Database migrations
│   ├── meta/                  # Migration metadata
│   └── *.sql                  # SQL migration files
│
├── logs/                      # Application logs
│   ├── error/                 # Error logs
│   ├── combined/              # All logs
│   └── exceptions/            # Uncaught exceptions
│
├── .env                       # Environment variables (gitignored)
├── .gitignore                 # Git ignore rules
├── drizzle.config.ts          # Drizzle ORM configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

---

## 📚 API Documentation

### Base URL

```
Development: http://localhost:3000
Production: https://api.foodmatrix.com
```

### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-12-08T13:01:07.000Z"
}
```

### Authentication Endpoints

_(To be documented based on implementation)_

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/verify-email
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

### User Endpoints

```http
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
PATCH  /api/v1/users/avatar
DELETE /api/v1/users/account
```

### Account Endpoints

```http
GET    /api/v1/accounts
POST   /api/v1/accounts
GET    /api/v1/accounts/:id
PUT    /api/v1/accounts/:id
DELETE /api/v1/accounts/:id
```

### Member Endpoints

```http
GET    /api/v1/accounts/:accountId/members
POST   /api/v1/accounts/:accountId/members
PUT    /api/v1/accounts/:accountId/members/:id
DELETE /api/v1/accounts/:accountId/members/:id
```

---

## 🗄️ Database Schema

### Users Table

Stores user authentication and profile information.

```typescript
{
  id: UUID(PK);
  email: string(unique);
  username: string(unique, nullable);
  password: string(hashed);
  isVerified: boolean;
  avatar: string(nullable);
  isMfaEnabled: boolean;
  otp: string(nullable);
  otpExpiresAt: timestamp(nullable);
  firstName: string;
  lastName: string(nullable);
  phone: string(nullable);
  // Address fields
  addressLine1: string(nullable);
  addressLine2: string(nullable);
  city: string(nullable);
  state: string(nullable);
  country: string(nullable);
  zipCode: string(nullable);
  formattedAddress: string(nullable);
  // Geolocation
  latitude: decimal(nullable);
  longitude: decimal(nullable);
  placeId: string(nullable);
  // Timestamps
  createdAt: timestamp;
  updatedAt: timestamp;
  lastLoginAt: timestamp(nullable);
}
```

### Accounts Table

Manages household accounts and budget settings.

```typescript
{
  id: UUID (PK)
  accountNumber: string (unique, 8 chars)
  accountName: string (nullable)
  type: enum ('individual', 'family')
  primaryAdminId: UUID (FK -> users.id)
  // Location
  zipCode: string (nullable)
  city: string (nullable)
  state: string (nullable)
  // Budget configuration
  weeklyBudget: decimal
  dailyBudget: decimal (nullable)
  monthlyBudget: decimal (nullable)
  annualBudget: decimal (nullable)
  currentAllocation: enum ('daily', 'weekly', 'monthly', 'annual')
  // Budget distribution
  groceriesPercentage: integer (default: 70)
  diningPercentage: integer (default: 20)
  emergencyPercentage: integer (default: 10)
  // Spending tracking
  currentWeekFoodSpending: decimal (default: 0)
  weeklyFoodStreak: integer (default: 0)
  bestFoodStreak: integer (default: 0)
  totalFoodOverrides: integer (default: 0)
  lastFoodBudgetReset: timestamp
  // Settings
  requiresAdminApprovalForOverrides: boolean (default: true)
  defaultPlanningPeriod: enum ('weekly', 'monthly', 'annual')
  autoGenerateGroceryLists: boolean (default: true)
  createdAt: timestamp
}
```

### Members Table

Tracks household members (both users and internal members).

```typescript
{
  id: UUID (PK)
  accountId: UUID (FK -> accounts.id)
  userId: UUID (FK -> users.id, nullable)
  role: enum ('owner', 'super_admin', 'member', 'viewer')
  // Internal member fields (when userId is null)
  name: string (nullable)
  age: integer (nullable)
  sex: enum ('male', 'female', 'other', nullable)
  createdAt: timestamp
}
```

### Enums

```typescript
// Account Types
accountTypeEnum: "individual" | "family";

// Budget Allocation Periods
budgetAllocationEnum: "daily" | "weekly" | "monthly" | "annual";

// Member Roles
rolesEnum: "owner" | "super_admin" | "member" | "viewer";

// Sex
sexEnum: "male" | "female" | "other";
```

---

## 🔄 Queue System

### Overview

FoodMatrix uses **BullMQ** with **Redis** for background job processing, ensuring reliable and scalable async operations.

### Email Queue

Located in `src/queues/email.queue.ts`

**Features:**

- Retry mechanism (3 attempts)
- Exponential backoff
- Job monitoring via Bull Board
- Template-based emails using Handlebars

**Usage Example:**

```typescript
import { emailQueue } from "./queues/email.queue";

// Add email job to queue
await emailQueue.add("send-verification", {
  to: "user@example.com",
  subject: "Verify Your Email",
  template: "verify-email",
  context: {
    name: "John Doe",
    verificationLink: "https://...",
  },
});
```

### Queue Dashboard

Access Bull Board at: `http://localhost:3000/admin/queues`

**Features:**

- View active, completed, and failed jobs
- Retry failed jobs
- Monitor queue metrics
- Real-time updates

---

## 📝 Logging

### Winston Logger

FoodMatrix uses **Winston** for structured logging with multiple transports.

**Log Levels:**

- `error`: Error messages
- `warn`: Warning messages
- `info`: Informational messages
- `http`: HTTP request logs
- `debug`: Debug messages

**Log Files:**

- `logs/error/error-YYYY-MM-DD.log` - Error logs only
- `logs/combined/combined-YYYY-MM-DD.log` - All logs
- `logs/exceptions/exceptions-YYYY-MM-DD.log` - Uncaught exceptions

**Usage:**

```typescript
import { logger } from "./utils/logger.utils";

logger.info("User registered successfully", { userId: "123" });
logger.error("Database connection failed", { error: err });
logger.warn("High memory usage detected");
```

**Features:**

- Daily log rotation
- Colored console output (development)
- JSON format (production)
- Automatic cleanup of old logs (14 days retention)

---

## 🔒 Security

### Security Measures

1. **Helmet.js**: Security headers
   - XSS protection
   - Content Security Policy
   - HSTS
   - Frame protection

2. **CORS**: Cross-Origin Resource Sharing
   - Configurable origins
   - Credentials support

3. **Password Security**
   - bcrypt hashing (10 rounds)
   - No plaintext storage

4. **JWT Authentication**
   - Secure token generation
   - Configurable expiration
   - Refresh token support (planned)

5. **Input Validation**
   - Zod schema validation
   - SQL injection prevention (Drizzle ORM)
   - XSS sanitization

6. **Environment Variables**
   - Sensitive data in `.env`
   - No secrets in code

### Best Practices

- ✅ Always use HTTPS in production
- ✅ Rotate JWT secrets regularly
- ✅ Implement rate limiting (planned)
- ✅ Use strong passwords (enforce policy)
- ✅ Enable MFA for admin accounts
- ✅ Regular security audits
- ✅ Keep dependencies updated

---

## 🚀 Deployment

### Production Build

```bash
# Install dependencies
npm ci --production=false

# Build TypeScript
npm run build

# Start production server
npm start
```

### Environment Variables (Production)

Ensure the following are set:

```env
NODE_ENV=production
DATABASE_URL=<production-database-url>
JWT_SECRET=<strong-random-secret>
REDIS_HOST=<redis-host>
REDIS_PASSWORD=<redis-password>
SMTP_HOST=<smtp-host>
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
```

### Deployment Platforms

#### Vercel / Netlify (Serverless)

Not recommended for this architecture (requires persistent connections for Redis/PostgreSQL).

#### Railway / Render / Heroku

1. Connect your Git repository
2. Set environment variables
3. Configure build command: `npm run build`
4. Configure start command: `npm start`
5. Add PostgreSQL and Redis add-ons

#### Docker (Recommended)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Docker Compose:**

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: foodmatrix
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Health Checks

Configure health check endpoint:

```
GET /health
```

Expected response: `200 OK`

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run linting and formatting**
   ```bash
   npm run lint
   npm run format
   ```
5. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Write meaningful variable names
- Add comments for complex logic
- Update documentation as needed

---

## 📄 License

This project is licensed under the **ISC License**.

---

## 📞 Support

For questions or issues:

- **Email**: support@foodmatrix.com
- **Issues**: [GitHub Issues](https://github.com/your-org/foodmatrix/issues)
- **Documentation**: [Full Docs](https://docs.foodmatrix.com)

---

## 🙏 Acknowledgments

Built with ❤️ using:

- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [BullMQ](https://docs.bullmq.io/) - Premium queue system
- [Winston](https://github.com/winstonjs/winston) - Logging library
- [Neon](https://neon.tech/) - Serverless PostgreSQL

---

## 📊 Project Status

- ✅ Core authentication system
- ✅ Database schema and migrations
- ✅ Email queue system
- ✅ Logging infrastructure
- 🚧 API endpoints (in progress)
- 🚧 Recipe management (planned)
- 🚧 Meal planning (planned)
- 🚧 Grocery list generation (planned)

---

**Made with 💚 by the FoodMatrix Team**

_Last Updated: December 8, 2025_
