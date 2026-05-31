package com.doubao.watermark.config;

import cn.binarywang.wx.miniapp.api.WxMaService;
import cn.binarywang.wx.miniapp.api.impl.WxMaServiceHttpClientImpl;
import cn.binarywang.wx.miniapp.config.impl.WxMaDefaultConfigImpl;
import lombok.extern.slf4j.Slf4j;
import me.chanjar.weixin.common.util.http.apache.ApacheHttpClientBuilder;
import org.apache.http.client.HttpRequestRetryHandler;
import org.apache.http.conn.ConnectionKeepAliveStrategy;
import org.apache.http.conn.ssl.NoopHostnameVerifier;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.cert.X509Certificate;

@Slf4j
@Configuration
public class WxMaConfig {

    @Value("${wx.miniapp.appid}")
    private String appid;

    @Value("${wx.miniapp.secret}")
    private String secret;

    @Bean
    public WxMaService wxMaService() throws Exception {
        log.info("微信小程序配置初始化 - AppID: {}", appid);

        // 云托管容器 JVM 缺少微信服务器根证书，跳过 SSL 验证
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, new TrustManager[]{new X509TrustManager() {
            public void checkClientTrusted(X509Certificate[] chain, String authType) {}
            public void checkServerTrusted(X509Certificate[] chain, String authType) {}
            public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        }}, null);
        final CloseableHttpClient httpClient = HttpClients.custom()
                .setSSLSocketFactory(new SSLConnectionSocketFactory(sslContext, NoopHostnameVerifier.INSTANCE))
                .build();

        // 实现 ApacheHttpClientBuilder 接口，build() 直接返回我们的 client，绕开单例问题
        ApacheHttpClientBuilder clientBuilder = new ApacheHttpClientBuilder() {
            public CloseableHttpClient build() { return httpClient; }
            public ApacheHttpClientBuilder httpProxyHost(String s) { return this; }
            public ApacheHttpClientBuilder httpProxyPort(int i) { return this; }
            public ApacheHttpClientBuilder httpProxyUsername(String s) { return this; }
            public ApacheHttpClientBuilder httpProxyPassword(String s) { return this; }
            public ApacheHttpClientBuilder httpRequestRetryHandler(HttpRequestRetryHandler h) { return this; }
            public ApacheHttpClientBuilder keepAliveStrategy(ConnectionKeepAliveStrategy s) { return this; }
            public ApacheHttpClientBuilder sslConnectionSocketFactory(SSLConnectionSocketFactory f) { return this; }
        };

        WxMaDefaultConfigImpl config = new WxMaDefaultConfigImpl();
        config.setAppid(appid);
        config.setSecret(secret);
        config.setApacheHttpClientBuilder(clientBuilder);

        WxMaService service = new WxMaServiceHttpClientImpl();
        service.setWxMaConfig(config);
        log.info("微信 WxMaService 初始化完成（SSL 验证已跳过）");
        return service;
    }
}
