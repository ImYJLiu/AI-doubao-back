package com.doubao.watermark.config;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * IOPaint 进程管理器
 * 在 Spring Boot 启动完成后自动拉起 IOPaint 子进程，
 * 解决腾讯云托管平台绕过 ENTRYPOINT 导致 IOPaint 未启动的问题。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IOPaintProcessManager {

    private final IOPaintConfig config;
    private Process iopaintProcess;

    @EventListener(ApplicationReadyEvent.class)
    public void startIOPaint() {
        if (!config.isEnabled()) {
            log.info("IOPaint 服务未启用，跳过启动");
            return;
        }

        // 检查 IOPaint 是否已经在运行（比如通过 start.sh 启动的场景）
        if (isIOPaintRunning()) {
            log.info("IOPaint 服务已在运行，无需重复启动");
            return;
        }

        log.info("正在启动 IOPaint 子进程...");

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "/app/iopaint-env/bin/iopaint",
                    "start",
                    "--model=" + config.getModel(),
                    "--device=cpu",
                    "--port=8089",
                    "--host=0.0.0.0"
            );
            pb.redirectErrorStream(true);
            pb.environment().put("PATH", "/app/iopaint-env/bin:" + System.getenv("PATH"));

            iopaintProcess = pb.start();

            // 异步读取 IOPaint 日志输出
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(iopaintProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.info("[IOPaint] {}", line);
                    }
                } catch (Exception e) {
                    // 进程结束时正常退出
                }
            }, "iopaint-log-reader").start();

            // 等待 IOPaint 就绪（最多等 30 秒）
            waitForReady(30);

        } catch (Exception e) {
            log.error("启动 IOPaint 子进程失败: {}", e.getMessage());
            log.error("请确认 /app/iopaint-env/bin/iopaint 存在且可执行");
        }
    }

    @PreDestroy
    public void stopIOPaint() {
        if (iopaintProcess != null && iopaintProcess.isAlive()) {
            log.info("正在停止 IOPaint 子进程...");
            iopaintProcess.destroy();
            try {
                iopaintProcess.waitFor(java.util.concurrent.TimeUnit.SECONDS.toMillis(5),
                        java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                iopaintProcess.destroyForcibly();
            }
            log.info("IOPaint 子进程已停止");
        }
    }

    private void waitForReady(int maxSeconds) {
        for (int i = 0; i < maxSeconds; i++) {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }

            if (isIOPaintRunning()) {
                log.info("IOPaint 服务已就绪（等待了 {}s）", i + 1);
                return;
            }

            // 检查进程是否意外退出
            if (!iopaintProcess.isAlive()) {
                log.error("IOPaint 进程已退出，退出码: {}", iopaintProcess.exitValue());
                return;
            }
        }
        log.warn("IOPaint 服务在 {}s 内未就绪，Java 应用继续运行（首次请求时可能会触发模型下载）", maxSeconds);
    }

    private boolean isIOPaintRunning() {
        try {
            URL url = new URL(config.getEndpoint());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(2000);
            conn.setReadTimeout(2000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            conn.disconnect();
            return code >= 200 && code < 500;
        } catch (Exception e) {
            return false;
        }
    }
}
