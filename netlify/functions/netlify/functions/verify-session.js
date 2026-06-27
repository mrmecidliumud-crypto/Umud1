// netlify/functions/verify-session.js
//
// Frontend, ödənişdən sonra success_url-ə qayıdanda bu funksiyanı çağırır.
// Bu, session_id-nin doğrudan da Stripe tərəfindən "ödənilmiş" kimi işarələndiyini
// yoxlayır — sadəcə URL-dəki parametrə güvənmək təhlükəlidir, çünki istənilən
// kəs əllə "?payment=success" yaza bilər.

const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Yalnız GET sorğusuna icazə verilir.' }),
    };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY təyin edilməyib.' }),
    };
  }

  const stripe = Stripe(secretKey);
  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'session_id tələb olunur.' }),
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid,
        quizId: session.metadata ? session.metadata.quizId : null,
        email: session.customer_email || session.customer_details?.email || null,
        amountTotal: session.amount_total,
      }),
    };
  } catch (err) {
    console.error('Verify session error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Sessiya yoxlanıla bilmədi.' }),
    };
  }
};
