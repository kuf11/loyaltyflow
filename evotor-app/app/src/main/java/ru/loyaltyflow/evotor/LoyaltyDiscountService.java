package ru.loyaltyflow.evotor;

import android.content.Intent;
import android.os.RemoteException;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import ru.evotor.framework.core.IntegrationService;
import ru.evotor.framework.core.action.event.receipt.changes.position.IPositionChange;
import ru.evotor.framework.core.action.event.receipt.discount.ReceiptDiscountEvent;
import ru.evotor.framework.core.action.event.receipt.discount.ReceiptDiscountEventProcessor;
import ru.evotor.framework.core.action.event.receipt.discount.ReceiptDiscountEventResult;
import ru.evotor.framework.core.action.processor.ActionProcessor;

/** Entry point shown by Evotor on the payment screen. */
public final class LoyaltyDiscountService extends IntegrationService {
    private static Callback pendingCallback;

    @Nullable
    @Override
    protected Map<String, ActionProcessor> createProcessors() {
        Map<String, ActionProcessor> processors = new HashMap<>();
        processors.put(ReceiptDiscountEvent.NAME_SELL_RECEIPT, new ReceiptDiscountEventProcessor() {
            @Override
            public void call(@NonNull String action, @NonNull ReceiptDiscountEvent event, @NonNull Callback callback) {
                pendingCallback = callback;
                Intent intent = new Intent(getApplicationContext(), LoyaltyFlowActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.putExtra(LoyaltyFlowActivity.EXTRA_FROM_PAYMENT, true);
                try {
                    callback.startActivity(intent);
                } catch (RemoteException error) {
                    pendingCallback = null;
                    try { callback.skip(); } catch (RemoteException ignored) { }
                }
            }
        });
        return processors;
    }

    static void finishWithDiscount(double amount) {
        Callback callback = pendingCallback;
        pendingCallback = null;
        if (callback == null) return;
        try {
            ArrayList<IPositionChange> changes = new ArrayList<>();
            callback.onResult(new ReceiptDiscountEventResult(
                    BigDecimal.valueOf(Math.max(0d, amount)), null, changes, null));
        } catch (RemoteException ignored) {
            // Evotor has already closed the callback; no retry is safe here.
        }
    }

    static void cancelPending() {
        Callback callback = pendingCallback;
        pendingCallback = null;
        if (callback == null) return;
        try { callback.skip(); } catch (RemoteException ignored) { }
    }
}
