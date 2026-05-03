import Anthropic from '@anthropic-ai/sdk'

for (const base of ['https://openrouter.ai/api', 'https://openrouter.ai/api/v1', 'https://openrouter.ai']) {
  const c = new Anthropic({
    authToken: process.env.OPENROUTER_API_KEY,
    baseURL: base,
    defaultHeaders: { 'HTTP-Referer': 'https://gomate.replit.app' },
  })
  try {
    const r = await c.messages.create({
      model: 'anthropic/claude-sonnet-4.5',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'hi' }],
    })
    const txt = JSON.stringify(r).slice(0, 200)
    console.log(`OK base=${base}:`, txt)
  } catch (e) {
    console.log(`ERR base=${base}:`, e.message?.slice(0, 200))
  }
}
