package com.doubao.watermark;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

import javax.net.ssl.*;
import java.security.cert.X509Certificate;

@Slf4j
@SpringBootApplication
@EnableAsync
public class WatermarkApplication {

    public static void main(String[] args) {
        // 全局跳过 SSL 验证（云托管容器 JVM 缺少微信服务器根证书）
        disableSslVerification();
        SpringApplication.run(WatermarkApplication.class, args);
    }

    private static void disableSslVerification() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return null; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
            log.info("全局 SSL 验证已禁用");
        } catch (Exception e) {
            log.warn("禁用 SSL 验证失败: {}", e.getMessage());
        }
    }
}
