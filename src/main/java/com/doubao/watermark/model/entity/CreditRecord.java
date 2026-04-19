package com.doubao.watermark.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("credit_record")
public class CreditRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /**
     * INIT_GIFT, DAILY_RESET, CONSUME, AD_REWARD, SHARE_REWARD, VIP_GRANT, TASK_REFUND
     */
    private String type;

    private Integer delta;

    private Integer balanceAfter;

    private Long relatedTaskId;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
