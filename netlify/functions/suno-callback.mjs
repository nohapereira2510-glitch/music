// The Suno API requires a callBackUrl on every task. The app polls for results,
// so this endpoint only needs to acknowledge the callback.
export default async () =>
  new Response(JSON.stringify({ status: 'received' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
