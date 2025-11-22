
'use client';

import {
  type RecurringTransaction,
  type Account,
  type Transaction,
} from '@/lib/types';
import {
  Timestamp,
  type Firestore,
  writeBatch,
  collection,
  doc,
} from 'firebase/firestore';
import { addMonths, addYears, isBefore } from 'date-fns';

/**
 * Calculates the next due date for a recurring transaction.
 * @param lastDueDate The last due date.
 * @param frequency The frequency of the transaction.
 * @returns The new due date as a Date object.
 */
function calculateNextDueDate(lastDueDate: Date, frequency: RecurringTransaction['frequency']): Date {
  switch (frequency) {
    case 'monthly':
      return addMonths(lastDueDate, 1);
    case 'quarterly':
      return addMonths(lastDueDate, 3);
    case 'semi-annually':
      return addMonths(lastDueDate, 6);
    case 'yearly':
      return addYears(lastDueDate, 1);
    default:
      // Default to monthly if frequency is unknown, though this shouldn't happen with proper types.
      return addMonths(lastDueDate, 1);
  }
}

/**
 * Processes all recurring transactions for a user, creating actual transactions for any that are due.
 * This function is designed to be called when the application loads to "catch up" on any missed occurrences.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the current user.
 * @param recurringTransactions - An array of the user's recurring transactions.
 * @param accounts - An array of the user's accounts.
 * @returns A promise that resolves when the processing is complete.
 */
export async function processRecurringTransactions(
  firestore: Firestore,
  userId: string,
  recurringTransactions: RecurringTransaction[],
  accounts: Account[]
) {
  const today = new Date();
  const batch = writeBatch(firestore);
  const accountBalanceUpdates = new Map<string, number>();

  for (const rt of recurringTransactions) {
    if (!rt.isActive) {
      continue;
    }
    
    let nextDueDate = (rt.nextDueDate as Timestamp).toDate();
    const endDate = rt.endDate ? (rt.endDate as Timestamp).toDate() : null;

    // Loop to process all due occurrences since the last check
    while (isBefore(nextDueDate, today)) {
      // Stop if the next due date is past the end date
      if (endDate && isBefore(endDate, nextDueDate)) {
        // Optionally, mark the recurring transaction as inactive
        const rtRef = doc(firestore, "users", userId, "recurring_transactions", rt.id);
        batch.update(rtRef, { isActive: false });
        break; 
      }

      // 1. Create a new Transaction
      const newTransactionRef = doc(collection(firestore, 'users', userId, 'transactions'));
      const newTransaction: Omit<Transaction, 'id'> = {
        accountId: rt.accountId,
        categoryId: rt.categoryId,
        amount: rt.amount,
        date: Timestamp.fromDate(nextDueDate),
        description: `${rt.description} (Recurring)`,
        type: rt.type,
        isRecurring: true,
      };
      batch.set(newTransactionRef, newTransaction);

      // 2. Aggregate balance changes
      const currentUpdate = accountBalanceUpdates.get(rt.accountId) || 0;
      const change = rt.type === 'income' ? rt.amount : -rt.amount;
      accountBalanceUpdates.set(rt.accountId, currentUpdate + change);
      
      // 3. Calculate the next due date for the loop
      nextDueDate = calculateNextDueDate(nextDueDate, rt.frequency);
    }

    // 4. Update the nextDueDate on the recurring transaction if it has changed
    const originalNextDueDate = (rt.nextDueDate as Timestamp).toDate();
    if (nextDueDate.getTime() !== originalNextDueDate.getTime()) {
        const rtRef = doc(firestore, "users", userId, "recurring_transactions", rt.id);
        batch.update(rtRef, { nextDueDate: Timestamp.fromDate(nextDueDate) });
    }
  }

  // Apply account balance updates
  accountBalanceUpdates.forEach((change, accountId) => {
    const accountRef = doc(firestore, 'users', userId, 'accounts', accountId);
    const originalAccount = accounts.find(acc => acc.id === accountId);
    if (originalAccount) {
      // In a real transaction you'd read the balance first. Here we simulate.
      // Note: This is not truly transactional and could have race conditions
      // if multiple clients run this simultaneously. For a prototype, it's acceptable.
      const newBalance = originalAccount.balance + change;
      batch.update(accountRef, { balance: newBalance });
    }
  });


  // Commit all changes in a single batch
  if (accountBalanceUpdates.size > 0) {
      try {
        await batch.commit();
        console.log("Successfully processed recurring transactions.");
      } catch (error) {
        console.error("Error processing recurring transactions:", error);
      }
  }
}
