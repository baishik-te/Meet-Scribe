const { Wallet, TokenLedger, sequelize } = require('../models');

class TokenService {
  static async creditTokens({ userId, amount, transactionType, referenceId = null, metadata = {} }, externalTx = null) {
    const execute = async (t) => {
      const wallet = await Wallet.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!wallet) {
        throw new Error('Wallet not found for the specified user');
      }

      const balanceBefore = wallet.currentTokenBalance;
      const balanceAfter = balanceBefore + Math.abs(amount);

      wallet.currentTokenBalance = balanceAfter;
      await wallet.save({ transaction: t });

      const ledgerEntry = await TokenLedger.create({
        userId,
        amount: Math.abs(amount),
        transactionType,
        balanceBefore,
        balanceAfter,
        referenceId,
        metadata
      }, { transaction: t });

      return { wallet, ledgerEntry };
    };

    if (externalTx) {
      return execute(externalTx);
    }
    return sequelize.transaction(execute);
  }

  static async deductTokens({ userId, amount, transactionType, referenceId = null, featureReference = null, metadata = {} }, externalTx = null) {
    const execute = async (t) => {
      const wallet = await Wallet.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!wallet) {
        throw new Error('Wallet not found for the specified user');
      }

      const balanceBefore = wallet.currentTokenBalance;
      const deductionAmount = Math.abs(amount);

      if (balanceBefore < deductionAmount) {
        const error = new Error('Insufficient token balance');
        error.name = 'InsufficientTokensError';
        throw error;
      }

      const balanceAfter = balanceBefore - deductionAmount;
      wallet.currentTokenBalance = balanceAfter;
      await wallet.save({ transaction: t });

      const ledgerEntry = await TokenLedger.create({
        userId,
        amount: -deductionAmount,
        transactionType,
        balanceBefore,
        balanceAfter,
        featureReference,
        referenceId,
        metadata
      }, { transaction: t });

      return { wallet, ledgerEntry };
    };

    if (externalTx) {
      return execute(externalTx);
    }
    return sequelize.transaction(execute);
  }

  static async getBalance(userId) {
    const wallet = await Wallet.findOne({ where: { userId } });
    return wallet ? wallet.currentTokenBalance : 0;
  }
}
module.exports = TokenService;