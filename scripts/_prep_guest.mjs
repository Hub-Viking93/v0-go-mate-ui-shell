// Just verify the landing page is the entry point and prints the URL the user
// should open in a fresh incognito tab. We don't pre-create the anonymous
// user — the landing page does that on click.
console.log('Open in INCOGNITO (or signed-out browser): http://localhost:5175/')
console.log('Should redirect to /landing → click CTA → signs in anonymously → /onboarding')
