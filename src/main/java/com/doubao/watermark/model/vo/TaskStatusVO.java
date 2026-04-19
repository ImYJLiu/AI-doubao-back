package com.doubao.watermark.model.vo;

import lombok.Data;

@Data
public class TaskStatusVO {
    private Long taskId;
    private String status;
    private Integer progress;
    private String resultUrl;
    private String errorMsg;
    private String taskType; // PREVIEW or CONFIRMED
}
