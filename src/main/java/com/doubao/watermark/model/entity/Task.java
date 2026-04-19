package com.doubao.watermark.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("task")
public class Task {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long imageId;

    private String maskUrl;

    private String resultUrl;

    private String resultThumbnailUrl;

    /**
     * PENDING, PROCESSING, SUCCESS, FAILED
     */
    private String status;

    /**
     * PREVIEW=预览, CONFIRMED=正式
     */
    private String taskType;

    private String errorMessage;

    /**
     * SATISFIED, UNSATISFIED, null
     */
    private String rating;

    private String aiModel;

    private Long processDurationMs;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
