import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  authToken: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: { 'HTTP-Referer': 'https://gomate.replit.app', 'X-Title': 'GoMate' },
})

console.log('client baseURL:', client.baseURL)
console.log('client apiKey type:', typeof client.apiKey, 'len:', client.apiKey?.length)
console.log('client authToken type:', typeof client.authToken, 'len:', client.authToken?.length)

try {
  const r = await client.messages.create({
    model: 'anthropic/claude-sonnet-4.5',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'say hi' }],
  })
  console.log('OK:', JSON.stringify(r).slice(0, 400))
} catch (e) {
  console.log('ERR:', e.name, e.message?.slice(0, 400))
  console.log('cause:', e.cause)
}
