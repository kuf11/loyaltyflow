package ru.loyaltyflow.evotor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import ru.evotor.framework.core.action.event.receipt.receipt_edited.ReceiptClearedEvent;
import ru.evotor.framework.core.action.event.receipt.receipt_edited.ReceiptClosedEvent;

/** Commits a reservation after a sale or releases it when the receipt is cleared. */
public final class LoyaltyReceiptReceiver extends BroadcastReceiver {
    private static final String SELL_CLEARED = "evotor.intent.action.receipt.sell.CLEARED";
    private static final String SELL_CLOSED = "evotor.intent.action.receipt.sell.RECEIPT_CLOSED";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : intent.getAction();
        String receiptUuid = null;
        boolean commit = false;
        if (SELL_CLOSED.equals(action)) {
            ReceiptClosedEvent event = ReceiptClosedEvent.create(intent.getExtras());
            if (event != null) {
                receiptUuid = event.getReceiptUuid();
                commit = true;
            }
        } else if (SELL_CLEARED.equals(action)) {
            ReceiptClearedEvent event = ReceiptClearedEvent.create(intent.getExtras());
            if (event != null) receiptUuid = event.getReceiptUuid();
        }
        if (receiptUuid == null || receiptUuid.isEmpty()) return;

        final String finalReceiptUuid = receiptUuid;
        final boolean finalCommit = commit;
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                if (finalCommit) LoyaltyDiscountService.commitReservation(context, finalReceiptUuid);
                else LoyaltyDiscountService.releaseReservation(context, finalReceiptUuid);
            } finally {
                pending.finish();
            }
        }, "loyaltyflow-evotor-reservation").start();
    }
}
