# Twilio-OpenAI Voice Bridge (Node.js)

A Node.js server that bridges Twilio voice calls with OpenAI's Realtime API, replacing the Deno implementation with proper WebSocket header support.

## Features

- ✅ **Proper WebSocket Authentication** - Uses standard Authorization headers
- 🎤 **Real-time Voice Processing** - Handles audio conversion between Twilio and OpenAI
- 🤖 **AI Agent Configuration** - Fetches agent settings from Supabase database
- 🔄 **Audio Resampling** - Converts between 8kHz (Twilio) and 24kHz (OpenAI)
- 📝 **Comprehensive Logging** - Detailed console output for debugging

## Quick Start

### 1. Install Dependencies

```bash
cd nodejs-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### 3. Run the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 4. Update Twilio Webhook

Update your Twilio phone number's webhook URL to:
```
wss://your-domain.com/voice-bridge
```

## Deployment Options

### Railway (Recommended)
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically

### Render
1. Create a new Web Service in Render
2. Connect your repository
3. Set environment variables
4. Deploy

### Heroku
1. Create a new Heroku app
2. Set config vars (environment variables)
3. Deploy via Git or GitHub integration

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3001) | No |
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Yes |
| `OPENAI_API_KEY` | OpenAI API key for Realtime API | Yes |

## Architecture

```
Twilio Call → Node.js Server → OpenAI Realtime API
     ↕              ↕                    ↕
  8kHz MuLaw   Audio Conversion    24kHz PCM16
```

## Audio Processing Pipeline

1. **Twilio → OpenAI**: MuLaw 8kHz → PCM16 24kHz
2. **OpenAI → Twilio**: PCM16 24kHz → MuLaw 8kHz
3. **Real-time streaming** with proper buffering and chunking

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check OpenAI API key is valid
   - Ensure server is accessible from internet

2. **No Audio Output**
   - Verify Twilio webhook URL is correct
   - Check server logs for audio processing errors

3. **Database Connection Issues**
   - Confirm Supabase credentials are correct
   - Check network connectivity to Supabase

### Logs

The server provides detailed logging:
- 📞 Call events (start, end)
- 🤖 OpenAI API interactions
- 🔄 Audio processing steps
- ❌ Error messages with context

## Advantages over Deno

- ✅ **Full WebSocket header support** - No authentication workarounds needed
- ✅ **Better debugging tools** - Rich Node.js ecosystem
- ✅ **Mature deployment options** - More hosting platforms
- ✅ **Proven WebSocket libraries** - Well-tested `ws` package
- ✅ **Easier development** - Standard npm workflow