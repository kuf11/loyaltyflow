package ru.loyaltyflow.evotor;

import android.app.Activity;
import android.os.Bundle;
import android.text.InputType;
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
    private EditText qrInput, phoneInput, amountInput;
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
                ? "Сумма чека получена из Эвотор. Выберите способ поиска клиента."
                : "Не удалось получить сумму текущего чека Эвотор.");
        root.addView(status);

        TextView lookupLabel = new TextView(this);
        lookupLabel.setText("Клиент: QR-код или номер телефона");
        root.addView(lookupLabel);

        qrInput = new EditText(this);
        qrInput.setHint("QR-код клиента");
        qrInput.setSingleLine(true);
        root.addView(qrInput);

        phoneInput = new EditText(this);
        phoneInput.setHint("Номер телефона, например +7 900 000-00-00");
        phoneInput.setInputType(InputType.TYPE_CLASS_PHONE);
        phoneInput.setSingleLine(true);
        root.addView(phoneInput);

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
        String phone = normalizePhone(phoneInput.getText().toString());
        if (qr.isEmpty() && phone.isEmpty()) {
            status.setText("Покажите QR клиента или введите номер телефона");
            return;
        }
        if (!qr.isEmpty() && !phone.isEmpty()) {
            status.setText("Выберите только один способ поиска клиента");
            return;
        }
        if (!phone.isEmpty() && !phone.matches("^\\+?[0-9]{10,15}$")) {
            status.setText("Проверьте номер телефона");
            return;
        }
        if (receiptTotal <= 0d) {
            status.setText("Сумма текущего чека Эвотор не получена");
            return;
        }

        String method = qr.isEmpty() ? "по номеру телефона" : "по QR-коду";
        // The production implementation will call the authenticated
        // /api/v1/evotor/app/customer endpoint and display level/limit here.
        status.setText("Сумма из кассы: " + formatMoney(receiptTotal)
                + " ₽. Ищем клиента " + method
                + ". Подключите backend quote endpoint.");
    }

    private void applyDiscount() {
        if (approvedDiscount <= 0d) { status.setText("Сначала проверьте клиента"); return; }
        LoyaltyDiscountService.finishWithDiscount(approvedDiscount);
        finish();
    }

    private static String normalizePhone(String value) {
        return value == null ? "" : value.replaceAll("[^0-9+]", "");
    }

    private static String formatMoney(double value) {
        return String.format(Locale.US, "%.2f", value);
    }

    @Override protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
