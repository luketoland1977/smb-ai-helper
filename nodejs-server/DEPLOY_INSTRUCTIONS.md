# Node.js Server Deployment Instructions

## Quick Railway Deployment

1. **Connect to Railway**
   - Go to [Railway.app](https://railway.app/)
   - Connect your GitHub account
   - Create new project from this repository

2. **Set Environment Variables in Railway Dashboard**
   ```
   OPENAI_API_KEY=your_actual_openai_api_key
   PORT=3001
   SUPABASE_URL=https://ycvvuepfsebqpwmamqgg.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljdnZ1ZXBmc2VicXB3bWFtcWdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzIwMTQxNSwiZXhwIjoyMDcyNzc3NDE1fQ.EJl3VGMzNuQZZUJCRR0Hn9v1RdT0V-3QKe3MiHGtPjg
   ```

3. **Configure Root Directory**
   - In Railway settings, set **Root Directory** to: `nodejs-server`
   - Set **Start Command** to: `node server.js`

4. **Deploy**
   - Railway will auto-deploy when you push changes
   - Your server will be available at: `https://your-app-name.up.railway.app`

## Alternative: Render Deployment

1. **Connect to Render**
   - Go to [Render.com](https://render.com/)
   - Create new Web Service from Git repository

2. **Configure Service**
   - **Root Directory**: `nodejs-server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node

3. **Set Environment Variables**
   - Add all the same environment variables as above

## Update Twilio Webhook

Once deployed, update the webhook URL in your database:

```sql
UPDATE twilio_integrations 
SET webhook_url = 'https://your-deployed-url.com/incoming-call'
WHERE phone_number = '(844) 415-2896';
```

## Testing

After deployment, test the endpoints:
- Health check: `https://your-url.com/health`
- Main endpoint: `https://your-url.com/`

The voice integration should then work with full OpenAI Realtime API streaming.