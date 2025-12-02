# Railway Deployment Guide
# Meal Assistant - Cloud Deployment

## 🚀 Quick Links

**Railway Project:** https://railway.com/project/d68407f9-0f65-4cbf-9d4c-f3008342d848

**Deployment Steps:**

### 1. Database Services Setup (via Railway Dashboard)

Visit your project dashboard and add:

#### PostgreSQL Database
1. Click "+ New Service"
2. Select "Database" → "PostgreSQL"
3. Name: `meal-assistant-db`
4. Railway will auto-generate `DATABASE_URL` variable

#### Redis Cache
1. Click "+ New Service"
2. Select "Database" → "Redis"
3. Name: `meal-assistant-redis`
4. Railway will auto-generate `REDIS_URL` variable

### 2. API Service Setup

#### Option A: Via Railway Dashboard
1. Click "+ New Service"
2. Select "GitHub Repo"
3. Connect repository: `bjpl/meal_assistant`
4. Select branch: `main`
5. Root Directory: `/` (leave default)
6. Railway will detect `Dockerfile.api`

#### Option B: Via CLI
```bash
# From project directory
railway up
```

### 3. Environment Variables

Set in Railway Dashboard → Service Settings → Variables:

**Required:**
```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate-secure-random-string>
```

**Auto-Generated (by Railway plugins):**
```bash
DATABASE_URL=<auto-set-by-postgres-plugin>
REDIS_URL=<auto-set-by-redis-plugin>
```

**Optional:**
```bash
ML_SERVICE_URL=<ml-service-url-if-separate>
SENTRY_DSN=<sentry-error-tracking>
LOG_LEVEL=info
```

### 4. Generate JWT Secret

```bash
# Generate secure JWT secret
openssl rand -hex 32
```

Copy output and set as `JWT_SECRET` in Railway.

### 5. Deploy

After adding services and variables:

```bash
# Trigger deployment via CLI
railway up

# Or push to GitHub (auto-deploys)
git push origin main
```

### 6. ML Service (Optional - Separate Service)

For the Python ML inference service:

1. Create new service: "+ New Service"
2. Source: Same repo (`bjpl/meal_assistant`)
3. Dockerfile: `Dockerfile.ml`
4. Port: `8000`
5. Environment:
   ```
   PORT=8000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   MODEL_PATH=/app/models
   ```

### 7. Verify Deployment

Once deployed, Railway provides:

**API Service URL:** `https://meal-assistant-production.up.railway.app`

Test endpoints:
```bash
# Health check
curl https://meal-assistant-production.up.railway.app/health

# Vector health (no auth required)
curl https://meal-assistant-production.up.railway.app/api/vector/health

# Patterns (requires auth)
curl -H "Authorization: Bearer <token>" \
  https://meal-assistant-production.up.railway.app/api/patterns
```

## 📊 Expected Costs (Railway Pricing)

**Free Tier:** $5/month credit
- PostgreSQL: ~$2-5/month
- Redis: ~$1-2/month
- API Service: ~$5-10/month (based on usage)
- ML Service: ~$10-20/month (Python/ML workloads)

**Total Estimated:** $18-37/month (depending on traffic)

**Free tier covers:** ~$5 worth, so ~$13-32/month out of pocket

## 🔧 Configuration Files Created

- ✅ `railway.json` - Railway build configuration
- ✅ `railway.toml` - Service deployment settings
- ✅ `Procfile` - Start command definition
- ✅ `Dockerfile.api` - API container (already configured)
- ✅ `Dockerfile.ml` - ML container (already configured)

## 🚨 Important Notes

1. **Database Migrations:** Run init migrations after PostgreSQL is provisioned
2. **Health Checks:** Railway will use `/health` endpoint automatically
3. **Auto-Deploy:** Pushing to `main` branch triggers automatic deployment
4. **Logs:** View in Railway dashboard → Service → Deployments → Logs
5. **Custom Domain:** Configure in Railway → Settings → Domains

## 🔐 Security Checklist

- [ ] Set strong JWT_SECRET (use openssl rand -hex 32)
- [ ] Configure CORS origins in production
- [ ] Enable Sentry for error tracking
- [ ] Review rate limiting settings
- [ ] Configure database connection pooling
- [ ] Enable Redis persistence

## 📈 Next Steps After Deployment

1. **Initialize Vector Database:**
   ```bash
   curl -X POST https://<your-app>.railway.app/api/vector/init
   ```

2. **Seed Data:**
   ```bash
   # This would need to be added as an admin endpoint
   curl -X POST https://<your-app>.railway.app/api/admin/seed
   ```

3. **Monitor:**
   - Railway Dashboard → Metrics
   - Application Logs
   - Database connection count

## 🆘 Troubleshooting

**Issue: Service won't start**
- Check logs in Railway dashboard
- Verify DATABASE_URL and REDIS_URL are set
- Ensure PORT=3000 is set

**Issue: Database connection fails**
- Wait for PostgreSQL to be healthy
- Check network connectivity between services
- Verify connection string format

**Issue: Build fails**
- Check Dockerfile.api syntax
- Verify package.json dependencies
- Review build logs in Railway

---

**Project URL:** https://railway.com/project/d68407f9-0f65-4cbf-9d4c-f3008342d848

**Logged in as:** brandon.lambert87@gmail.com
