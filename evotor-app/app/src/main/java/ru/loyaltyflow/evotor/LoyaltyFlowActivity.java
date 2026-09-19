package ru.loyaltyflow.evotor;

import android.app.Activity;
import android.os.Bundle;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native payment-screen flow for QR/phone loyalty lookup. */
public final class LoyaltyFlowActivity extends Activity {
    static final String EXTRA_FROM_PAYMENT = "from_payment";
    static final String EXTRA_RECEIPT_UUID = "receipt_uuid";
    static final String EXTRA_RECEIPT_TOTAL = "receipt_total";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private EditText qrInput, phoneInput, amountInput, discountInput;
    private TextView status;
    private String receiptUuid = "";
    private String customerId = "";
    private double receiptTotal;
    private int maxDiscount;
    private String reservationRequestId = UUID.randomUUID().toString();

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setTitle("LoyaltyFlow");
        receiptUuid = getIntent().getStringExtra(EXTRA_RECEIPT_UUID);
        if (receiptUuid == null) receiptUuid = "";
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

        discountInput = new EditText(this);
        discountInput.setHint("Списать бонусов, ₽");
        discountInput.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        discountInput.setSingleLine(true);
        discountInput.setEnabled(false);
        root.addView(discountInput);

        Button check = new Button(this);
        check.setText("Проверить клиента");
        check.setOnClickListener(v -> quote());
        root.addView(check);

        Button apply = new Button(this);
        apply.setText("Зарезервировать и применить скидку");
        apply.setOnClickListener(v -> reserveAndApply());
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

        status.setText("Ищем клиента и рассчитываем доступную скидку…");
        executor.execute(() -> {
            try {
                JSONObject response = LoyaltyApiClient.findCustomer(qr, phone, receiptTotal, receiptUuid);
                JSONObject customer = response.getJSONObject("customer");
                JSONObject quote = response.getJSONObject("quote");
                customerId = customer.getString("id");
                maxDiscount = quote.optInt("maxDiscount", 0);
                runOnUiThread(() -> {
                    discountInput.setEnabled(maxDiscount > 0);
                    discountInput.setText(maxDiscount > 0 ? String.valueOf(maxDiscount) : "0");
                    status.setText("Клиент найден. Баланс: " + customer.optInt("balance", 0)
                            + " ₽. Можно списать до " + maxDiscount + " ₽.");
                });
            } catch (Exception error) {
                runOnUiThread(() -> status.setText(error.getMessage() == null
                        ? "Не удалось проверить клиента" : error.getMessage()));
            }
        });
    }

    private void reserveAndApply() {
        if (customerId.isEmpty() || maxDiscount <= 0) {
            status.setText("Сначала проверьте клиента");
            return;
        }
        int amount;
        try {
            amount = Integer.parseInt(discountInput.getText().toString().trim());
        } catch (NumberFormatException error) {
            status.setText("Введите сумму бонусов целым числом");
            return;
        }
        if (amount <= 0 || amount > maxDiscount) {
            status.setText("Сумма должна быть от 1 до " + maxDiscount + " ₽");
            return;
        }

        status.setText("Резервируем бонусы…");
        executor.execute(() -> {
            try {
                JSONObject response = LoyaltyApiClient.reserve(customerId, receiptUuid, reservationRequestId, amount, receiptTotal);
                String reservationId = response.getString("reservationId");
                LoyaltyDiscountService.rememberReservation(this, receiptUuid, reservationId);
                runOnUiThread(() -> {
                    status.setText("Скидка применена к чеку. Завершите продажу в Эвотор.");
                    LoyaltyDiscountService.finishWithDiscount(amount);
                    finish();
                });
            } catch (Exception error) {
                runOnUiThread(() -> status.setText(error.getMessage() == null
                        ? "Не удалось зарезервировать бонусы" : error.getMessage()));
            }
        });
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
