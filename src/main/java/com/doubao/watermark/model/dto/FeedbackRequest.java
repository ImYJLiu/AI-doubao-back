package com.doubao.watermark.model.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FeedbackRequest {
    @NotNull(message = "taskId不能为空")
    private Long taskId;

    /**
     * SATISFIED, UNSATISFIED
     */
    @NotNull(message = "rating不能为空")
    private String rating;
}
