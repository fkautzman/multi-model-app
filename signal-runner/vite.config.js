import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function apiProxyPlugin() {
  return {
    name: 'api-proxy',
    configResolved(config) {
      this.config = config
    },
    async transform(code, id) {
      return null
    },
    configureServer(server) {
      const PROVIDERS = {
        perplexity: (key, body) => ({
          url: 'https://api.perplexity.ai/chat/completions',
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          },
        }),
        openai: (key, body) => ({
          url: 'https://api.openai.com/v1/chat/completions',
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          },
        }),
        grok: (key, body) => ({
          url: 'https://api.x.ai/v1/chat/completions',
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          },
        }),
        gemini: (key, body) => ({
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        }),
        claude: (key, body) => ({
          url: 'https://api.anthropic.com/v1/messages',
          init: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'anthropic-dangerous-direct-browser-access': 'true',
              ...(key && { 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
            },
            body: JSON.stringify(body),
          },
        }),
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        const [, , provider] = req.url.split('/')

        if (!PROVIDERS[provider]) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: `Unknown provider: ${provider}` } }))
          return
        }

        const body = await new Promise((resolve) => {
          let data = ''
          req.on('data', (chunk) => (data += chunk))
          req.on('end', () => resolve(data ? JSON.parse(data) : {}))
        })

        const userKey = req.headers['x-api-key']
        const envKey = process.env[`VITE_${provider.toUpperCase()}_KEY`]
        const key = userKey || envKey

        if (!key) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: `No API key for ${provider}. Set VITE_${provider.toUpperCase()}_KEY in .env.local or provide in UI.` } }))
          return
        }

        const { url, init } = PROVIDERS[provider](key, body)

        try {
          const response = await fetch(url, init)
          const text = await response.text()
          let payload
          try {
            payload = JSON.parse(text)
          } catch {
            payload = { error: { message: `Upstream returned non-JSON (status ${response.status}): ${text.slice(0, 200)}` } }
          }
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: error.message } }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [apiProxyPlugin(), react()],
})
