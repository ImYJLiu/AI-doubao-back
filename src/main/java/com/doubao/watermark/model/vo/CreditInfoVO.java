package com.doubao.watermark.model.vo;

import lombok.Data;

@Data
public class CreditInfoVO {
    private Integer credits;
    private Integer maxDaily;
    private Integer todayAdCount;
    private Integer todayShareCount;
    private Boolean isVip;
}
