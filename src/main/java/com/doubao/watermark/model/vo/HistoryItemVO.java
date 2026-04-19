package com.doubao.watermark.model.vo;

import lombok.Data;

@Data
public class HistoryItemVO {
    private Long taskId;
    private String thumbUrl;
    private String originalUrl;
    private String resultUrl;
    private String createdAt;
}
