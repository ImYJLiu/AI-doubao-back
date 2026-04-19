package com.doubao.watermark.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("image")
public class Image {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String originalUrl;

    private String thumbnailUrl;

    private Long fileSize;

    private Integer width;

    private Integer height;

    private String format;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
