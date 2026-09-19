package ru.loyaltyflow.evotor;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Small authenticated client for the LoyaltyFlow Evotor API. */
final class LoyaltyApiClient {
    private LoyaltyApiClient() { }

    static JSONObject findCustomer(String qr, String phone, double receiptTotal, String receiptUuid) throws Exception {
        JSONObject body = new JSONObject();
        if (qr != null && !qr.isEmpty()) body.put("qr", qr);
        if (phone != null && !phone.isEmpty()) body.put("phone", phone);
        body.put("receiptTotal", receiptTotal);
        body.put("receiptUuid", receiptUuid == null ? "" : receiptUuid);
        return post("/api/v1/evotor/app/customer", body);
    }

    static JSONObject reserve(String customerId, String receiptUuid, String requestId, int amount, double receiptTotal) throws Exception {
        JSONObject body = new JSONObject();
        body.put("customerId", customerId);
        body.put("receiptUuid", receiptUuid);
        body.put("requestId", requestId);
        body.put("amount", amount);
        body.put("receiptTotal", receiptTotal);
        return post("/api/v1/evotor/app/discount/reserve", body);
    }

    static JSONObject commit(String reservationId, String receiptUuid) throws Exception {
        JSONObject body = new JSONObject();
        body.put("reservationId", reservationId);
        body.put("receiptUuid", receiptUuid);
        return post("/api/v1/evotor/app/discount/commit", body);
    }

    static JSONObject release(String reservationId, String receiptUuid) throws Exception {
        JSONObject body = new JSONObject();
        body.put("reservationId", reservationId);
        body.put("receiptUuid", receiptUuid);
        return post("/api/v1/evotor/app/discount/release", body);
    }

    private static JSONObject post(String path, JSONObject body) throws Exception {
        String base = BuildConfig.LOYALTYFLOW_BASE_URL;
        String token = BuildConfig.LOYALTYFLOW_APP_TOKEN;
        if (base == null || base.trim().isEmpty() || base.contains("CHANGE_ME")) {
            throw new IOException("В APK не настроен URL LoyaltyFlow API");
        }
        if (token == null || token.trim().isEmpty()) {
            throw new IOException("В APK не настроен токен Эвотор API");
        }

        HttpURLConnection connection = (HttpURLConnection) new URL(
                base.replaceAll("/+$", "") + path).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("X-Evotor-App-Token", token);
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(payload.length);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }

        int code = connection.getResponseCode();
        InputStream stream = code >= 200 && code < 300
                ? connection.getInputStream() : connection.getErrorStream();
        String response = read(stream);
        connection.disconnect();
        JSONObject json = response.isEmpty() ? new JSONObject() : new JSONObject(response);
        if (code < 200 || code >= 300) {
            throw new IOException(json.optString("error", "Ошибка LoyaltyFlow API"));
        }
        return json;
    }

    private static String read(InputStream stream) throws IOException {
        if (stream == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }
}
