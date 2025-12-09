# Wallet Service API with Paystack Integration

A comprehensive backend wallet service built with NestJS, Prisma, and Paystack integration. Features JWT authentication via Google OAuth and API key-based service-to-service access.

## Features

✅ **Google OAuth 2.0 Authentication** - Sign in with Google account  
✅ **JWT Token Management** - Secure token-based user authentication  
✅ **Paystack Integration** - Accept deposits via Paystack payment gateway  
✅ **Webhook Handling** - Mandatory webhook for transaction confirmation  
✅ **API Keys** - Service-to-service authentication with permission system  
✅ **Wallet Management** - Create wallets, check balance, view transaction history  
✅ **Money Transfers** - Peer-to-peer wallet transfers with atomicity  
✅ **Permission-Based Access Control** - Granular permission system for API keys  
✅ **Swagger Documentation** - Complete API documentation with examples  
✅ **Winston Logging** - Comprehensive logging throughout the application

## Tech Stack

- **Framework**: NestJS 11
- **Database**: SQLite (Prisma ORM)
- **Authentication**: JWT + Google OAuth2 (Passport)
- **Payment Gateway**: Paystack
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Paystack Account (for API keys)
- Google OAuth Credentials

### Setup Steps

1. **Clone and install dependencies**

```bash
cd HNG-Backend-Task-8
npm install
```

2. **Configure environment variables**

Copy `.env.example` to `.env` and update values:

```bash
# Database
DATABASE_URL="file:./dev.db"

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_me_in_production
JWT_EXPIRY=7d

# Paystack
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_API_URL=https://api.paystack.co

# App
NODE_ENV=development
PORT=3000
```

3. **Setup Prisma Database**

```bash
# Create database and run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

4. **Start the application**

```bash
# Development mode (with watch)
npm run start:dev

# Production mode
npm run start:prod
```

The API will be available at `http://localhost:3000`  
Swagger docs at `http://localhost:3000/api/docs`

## API Endpoints

### Authentication

| Method | Endpoint                | Description                                |
| ------ | ----------------------- | ------------------------------------------ |
| GET    | `/auth/google`          | Initiate Google OAuth sign-in              |
| GET    | `/auth/google/callback` | Google OAuth callback (automatic redirect) |

### API Key Management

| Method | Endpoint              | Description          | Auth |
| ------ | --------------------- | -------------------- | ---- |
| POST   | `/keys/create`        | Create new API key   | JWT  |
| GET    | `/keys/list`          | List all API keys    | JWT  |
| DELETE | `/keys/:keyId/revoke` | Revoke an API key    | JWT  |
| POST   | `/keys/rollover`      | Rollover expired key | JWT  |

### Wallet Operations

| Method | Endpoint                            | Description                 | Auth                   |
| ------ | ----------------------------------- | --------------------------- | ---------------------- |
| GET    | `/wallet/balance`                   | Get wallet balance          | JWT/API Key            |
| POST   | `/wallet/deposit`                   | Initialize Paystack deposit | JWT/API Key (deposit)  |
| GET    | `/wallet/deposit/:reference/status` | Check deposit status        | None                   |
| POST   | `/wallet/paystack/webhook`          | Paystack webhook handler    | Signature validation   |
| POST   | `/wallet/transfer`                  | Transfer to another wallet  | JWT/API Key (transfer) |
| GET    | `/wallet/transactions`              | Get transaction history     | JWT/API Key (read)     |

## Authentication Methods

### JWT (Google OAuth)

1. Visit `GET /auth/google` to sign in with Google
2. Redirect to Google login
3. Google redirects back with JWT token
4. Use token in subsequent requests:

```bash
Authorization: Bearer <jwt_token>
```

### API Keys

1. Create API key via `POST /keys/create` with JWT
2. Specify permissions: `deposit`, `transfer`, `read`
3. Use key in requests:

```bash
x-api-key: <api_key>
```

## Example API Usage

### Swagger UI

Visit `http://localhost:3000/api/docs` and use the interactive interface with pre-configured examples.

### Create API Key (with cURL)

```bash
curl -X POST http://localhost:3000/keys/create \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "wallet-service",
    "permissions": ["deposit", "transfer", "read"],
    "expiry": "1D"
  }'
```

### Get Wallet Balance

```bash
# With JWT
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:3000/wallet/balance

# With API Key
curl -H "x-api-key: <api_key>" \
  http://localhost:3000/wallet/balance
```

### Initialize Deposit

```bash
curl -X POST http://localhost:3000/wallet/deposit \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000
  }'
```

Response includes Paystack payment link:

```json
{
  "reference": "wallet_user123_1704099600000_a1b2c3d4",
  "authorization_url": "https://checkout.paystack.com/..."
}
```

### Transfer Funds

