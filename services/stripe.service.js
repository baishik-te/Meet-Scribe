const stripe = require('../config/stripe');
const { Plan } = require('../models');

class StripeService {
  static async createProductAndPrice({ name, price, currency = 'usd' }) {
    const product = await stripe.products.create({
      name,
      metadata: { platform: 'TokenSaas' }
    });

    const unitAmount = Math.round(Number(price) * 100);
    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      recurring: { interval: 'month' }
    });

    return {
      stripeProductId: product.id,
      stripePriceId: stripePrice.id
    };
  }

  static async createNewPrice({ productId, price, currency = 'usd' }) {
    const unitAmount = Math.round(Number(price) * 100);
    const stripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      recurring: { interval: 'month' }
    });

    return {
      stripePriceId: stripePrice.id
    };
  }

  static async updateProductName({ productId, name }) {
    await stripe.products.update(productId, {
      name
    });
    return true;
  }

  static async createCheckoutSession({ user, planId, successUrl, cancelUrl }) {
    const plan = await Plan.findByPk(planId);
    if (!plan || plan.status !== 'ACTIVE') {
      throw new Error('Selected plan is invalid or inactive');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        planId: plan.id
      }
    });

    return session;
  }
}

module.exports = StripeService;