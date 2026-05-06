import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    middlewares: [
      {
        apply: 'serve',
        handle: async (req, res, next) => {
          if (!req.url.startsWith('/api/')) return next()

          const [, , provider] = req.url.split('/')
          const body = await new Promise((resolve) => {
            let data = ''
            req.on('data', (chunk) => (data += chunk))
            req.on('end', () => resolve(data ? JSON.parse(data) : {}))
          })

          const userKey = req.headers['x-api-key']
          const envKey = process.env[`VITE_${provider.toUpperCase()}_KEY`]
          const key = userKey || envKey

          if (!key && provider !== 'claude') {
            res.statusCode = 401
            res.end(JSON.stringify({ error: { message: `No API key for ${provider}. Set VITE_${provider.toUpperCase()}_KEY in .env.local or provide in UI.` } }))
            return
          }

          let targetUrl, options
          switch (provider) {
            case 'perplexity':
              targetUrl = 'https://api.perplexity.ai/chat/completions'
              options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify(body),
              }
              break
            case 'gemini':
              targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
              options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
              break
            case 'openai':
              targetUrl = 'https://api.openai.com/v1/chat/completions'
              options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify(body),
              }
              break
            case 'grok':
              targetUrl = 'https://api.x.ai/v1/chat/completions'
              options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify(body),
              }
              break
            case 'claude':
              targetUrl = 'https://api.anthropic.com/v1/messages'
              options = {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify(body),
              }
              break
            default:
              res.statusCode = 404
              res.end(JSON.stringify({ error: { message: 'Unknown provider' } }))
              return
          }

          try {
            const response = await fetch(targetUrl, options)
            const responseData = await response.json()
            res.statusCode = response.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(responseData))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: { message: error.message } }))
          }
        },
      },
    ],
  },
})