```bash
curl -X POST http://localhost:3000/wallet/transfer \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_number": "4566678954356",
    "amount": 1000,
    "description": "Payment for services"
  }'
```

### Get Transaction History

```bash
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:3000/wallet/transactions
```

## API Key Expiry Format

API keys support the following expiry durations:

- `1H` - Expires in 1 hour
- `1D` - Expires in 1 day
- `1M` - Expires in 1 month
- `1Y` - Expires in 1 year

## API Key Permissions

Each API key can have a combination of these permissions:

- `deposit` - Can initialize deposits
- `transfer` - Can transfer funds
- `read` - Can read balance and transaction history

JWT users (Google OAuth) have all permissions by default.

## Webhook Configuration

### Paystack Webhook Setup

1. Log in to Paystack Dashboard
2. Go to Settings → API Keys & Webhooks
3. Add webhook URL: `https://your-domain/wallet/paystack/webhook`
4. Select event: `charge.success`

### Testing Webhooks Locally

For local testing, use a service like ngrok:

```bash
# In another terminal
ngrok http 3000

# Use the ngrok URL for your webhook:
# https://xxxxx.ngrok.io/wallet/paystack/webhook
```

## Database Schema

### User Model

- id (CUID)
- email (unique)
- googleId (unique, optional)
- name, picture
- wallet (relation)
- apiKeys (relation)
- sentTransfers, receivedTransfers (relations)

### Wallet Model

- id (CUID)
- userId (unique)
- balance (default: 0)
- walletNumber (unique, CUID)
- transactions (relation)

### Transaction Model

- id, amount, type (deposit/transfer/withdrawal)
- status (pending/success/failed)
- reference, paystackRef (unique)
- Created/Updated timestamps

### ApiKey Model

- id, key (unique)
- permissions (JSON array)
- expiresAt, revokedAt, rolledOverAt
- userId (relation)

### Transfer Model

- id, senderId, recipientId
- amount, status, reference
- Created/Updated timestamps

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation, insufficient balance, etc.)
- `401` - Unauthorized (invalid/missing JWT or API Key)
- `403` - Forbidden (revoked key, expired key, missing permission)
- `404` - Not Found (wallet, transaction, etc.)
- `500` - Internal Server Error

Error response format:

```json
{
  "statusCode": 400,
  "message": "Insufficient balance",
  "error": "Bad Request"
}
```

## Security Features

✅ **JWT Verification** - All token-based requests verified  
✅ **API Key Validation** - Keys checked for expiry and revocation  
✅ **Paystack Signature Validation** - Webhooks verified with HMAC-SHA512  
✅ **Idempotency** - Webhooks processed only once per reference  
✅ **Atomic Transactions** - Money transfers are atomic (all-or-nothing)  
✅ **Permission Validation** - API keys can only access permitted endpoints  
✅ **Input Validation** - All inputs validated with class-validator

## Logging

The application uses Winston for comprehensive logging:

- Info level: Normal operations (user creation, key generation, etc.)
- Error level: Exception handling and error tracking
- Logs include timestamps, service names, and relevant context

Access logs in `logs/` directory (if configured).

## Development

### Run Tests

```bash
npm run test
npm run test:watch
npm run test:cov
```

### Format Code

```bash
npm run format
```

### Lint Code

```bash
npm run lint
```

## Deployment

### Production Checklist

- [ ] Update JWT_SECRET with strong random key
- [ ] Set NODE_ENV=production
- [ ] Configure real Paystack credentials
- [ ] Set correct GOOGLE_CALLBACK_URL
- [ ] Use production database (PostgreSQL recommended)
- [ ] Set up proper logging and monitoring
- [ ] Configure CORS for frontend domain
- [ ] Set up rate limiting
- [ ] Enable HTTPS for all endpoints
- [ ] Configure database backups

### Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

Build and run:

```bash
docker build -t wallet-service .
docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... wallet-service
```

## Troubleshooting

### JWT Guard Not Working

- Ensure token is passed with `Authorization: Bearer <token>` format
- Check JWT_SECRET matches between generation and verification
- Verify token hasn't expired (check JWT_EXPIRY)

### API Key Guard Issues

- Ensure key is passed as `x-api-key` header
- Check key hasn't been revoked
- Verify key hasn't expired
- Confirm API key has required permissions

### Paystack Webhook Not Triggering

- Check webhook URL is publicly accessible
- Verify Paystack has correct URL configured
- Use ngrok for local testing
- Check Paystack dashboard for webhook logs
- Ensure correct event type selected (charge.success)

### Database Issues

- Use `npx prisma studio` to inspect data
- Check DATABASE_URL is correct
- Verify Prisma Client is generated: `npx prisma generate`

## License

UNLICENSED

## Support

For issues and questions, refer to the API documentation at `/api/docs` or contact the development team.
