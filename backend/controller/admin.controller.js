const { Plan, User, Wallet, TokenLedger, Call, Recording, AuditLog, sequelize } = require('../models');
const StripeService = require('../services/stripe.service');
const TokenService = require('../services/token.service');

class AdminController {
  static async createPlan(req, res, next) {
    const {
      name, price, currency = 'usd', billingPeriod = 'month', monthlyTokenQuota,
      videoRatePerMinute, recordingRatePerMinute,
      transcriptionRatePerMinute, geminiRatePerRequest
    } = req.body;

    try {
      const { stripeProductId, stripePriceId } = await StripeService.createProductAndPrice({
        name,
        price,
        currency,
        billingPeriod
      });

      const plan = await Plan.create({
        name,
        stripeProductId,
        stripePriceId,
        price,
        currency,
        billingPeriod,
        monthlyTokenQuota,
        videoRatePerMinute,
        recordingRatePerMinute,
        transcriptionRatePerMinute,
        geminiRatePerRequest,
        status: 'ACTIVE'
      });

      await AuditLog.create({
        actorUserId: req.user.id,
        action: 'CREATE_PLAN',
        entityType: 'Plan',
        entityId: plan.id,
        newValue: plan.toJSON(),
        ipAddress: req.ip
      });

      return res.status(201).json({ success: true, data: { plan } });
    } catch (error) {
      next(error);
    }
  }

  static async updatePlan(req, res, next) {
    const { id } = req.params;
    const {
      name, price, billingPeriod, monthlyTokenQuota,
      videoRatePerMinute, recordingRatePerMinute,
      transcriptionRatePerMinute, geminiRatePerRequest
    } = req.body;

    try {
      const plan = await Plan.findByPk(id);
      if (!plan) {
        return res.status(404).json({ 
          success: false, 
          error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' } 
        });
      }

      const oldValue = plan.toJSON();
      const priceChanged = price !== undefined && Number(price) !== Number(plan.price);
      const periodChanged = billingPeriod !== undefined && billingPeriod !== plan.billingPeriod;

      // If price or billing period changed - requires new Stripe recurring price
      if (priceChanged || periodChanged) {
        const targetPrice = price !== undefined ? price : plan.price;
        const targetPeriod = billingPeriod !== undefined ? billingPeriod : (plan.billingPeriod || 'month');
        const { stripePriceId } = await StripeService.createNewPrice({
          productId: plan.stripeProductId,
          price: targetPrice,
          currency: plan.currency || 'usd',
          billingPeriod: targetPeriod
        });
        plan.stripePriceId = stripePriceId;
        plan.price = targetPrice;
        plan.billingPeriod = targetPeriod;
      }

      // Update plan name in Stripe if changed
      if (name !== undefined && name !== plan.name) {
        await StripeService.updateProductName({
          productId: plan.stripeProductId,
          name
        });
        plan.name = name;
      }

      // Update other fields
      if (monthlyTokenQuota !== undefined) plan.monthlyTokenQuota = monthlyTokenQuota;
      if (videoRatePerMinute !== undefined) plan.videoRatePerMinute = videoRatePerMinute;
      if (recordingRatePerMinute !== undefined) plan.recordingRatePerMinute = recordingRatePerMinute;
      if (transcriptionRatePerMinute !== undefined) plan.transcriptionRatePerMinute = transcriptionRatePerMinute;
      if (geminiRatePerRequest !== undefined) plan.geminiRatePerRequest = geminiRatePerRequest;

      await plan.save();

      await AuditLog.create({
        actorUserId: req.user.id,
        action: 'UPDATE_PLAN',
        entityType: 'Plan',
        entityId: plan.id,
        oldValue,
        newValue: plan.toJSON(),
        ipAddress: req.ip
      });

      return res.status(200).json({ success: true, data: { plan } });
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req, res, next) {
    try {
      const users = await User.findAll({
        attributes: ['id', 'name', 'email', 'role', 'status', 'emailVerified', 'createdAt'],
        include: [{ model: Wallet, as: 'wallet', attributes: ['currentTokenBalance'] }]
      });
      return res.status(200).json({ success: true, data: { users } });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req, res, next) {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const targetUser = await User.findByPk(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      }

      const previousStatus = targetUser.status;
      targetUser.status = status;
      await targetUser.save();

      await AuditLog.create({
        actorUserId: req.user.id,
        action: 'UPDATE_USER_STATUS',
        entityType: 'User',
        entityId: targetUser.id,
        oldValue: { status: previousStatus },
        newValue: { status },
        ipAddress: req.ip
      });

      return res.status(200).json({ success: true, data: { user: targetUser } });
    } catch (error) {
      next(error);
    }
  }

  static async adjustTokens(req, res, next) {
    const { userId, amount, reason } = req.body;
    try {
      const numericAmount = parseInt(amount, 10);
      let result;

      await sequelize.transaction(async (t) => {
        if (numericAmount >= 0) {
          result = await TokenService.creditTokens({
            userId,
            amount: numericAmount,
            transactionType: 'MANUAL_CREDIT',
            metadata: { reason, adjustedBy: req.user.id }
          }, t);
        } else {
          result = await TokenService.deductTokens({
            userId,
            amount: Math.abs(numericAmount),
            transactionType: 'ADMIN_ADJUSTMENT',
            metadata: { reason, adjustedBy: req.user.id }
          }, t);
        }

        await AuditLog.create({
          actorUserId: req.user.id,
          action: 'MANUAL_TOKEN_ADJUSTMENT',
          entityType: 'Wallet',
          entityId: userId,
          newValue: { amount: numericAmount, reason },
          ipAddress: req.ip
        }, { transaction: t });
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listAllLedgers(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const { rows, count } = await TokenLedger.findAndCountAll({
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
      });

      return res.status(200).json({
        success: true,
        data: { entries: rows, total: count, totalPages: Math.ceil(count / limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  static async listCalls(req, res, next) {
    try {
      const calls = await Call.findAll({
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'caller', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'receiver', attributes: ['id', 'name', 'email'] },
          { model: Recording, as: 'recordings' }
        ]
      });
      return res.status(200).json({ success: true, data: { calls } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;