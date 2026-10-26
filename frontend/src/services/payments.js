import { getPaymentConfig, initiatePayment, verifyPayment, dummyPay } from './api';

let cfgPromise = null;
export const loadPaymentConfig = () => {
    if (!cfgPromise) {
        cfgPromise = getPaymentConfig().then(r => r.data).catch(e => { cfgPromise = null; throw e; });
    }
    return cfgPromise;
};

function loadCheckoutScript() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
        document.body.appendChild(s);
    });
}

/**
 * The ONLY entry point the UI uses to take money.
 * mode 'dummy'    -> dev endpoint (instant, no money)
 * mode 'razorpay' -> create order -> Razorpay Checkout -> server-side signature verify
 * Resolves with the server's result ({ amount_paid, booking_ref, payment_summary, ... }).
 * Rejects with an Error; `err.cancelled` = customer closed the window.
 */
export async function payBooking({ bookingId, paymentType }) {
    const cfg = await loadPaymentConfig();
    if (cfg.mode === 'dummy') {
        return (await dummyPay(bookingId, paymentType)).data;
    }
    if (cfg.mode !== 'razorpay') throw new Error('Online payments are not available right now.');

    const { data: order } = await initiatePayment(bookingId, paymentType);
    await loadCheckoutScript();

    return new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
            key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency,
            name: order.name, description: order.description, prefill: order.prefill,
            theme: { color: '#0A9E87' },
            handler: async (resp) => {
                try {
                    const { data } = await verifyPayment(bookingId, {
                        razorpay_order_id: resp.razorpay_order_id,
                        razorpay_payment_id: resp.razorpay_payment_id,
                        razorpay_signature: resp.razorpay_signature,
                    });
                    resolve(data);
                } catch (e) { e.afterCharge = true; reject(e); }
            },
            modal: { ondismiss: () => { const e = new Error('Payment was not completed.'); e.cancelled = true; reject(e); } },
        });
        rzp.open();   // failed attempts are shown (and retried) inside Razorpay's own window
    });
}

export const paymentErrorMessage = (e) => {
    if (e?.afterCharge && e.response?.status !== 409) {
        return 'We received your payment but could not confirm it yet. It will update shortly — check My Bookings.';
    }
    return e?.response?.data?.error || e?.message || 'Payment failed.';
};