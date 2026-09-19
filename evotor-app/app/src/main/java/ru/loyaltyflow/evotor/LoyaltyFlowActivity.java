package ru.loyaltyflow.evotor;

import android.app.Activity;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * First native payment-screen flow. Server-side quote/redeem endpoints are
 * intentionally required before production publishing.
 */
public final class LoyaltyFlowActivity extends Activity {
    static final String EXTRA_FROM_PAYMENT = "from_payment";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private EditText qrInput, amountInput;
    private TextView status;
    private double approvedDiscount = 0d;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setTitle("LoyaltyFlow");
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 32, 32, 32);

        TextView title = new TextView(this);
        title.setText("LoyaltyFlow\nБонусы клиента");
        title.setTextSize(24);
        root.addView(title);

        status = new TextView(this);
        status.setText("Отсканируйте QR клиента и проверьте баланс");
        root.addView(status);

        qrInput = new EditText(this);
        qrInput.setHint("QR или код клиента");
        qrInput.setSingleLine(true);
        root.addView(qrInput);

        amountInput = new EditText(this);
        amountInput.setHint("Сумма покупки, ₽");
        amountInput.setSingleLine(true);
        amountInput.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
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
        String total = amountInput.getText().toString().trim();
        if (qr.isEmpty() || total.isEmpty()) { status.setText("Введите QR и сумму покупки"); return; }
        status.setText("Проверяем баланс на сервере…");
        // The production implementation will call the authenticated
        // /api/v1/evotor/app/customer endpoint and display level/limit here.
        status.setText("Заготовка готова: подключите backend quote endpoint");
    }

    private void applyDiscount() {
        if (approvedDiscount <= 0d) { status.setText("Сначала проверьте клиента"); return; }
        LoyaltyDiscountService.finishWithDiscount(approvedDiscount);
        finish();
    }

    @Override protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
