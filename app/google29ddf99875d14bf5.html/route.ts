export async function GET() {
  return new Response('google-site-verification: google29ddf99875d14bf5.html', {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

