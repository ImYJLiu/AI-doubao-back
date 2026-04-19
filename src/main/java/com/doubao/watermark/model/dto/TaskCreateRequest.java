package com.doubao.watermark.model.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TaskCreateRequest {
    @NotNull(message = "imageId不能为空")
    private Long imageId;
}
