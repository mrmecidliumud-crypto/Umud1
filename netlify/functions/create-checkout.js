// netlify/functions/create-checkout.js
//
// Bu funksiya frontend-dən gələn sorğuya əsasən Stripe Checkout sessiyası yaradır
// və ödəniş səhifəsinin linkini (url) qaytarır. Kart məlumatları heç vaxt sizin
// serverinizdən keçmir — Stripe-ın özünün təhlükəsiz səhifəsində daxil edilir.
//
// TƏLƏB OLUNAN ENV DƏYİŞƏNİ (Netlify Dashboard > Site settings > Environment variables):
//   STRIPE_SECRET_KEY = sk_live_... (və ya test üçün sk_test_...)
//
// npm paketi lazımdır: "stripe". package.json-a əlavə edin:
//   npm install stripe

const Stripe = require('stripe');

exports.handler = async (event) => {
  // Yalnız POST sorğularına icazə veririk
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Yalnız POST sorğusuna icazə verilir.' }),
    };
  }

  // Stripe açarının mövcudluğunu yoxla
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'STRIPE_SECRET_KEY təyin edilməyib. Netlify Environment Variables bölməsindən əlavə edin.',
      }),
    };
  }

  const stripe = Stripe(secretKey);

  try {
    const data = JSON.parse(event.body || '{}');
    const {
      title,        // test başlığı, məs. "Cəbr Əsasları"
      price,        // dollarla qiymət, məs. 9.99
      quizId,       // testin daxili ID-si (sonra unlock etmək üçün)
      customerEmail // istifadəçinin email-i (ixtiyari)
    } = data;

    // Validasiya
    if (!title || typeof price !== 'number' || price <= 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'title və price (0-dan böyük rəqəm) tələb olunur.' }),
      };
    }

    // Saytın bazaürünvanını sorğunun header-lərindən təyin edirik,
    // beləliklə localhost, deploy-preview və production-da avtomatik işləyir.
    const origin = event.headers.origin || `https://${event.headers.host}`;

    // Stripe Checkout sessiyası yaradılır
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: title,
            },
            // Stripe məbləği "cent" ilə qəbul edir (1.00 USD = 100)
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      // Ödənişdən sonra istifadəçi bu linklərə yönləndirilir.
      // success_url-ə {CHECKOUT_SESSION_ID} əlavə edirik ki, frontend ödənişi təsdiqləyə bilsin.
      success_url: `${origin}/quizmaster-pro.html?payment=success&session_id={CHECKOUT_SESSION_ID}&quiz=${encodeURIComponent(quizId || '')}`,
      cancel_url: `${origin}/quizmaster-pro.html?payment=cancelled&quiz=${encodeURIComponent(quizId || '')}`,
      // quizId-ni metadata-da saxlayırıq ki, lazım olsa sonradan görünsün
      metadata: {
        quizId: String(quizId || ''),
        quizTitle: title,
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, id: session.id }),
    };
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Server xətası baş verdi.' }),
    };
  }
};
