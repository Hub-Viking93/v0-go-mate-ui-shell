user_test_phase1.md





Test 1 PASSED


Test 2 FAILED WITH:
## Error Type
Console Error

## Error Message
A param property was accessed directly with `params.id`. `params` is a Promise and must be unwrapped with `React.use()` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis


    at GuideDetailPage (app/(app)/guides/[id]/page.tsx:181:14)

## Code Frame
  179 |     }
  180 |     fetchGuide()
> 181 |   }, [params.id, router])
      |              ^
  182 |
  183 |   const handleDownloadPDF = async () => {
  184 |     if (!guide) return

Next.js version: 16.0.10 (Turbopack)



and

## Error Type
Console Error

## Error Message
A param property was accessed directly with `params.id`. `params` is a Promise and must be unwrapped with `React.use()` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis


    at fetchGuide (app/(app)/guides/[id]/page.tsx:148:60)
    at GuideDetailPage.useEffect (app/(app)/guides/[id]/page.tsx:180:5)

## Code Frame
  146 |     async function fetchGuide() {
  147 |       try {
> 148 |         const response = await fetch(`/api/guides/${params.id}`)
      |                                                            ^
  149 |         if (response.ok) {
  150 |           const data = await response.json()
  151 |           // Ensure the guide has all required default structures

Next.js version: 16.0.10 (Turbopack)

Test 3 PASSED

Test 4 PASSED

Negative Test 1 PASSED

Negative Test 2 PASSED

Negative Test 3 PASSED

Negative Test 4 PASSED
