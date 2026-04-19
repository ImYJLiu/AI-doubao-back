package com.doubao.watermark.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "iopaint")
public class IOPaintConfig {

    private boolean enabled = true;

    private String endpoint = "http://localhost:8089";

    private String model = "lama";

    private int timeout = 60000;
}
