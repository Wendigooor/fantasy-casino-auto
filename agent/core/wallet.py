#!/usr/bin/env python3
"""Wallet module for Fantasy Casino.

Provides the Wallet class with balance management, deposits, withdrawals,
and transfers between wallets. All monetary values use Decimal for precision.
"""

from decimal import Decimal, InvalidOperation
from typing import Optional


class InsufficientFundsError(Exception):
    """Raised when a wallet has insufficient funds for a transaction."""

    def __init__(self, wallet_balance: Decimal, amount: Decimal) -> None:
        self.wallet_balance = wallet_balance
        self.amount = amount
        super().__init__(
            f"Insufficient funds: balance={wallet_balance}, "
            f"requested={amount}"
        )


class InvalidAmountError(Exception):
    """Raised when a transaction amount is invalid."""

    def __init__(self, amount: object) -> None:
        self.amount = amount
        super().__init__(f"Invalid amount: {amount}")


class CurrencyMismatchError(Exception):
    """Raised when transferring between wallets of different currencies."""

    def __init__(self, from_currency: str, to_currency: str) -> None:
        self.from_currency = from_currency
        self.to_currency = to_currency
        super().__init__(
            f"Currency mismatch: cannot transfer {from_currency} "
            f"to {to_currency}"
        )


class Wallet:
    """Represents a user's casino wallet.

    Attributes:
        user_id: Unique identifier for the user.
        currency: Currency code (e.g., 'USD', 'EUR', 'BTC').
        balance: Current wallet balance as a Decimal.

    Example:
        >>> wallet = Wallet(user_id="user_123", currency="USD")
        >>> wallet.deposit(Decimal("100.00"))
        >>> wallet.get_balance()
        Decimal('100.00')
    """

    def __init__(
        self,
        user_id: str,
        currency: str = "USD",
        initial_balance: Optional[Decimal] = None,
    ) -> None:
        """Initialize a new wallet.

        Args:
            user_id: Unique user identifier.
            currency: Currency code. Defaults to 'USD'.
            initial_balance: Starting balance. Defaults to Decimal('0').
        """
        self.user_id = user_id
        self.currency = currency.upper()
        self.balance = initial_balance if initial_balance is not None else Decimal("0")

    def deposit(self, amount: Decimal) -> Decimal:
        """Deposit funds into the wallet.

        Args:
            amount: Amount to deposit (must be positive).

        Returns:
            New balance after deposit.

        Raises:
            InvalidAmountError: If amount is not positive.
        """
        if not self._is_valid_amount(amount):
            raise InvalidAmountError(amount)
        self.balance += amount
        return self.balance

    def withdraw(self, amount: Decimal) -> Decimal:
        """Withdraw funds from the wallet.

        Args:
            amount: Amount to withdraw (must be positive, <= balance).

        Returns:
            New balance after withdrawal.

        Raises:
            InvalidAmountError: If amount is not positive.
            InsufficientFundsError: If balance is insufficient.
        """
        if not self._is_valid_amount(amount):
            raise InvalidAmountError(amount)
        if amount > self.balance:
            raise InsufficientFundsError(self.balance, amount)
        self.balance -= amount
        return self.balance

    def get_balance(self) -> Decimal:
        """Get the current wallet balance.

        Returns:
            Current balance as Decimal.
        """
        return self.balance

    def transfer(self, to_wallet: "Wallet", amount: Decimal) -> tuple[Decimal, Decimal]:
        """Transfer funds to another wallet.

        Both wallets must have the same currency. The amount is debited
        from this wallet and credited to the target wallet.

        Args:
            to_wallet: Target wallet to receive funds.
            amount: Amount to transfer (must be positive).

        Returns:
            Tuple of (sender_new_balance, receiver_new_balance).

        Raises:
            InvalidAmountError: If amount is not positive.
            InsufficientFundsError: If this wallet has insufficient funds.
            CurrencyMismatchError: If wallets have different currencies.
        """
        if self.currency != to_wallet.currency:
            raise CurrencyMismatchError(self.currency, to_wallet.currency)
        if not self._is_valid_amount(amount):
            raise InvalidAmountError(amount)
        if amount > self.balance:
            raise InsufficientFundsError(self.balance, amount)

        self.balance -= amount
        to_wallet.balance += amount

        return (self.balance, to_wallet.balance)

    def _is_valid_amount(self, amount: object) -> bool:
        """Check if an amount is a valid positive number.

        Args:
            amount: Amount to validate.

        Returns:
            True if amount is a positive Decimal.
        """
        try:
            d = Decimal(str(amount))
            return d > 0
        except (InvalidOperation, TypeError, ValueError):
            return False

    def __repr__(self) -> str:
        return (
            f"Wallet(user_id={self.user_id!r}, currency={self.currency!r}, "
            f"balance={self.balance})"
        )
