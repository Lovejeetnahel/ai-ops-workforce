process.env.DATABASE_URL = 'postgresql://aiow:aiow@localhost:5432/aiow';
process.env.JWT_SECRET = 'dev-secret-that-is-at-least-32-chars-long';
process.env.NODE_ENV = 'development';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CREDENTIALS_ENCRYPTION_KEY = 'dev-credentials-encryption-key-32b';
process.env.CORS_ORIGINS = 'http://localhost:3000';
require('./dist/main.js');
