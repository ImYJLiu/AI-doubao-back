package com.doubao.watermark;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class WatermarkApplication {

    public static void main(String[] args) {
        SpringApplication.run(WatermarkApplication.class, args);
    }
}
