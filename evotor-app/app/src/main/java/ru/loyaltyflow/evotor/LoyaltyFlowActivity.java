package ru.loyaltyflow.evotor;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * First native payment-screen flow. Server-side quote/redeem endpoints are
 * intentionally required before production publishing.
 */
public final class LoyaltyFlowActivity extends Activity {
    static final String EXTRA_FROM_PAYMENT = "from_payment";
    static final String EXTRA_RECEIPT_UUID = "receipt_uuid";
    static final String EXTRA_RECEIPT_TOTAL = "receipt_total";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private EditText qrInput, amountInput;
    private TextView status;
    private double receiptTotal;
    private double approvedDiscount = 0d;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setTitle("LoyaltyFlow");
        receiptTotal = getIntent().getDoubleExtra(EXTRA_RECEIPT_TOTAL, 0d);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 32, 32, 32);

        TextView title = new TextView(this);
        title.setText("LoyaltyFlow\nБонусы клиента");
        title.setTextSize(24);
        root.addView(title);

        status = new TextView(this);
        status.setText(receiptTotal > 0d
                ? "Сумма чека получена из Эвотор. Отсканируйте QR клиента."
                : "Не удалось получить сумму текущего чека Эвотор.");
        root.addView(status);

        qrInput = new EditText(this);
        qrInput.setHint("QR или код клиента");
        qrInput.setSingleLine(true);
        root.addView(qrInput);

        amountInput = new EditText(this);
        amountInput.setHint("Сумма покупки из кассы, ₽");
        amountInput.setSingleLine(true);
        amountInput.setText(receiptTotal > 0d ? formatMoney(receiptTotal) : "");
        amountInput.setEnabled(false);
        root.addView(amountInput);

        Button check = new Button(this);
        check.setText("Проверить клиента");
        check.setOnClickListener(v -> quote());
        root.addView(check);

        Button apply = new Button(this);
        apply.setText("Применить скидку");
        apply.setOnClickListener(v -> applyDiscount());
        root.addView(apply);

        Button cancel = new Button(this);
        cancel.setText("Отмена");
        cancel.setOnClickListener(v -> { LoyaltyDiscountService.cancelPending(); finish(); });
        root.addView(cancel);
        setContentView(root);
    }

    private void quote() {
        String qr = qrInput.getText().toString().trim();
        if (qr.isEmpty()) {
            status.setText("Отсканируйте QR или введите код клиента");
            return;
        }
        if (receiptTotal <= 0d) {
            status.setText("Сумма текущего чека Эвотор не получена");
            return;
        }
        status.setText("Проверяем баланс клиента. Сумма чека: " + formatMoney(receiptTotal) + " ₽");
        // The production implementation will call the authenticated
        // /api/v1/evotor/app/customer endpoint and display level/limit here.
        status.setText("Сумма получена из кассы. Подключите backend quote endpoint для проверки QR.");
    }

    private void applyDiscount() {
        if (approvedDiscount <= 0d) { status.setText("Сначала проверьте клиента"); return; }
        LoyaltyDiscountService.finishWithDiscount(approvedDiscount);
        finish();
    }

    private static String formatMoney(double value) {
        return String.format(Locale.US, "%.2f", value);
    }

    @Override protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
