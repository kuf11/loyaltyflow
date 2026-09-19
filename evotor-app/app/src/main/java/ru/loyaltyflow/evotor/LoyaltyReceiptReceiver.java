package ru.loyaltyflow.evotor;

import android.content.Context;

import ru.evotor.framework.receipt.event.ApplyDiscountToReceiptEvent;
import ru.evotor.framework.receipt.event.ReceiptCompletedEvent;
import ru.evotor.framework.receipt.event.ReceiptCreatedEvent;
import ru.evotor.framework.receipt.event.ReceiptDeletedEvent;
import ru.evotor.framework.receipt.event.ReceiptEditScreenOpenedEvent;
import ru.evotor.framework.receipt.event.ReceiptPaymentScreenOpenedEvent;
import ru.evotor.framework.receipt.event.ReceiptWithPaymentIntentPaidEvent;
import ru.evotor.framework.receipt.event.handler.receiver.ReceiptBroadcastReceiver;
import ru.evotor.framework.receipt.position.event.PositionAddedEvent;
import ru.evotor.framework.receipt.position.event.PositionRemovedEvent;
import ru.evotor.framework.receipt.position.event.PositionUpdatedEvent;

/** Commits a reservation after a sale or releases it when the receipt is cleared. */
public final class LoyaltyReceiptReceiver extends ReceiptBroadcastReceiver {
    public LoyaltyReceiptReceiver() {
        super(
                "evotor.intent.action.receipt.sell.OPENED",
                "evotor.intent.action.receipt.sell.POSITION_ADDED",
                "evotor.intent.action.receipt.sell.POSITION_EDITED",
                "evotor.intent.action.receipt.sell.POSITION_REMOVED",
                "evotor.intent.action.receipt.sell.APPLY_DISCOUNT_TO_RECEIPT",
                "evotor.intent.action.receipt.sell.CLEARED",
                "evotor.intent.action.receipt.sell.RECEIPT_CLOSED",
                "evotor.intent.action.receipt.sell.EDIT_SCREEN_OPENED",
                "evotor.intent.action.receipt.sell.PAYMENT_SCREEN_OPENED",
                "evotor.intent.action.receipt.sell.paymentIntent.PAID");
    }

    @Override protected void handleReceiptCreatedEvent(Context context, ReceiptCreatedEvent event) { }
    @Override protected void handlePositionAddedEvent(Context context, PositionAddedEvent event) { }
    @Override protected void handlePositionUpdatedEvent(Context context, PositionUpdatedEvent event) { }
    @Override protected void handlePositionRemovedEvent(Context context, PositionRemovedEvent event) { }
    @Override protected void handleApplyDiscountToReceiptEvent(Context context, ApplyDiscountToReceiptEvent event) { }
    @Override protected void handleReceiptEditScreenOpenedEvent(Context context, ReceiptEditScreenOpenedEvent event) { }
    @Override protected void handleReceiptPaymentScreenOpenedEvent(Context context, ReceiptPaymentScreenOpenedEvent event) { }
    @Override protected void handleReceiptWithPaymentIntentPaid(Context context, ReceiptWithPaymentIntentPaidEvent event) { }

    @Override
    protected void handleReceiptCompletedEvent(Context context, ReceiptCompletedEvent event) {
        finishAsync(context, event.getReceiptUuid(), true);
    }

    @Override
    protected void handleReceiptDeletedEvent(Context context, ReceiptDeletedEvent event) {
        finishAsync(context, event.getReceiptUuid(), false);
    }

    private void finishAsync(Context context, String receiptUuid, boolean commit) {
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                if (commit) LoyaltyDiscountService.commitReservation(context, receiptUuid);
                else LoyaltyDiscountService.releaseReservation(context, receiptUuid);
            } finally {
                pending.finish();
            }
        }, "loyaltyflow-evotor-reservation").start();
    }
}
