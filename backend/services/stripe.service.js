const stripe = require('../config/stripe');
const { Op } = require('sequelize');
const { Plan, Subscription, User, Wallet, TokenLedger, sequelize } = require('../models');
const TokenService = require('./token.service');

function getPeriodStart(sub) {
  if (sub.current_period_start) return new Date(sub.current_period_start * 1000);
  const ts = sub.items?.data?.[0]?.current_period_start;
  if (ts) return new Date(ts * 1000);
  return new Date();
}

function calculatePeriodEnd(startDate, billingPeriod = 'month') {
  const d = new Date(startDate);
  switch (billingPeriod) {
    case '3_months':
      d.setMonth(d.getMonth() + 3);
      return d;
    case '6_months':
      d.setMonth(d.getMonth() + 6);
    case 'year':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case 'month':
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

function getPeriodEnd(sub, plan = null) {
  const start = getPeriodStart(sub);
  const billingPeriod = plan?.billingPeriod || 'month';
  const expectedEnd = calculatePeriodEnd(start, billingPeriod);

  let stripeEnd = null;
  if (sub.current_period_end) {
    stripeEnd = new Date(sub.current_period_end * 1000);
  } else if (sub.items?.data?.[0]?.current_period_end) {
    stripeEnd = new Date(sub.items.data[0].current_period_end * 1000);
  }

  if (stripeEnd && stripeEnd >= expectedEnd) {
    return stripeEnd;
  }
  return expectedEnd;
}

function getStripeRecurring(billingPeriod = 'month') {
  switch (billingPeriod) {
    case '3_months':
      return { interval: 'month', interval_count: 3 };
    case '6_months':
      return { interval: 'month', interval_count: 6 };
    case 'year':
      return { interval: 'year', interval_count: 1 };
    case 'month':
    default:
      return { interval: 'month', interval_count: 1 };
  }
}

class StripeService {
  static async createProductAndPrice({ name, price, currency = 'usd', billingPeriod = 'month' }) {
    const product = await stripe.products.create({
      name,
      metadata: { platform: 'TokenSaas' }
    });

    const unitAmount = Math.round(Number(price) * 100);
    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      recurring: getStripeRecurring(billingPeriod)
    });

    return {
      stripeProductId: product.id,
      stripePriceId: stripePrice.id
    };
  }

  static async createNewPrice({ productId, price, currency = 'usd', billingPeriod = 'month' }) {
    const unitAmount = Math.round(Number(price) * 100);
    const stripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      recurring: getStripeRecurring(billingPeriod)
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

  /**
   * Retrieves payment status directly from Stripe and synchronizes the subscription plan.
   * If payment has failed or is unpaid, no change is made to the plan.
   * If payment succeeded, updates the user's plan, credits tokens, and notifies user.
   */
  static async verifyAndSyncPayment({ userId, sessionId = null }) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    let stripeSub = null;
    let customerId = user.stripeCustomerId;
    let planId = null;

    if (sessionId) {
      console.log(`[StripeService] Retrieving checkout session ${sessionId}...`);
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer']
      });

      if (session.metadata?.userId && session.metadata.userId !== String(userId)) {
        throw new Error('Unauthorized checkout session verification attempt');
      }

      console.log(`[StripeService] Session ${sessionId} status: ${session.status}, payment_status: ${session.payment_status}`);

      // If payment failed or is unpaid, do NOT change plan
      if (session.payment_status !== 'paid') {
        return {
          success: false,
          status: session.payment_status || session.status || 'UNPAID',
          message: `Payment status is ${session.payment_status || 'unpaid'}. Subscription plan was not changed.`
        };
      }

      customerId = typeof session.customer === 'string' ? session.customer : (session.customer?.id || customerId);
      if (session.subscription) {
        if (typeof session.subscription === 'object') {
          stripeSub = session.subscription;
        } else {
          stripeSub = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ['items.data']
          });
        }
      }
      planId = session.metadata?.planId;
    } else {
      // No sessionId passed: look up active subscriptions by customerId in Stripe
      if (!customerId) {
        return {
          success: false,
          status: 'NO_CUSTOMER',
          message: 'No Stripe customer record exists for this user.'
        };
      }

      console.log(`[StripeService] Looking up active subscriptions for customer ${customerId}...`);
      const activeSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
        expand: ['data.items.data.price']
      });

      if (!activeSubs.data || activeSubs.data.length === 0) {
        const anySubs = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
        const lastStatus = anySubs.data?.[0]?.status || 'NO_SUBSCRIPTION';
        return {
          success: false,
          status: lastStatus,
          message: `No active paid subscription found in Stripe (latest status: ${lastStatus}). Plan was not changed.`
        };
      }

      stripeSub = activeSubs.data[0];
    }

    if (!stripeSub || !['active', 'trialing'].includes(stripeSub.status)) {
      return {
        success: false,
        status: stripeSub?.status || 'INACTIVE',
        message: `Subscription status in Stripe is ${stripeSub?.status || 'inactive'}. Plan was not changed.`
      };
    }

    // Resolve plan by price ID if planId not from metadata
    const priceId = stripeSub.items?.data?.[0]?.price?.id;
    let plan = planId ? await Plan.findByPk(planId) : null;
    if (!plan && priceId) {
      plan = await Plan.findOne({ where: { stripePriceId: priceId } });
    }

    if (!plan) {
      console.warn(`[StripeService] Plan not found for priceId: ${priceId}`);
      return {
        success: false,
        status: 'PLAN_NOT_FOUND',
        message: `Subscription found in Stripe, but matching plan was not found for price: ${priceId}`
      };
    }

    if (!user.stripeCustomerId && customerId) {
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const periodStart = getPeriodStart(stripeSub);
    const periodEnd = getPeriodEnd(stripeSub, plan);

    let activeSubRecord = null;
    let isNewSubscriptionCredit = false;
    await sequelize.transaction(async (t) => {
      // Mark any other active subscriptions as canceled
      await Subscription.update(
        { status: 'CANCELED' },
        {
          where: {
            userId: user.id,
            status: 'ACTIVE',
            stripeSubscriptionId: { [Op.ne]: stripeSub.id }
          },
          transaction: t
        }
      );

      // Upsert subscription
      const [record] = await Subscription.findOrCreate({
        where: { stripeSubscriptionId: stripeSub.id },
        defaults: {
          userId: user.id,
          planId: plan.id,
          stripeCustomerId: customerId,
          stripePriceId: priceId,
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd
        },
        transaction: t
      });

      record.status = 'ACTIVE';
      record.planId = plan.id;
      record.currentPeriodStart = periodStart;
      record.currentPeriodEnd = periodEnd;
      if (customerId) record.stripeCustomerId = customerId;
      if (priceId) record.stripePriceId = priceId;
      await record.save({ transaction: t });
      activeSubRecord = record;

      // Credit tokens with idempotency
      const alreadyCredited = await TokenLedger.findOne({
        where: {
          userId: user.id,
          transactionType: 'SUBSCRIPTION_CREDIT',
          referenceId: stripeSub.id
        },
        transaction: t
      });

      if (!alreadyCredited) {
        isNewSubscriptionCredit = true;
        await TokenService.creditTokens(
          {
            userId: user.id,
            amount: plan.monthlyTokenQuota,
            transactionType: 'SUBSCRIPTION_CREDIT',
            referenceId: stripeSub.id,
            metadata: {
              planId: plan.id,
              planName: plan.name,
              source: sessionId ? 'checkout_verification' : 'stripe_sync'
            }
          },
          t
        );
      }
    });

    // Only send PLAN_UPGRADE notification if this was a new subscription purchase/credit or a new checkout session
    if (isNewSubscriptionCredit || sessionId) {
      try {
        const NotificationService = require('./notification.service');
        await NotificationService.createNotification({
          userId: user.id,
          type: 'PLAN_UPGRADE',
          title: 'Plan Upgraded',
          message: `You are now subscribed to the ${plan.name} plan with ${plan.monthlyTokenQuota} monthly tokens.`,
          data: { planId: plan.id, planName: plan.name, stripeSubscriptionId: stripeSub.id }
        });
      } catch (e) {
        // non-blocking
      }
    }

    const wallet = await Wallet.findOne({ where: { userId: user.id } });
    const populatedSub = await Subscription.findByPk(activeSubRecord.id, {
      include: [{ model: Plan, as: 'plan' }]
    });

    return {
      success: true,
      status: 'paid',
      message: `Payment verified! You are now subscribed to ${plan.name}.`,
      data: {
        subscription: populatedSub,
        plan,
        balance: wallet ? wallet.currentTokenBalance : 0
      }
    };
  }
}

module.exports = StripeService;