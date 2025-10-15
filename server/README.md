# DSA Solver Proxy Server

This proxy server safely handles API keys for the DSA Solver Chrome extension.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

3. Run server:
```bash
npm run dev
```

## Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel --prod
```

3. Add environment variables in Vercel dashboard:
   - `GOOGLE_VISION_API_KEY`
   - `OPENAI_API_KEY`

## Endpoints

- `GET /` - Health check
- `POST /api/vision` - Proxy to Google Vision API
- `POST /api/openai` - Proxy to OpenAI API 