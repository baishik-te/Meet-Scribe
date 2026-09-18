const stripe = require('../config/stripe');
const { Op } = require('sequelize');
const { Wallet, TokenLedger, StripeWebhookEvent, Subscription, Plan, User, sequelize } = require('../models');
const TokenService = require('../services/token.service');

// ---------------------------------------------------------------------------
// Safe date helpers – handles both old and new Stripe API shapes
// Old API (<=2025-03-30): subscription.current_period_start  (Unix int)
// New API (>=2025-03-31): subscription.items.data[0].current_period_start
// ---------------------------------------------------------------------------
function getPeriodStart(sub) {
  // Top-level field (API <= 2025-03-30)
  if (sub.current_period_start) return new Date(sub.current_period_start * 1000);
  // Item-level field (API >= 2025-03-31)
  const ts = sub.items?.data?.[0]?.current_period_start;
  if (ts) return new Date(ts * 1000);
  // Last-resort fallback: now
  console.warn('WARNING: could not read period_start from subscription, using now()');
  return new Date();
}

function getPeriodEnd(sub) {
  if (sub.current_period_end) return new Date(sub.current_period_end * 1000);
  const ts = sub.items?.data?.[0]?.current_period_end;
  if (ts) return new Date(ts * 1000);
  // fallback: 30 days from now
  console.warn('WARNING: could not read period_end from subscription, using +30 days');
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function getInvoicePeriodStart(invoice) {
  const ts = invoice.lines?.data?.[0]?.period?.start;
  if (ts) return new Date(ts * 1000);
  return new Date();
}

function getInvoicePeriodEnd(invoice) {
  const ts = invoice.lines?.data?.[0]?.period?.end;
  if (ts) return new Date(ts * 1000);
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

class WalletController {
  static async getBalance(req, res, next) {
    try {
      const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
      return res.status(200).json({
        success: true,
        data: { balance: wallet ? wallet.currentTokenBalance : 0 }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLedgerHistory(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { rows, count } = await TokenLedger.findAndCountAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      return res.status(200).json({
        success: true,
        data: {
          entries: rows,
          total: count,
          page: parseInt(page, 10),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    console.log('[Webhook] received, sig present:', !!sig);

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      console.log('[Webhook] verified:', event.type, event.id);
    } catch (err) {
      console.error('[Webhook] signature failure:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotency check
    const [record, created] = await StripeWebhookEvent.findOrCreate({
      where: { eventId: event.id },
      defaults: { eventType: event.type, status: 'PROCESSING' }
    });

    if (!created && record.status === 'PROCESSED') {
      console.log('[Webhook] already processed:', event.id);
      return res.status(200).json({ received: true });
    }

    try {
      switch (event.type) {

        // ----------------------------------------------------------------
        // checkout.session.completed
        // The primary entry point: user finishes paying on Stripe Checkout
        // ----------------------------------------------------------------
        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.mode !== 'subscription') break;

          console.log('[checkout.session.completed] customer:', session.customer,
                      'email:', session.customer_details?.email);
          console.log('[checkout.session.completed] metadata:', session.metadata);

          // --- resolve userId ---
          let userId = session.metadata?.userId;
          if (!userId) {
            const email = session.customer_details?.email;
            if (!email) throw new Error('No userId in metadata and no customer email');
            const user = await User.findOne({ where: { email } });
            if (!user) throw new Error(`No user found for email: ${email}`);
            userId = user.id;
            console.log('[checkout] resolved userId by email:', userId);
          }

          // --- retrieve full subscription from Stripe ---
          const stripeSub = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ['items.data']
          });
          console.log('[checkout] stripeSub.id:', stripeSub.id);
          console.log('[checkout] stripeSub keys:', Object.keys(stripeSub).filter(k => k.includes('period')));
          console.log('[checkout] item keys:', Object.keys(stripeSub.items?.data?.[0] || {}).filter(k => k.includes('period')));

          const priceId = stripeSub.items.data[0].price.id;

          // --- resolve planId ---
          let planId = session.metadata?.planId;
          let plan = planId ? await Plan.findByPk(planId) : null;
          if (!plan) {
            plan = await Plan.findOne({ where: { stripePriceId: priceId } });
            if (!plan) throw new Error(`No plan found for priceId: ${priceId}`);
            planId = plan.id;
            console.log('[checkout] resolved plan by priceId:', plan.name);
          }

          const periodStart = getPeriodStart(stripeSub);
          const periodEnd   = getPeriodEnd(stripeSub);
          console.log('[checkout] periodStart:', periodStart, 'periodEnd:', periodEnd);

          await sequelize.transaction(async (t) => {
            // Cancel previous active subs for this user
            await Subscription.update(
              { status: 'CANCELED' },
              { where: { userId, status: 'ACTIVE', stripeSubscriptionId: { [Op.ne]: stripeSub.id } }, transaction: t }
            );

            const existing = await Subscription.findOne({
              where: { stripeSubscriptionId: stripeSub.id }, transaction: t
            });

            if (existing) {
              existing.status           = 'ACTIVE';
              existing.planId           = planId;
              existing.currentPeriodStart = periodStart;
              existing.currentPeriodEnd   = periodEnd;
              await existing.save({ transaction: t });
              console.log('[checkout] updated existing subscription:', existing.id);
            } else {
              await Subscription.create({
                userId,
                planId,
                stripeSubscriptionId: stripeSub.id,
                stripeCustomerId:     session.customer,
                stripePriceId:        priceId,
                status:               'ACTIVE',
                currentPeriodStart:   periodStart,
                currentPeriodEnd:     periodEnd
              }, { transaction: t });
              console.log('[checkout] created new subscription');
            }

            await TokenService.creditTokens({
              userId,
              amount:          plan.monthlyTokenQuota,
              transactionType: 'SUBSCRIPTION_CREDIT',
              referenceId:     stripeSub.id,
              metadata:        { planId, planName: plan.name, source: 'checkout_completion' }
            }, t);
          });

          console.log('[checkout] done for user:', userId, 'plan:', plan.name);
          break;
        }

        // ----------------------------------------------------------------
        // customer.subscription.created  (backup path, rarely needed)
        // ----------------------------------------------------------------
        case 'customer.subscription.created': {
          const stripeSub = event.data.object;
          const userId  = stripeSub.metadata?.userId;
          const planId  = stripeSub.metadata?.planId;

          if (!userId || !planId) {
            console.log('[subscription.created] no metadata, skipping');
            break;
          }

          const priceId = stripeSub.items.data[0].price.id;
          const plan = await Plan.findOne({ where: { stripePriceId: priceId } });
          if (!plan) { console.warn('[subscription.created] plan not found for price:', priceId); break; }

          await sequelize.transaction(async (t) => {
            const existing = await Subscription.findOne({
              where: { stripeSubscriptionId: stripeSub.id }, transaction: t
            });
            if (existing) { console.log('[subscription.created] already exists, skip'); return; }

            await Subscription.create({
              userId, planId: plan.id,
              stripeSubscriptionId: stripeSub.id,
              stripeCustomerId:     stripeSub.customer,
              stripePriceId:        priceId,
              status:               stripeSub.status.toUpperCase(),
              currentPeriodStart:   getPeriodStart(stripeSub),
              currentPeriodEnd:     getPeriodEnd(stripeSub)
            }, { transaction: t });

            if (stripeSub.status === 'active') {
              await TokenService.creditTokens({
                userId, amount: plan.monthlyTokenQuota,
                transactionType: 'SUBSCRIPTION_CREDIT',
                referenceId: stripeSub.id,
                metadata: { planId: plan.id, source: 'subscription_created' }
              }, t);
            }
          });
          break;
        }

        // ----------------------------------------------------------------
        // customer.subscription.updated
        // ----------------------------------------------------------------
        case 'customer.subscription.updated': {
          const stripeSub = event.data.object;
          const sub = await Subscription.findOne({ where: { stripeSubscriptionId: stripeSub.id } });
          if (!sub) { console.warn('[subscription.updated] not found:', stripeSub.id); break; }

          sub.status             = stripeSub.status.toUpperCase();
          sub.currentPeriodStart = getPeriodStart(stripeSub);
          sub.currentPeriodEnd   = getPeriodEnd(stripeSub);
          sub.cancelAtPeriodEnd  = stripeSub.cancel_at_period_end;
          await sub.save();
          console.log('[subscription.updated] saved, status:', sub.status);
          break;
        }

        // ----------------------------------------------------------------
        // invoice.payment_succeeded / invoice.paid  (renewal credit)
        // ----------------------------------------------------------------
        case 'invoice.payment_succeeded':
        case 'invoice.paid': {
          const invoice = event.data.object;
          const reason  = invoice.billing_reason;
          console.log('[invoice.paid] reason:', reason);

          if (reason !== 'subscription_cycle' && reason !== 'subscription_create') break;

          const sub = await Subscription.findOne({
            where: { stripeSubscriptionId: invoice.subscription },
            include: [{ model: Plan, as: 'plan' }]
          });
          if (!sub?.plan) { console.warn('[invoice.paid] subscription/plan not found'); break; }

          await sequelize.transaction(async (t) => {
            sub.currentPeriodStart = getInvoicePeriodStart(invoice);
            sub.currentPeriodEnd   = getInvoicePeriodEnd(invoice);
            sub.status = 'ACTIVE';
            await sub.save({ transaction: t });

            await TokenService.creditTokens({
              userId: sub.userId, amount: sub.plan.monthlyTokenQuota,
              transactionType: 'SUBSCRIPTION_CREDIT',
              referenceId: invoice.id,
              metadata: { subscriptionId: sub.id, planName: sub.plan.name, renewal: reason === 'subscription_cycle' }
            }, t);
          });
          console.log('[invoice.paid] tokens credited for plan:', sub.plan.name);
          break;
        }

        // ----------------------------------------------------------------
        // invoice.payment_failed
        // ----------------------------------------------------------------
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            await Subscription.update(
              { status: 'PAST_DUE' },
              { where: { stripeSubscriptionId: invoice.subscription } }
            );
          }
          break;
        }

        // ----------------------------------------------------------------
        // customer.subscription.deleted
        // ----------------------------------------------------------------
        case 'customer.subscription.deleted': {
          await Subscription.update(
            { status: 'CANCELED' },
            { where: { stripeSubscriptionId: event.data.object.id } }
          );
          console.log('[subscription.deleted] marked CANCELED');
          break;
        }

        default:
          console.log('[Webhook] unhandled event:', event.type);
      }

      record.status = 'PROCESSED';
      await record.save();
      return res.status(200).json({ received: true });

    } catch (err) {
      console.error('[Webhook] processing error:', err.message);
      console.error(err.stack);
      record.status = 'FAILED';
      await record.save();
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}

module.exports = WalletController;
