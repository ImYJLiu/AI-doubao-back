package com.doubao.watermark.model.vo;

import lombok.Data;

@Data
public class LoginResponse {
    private String token;
    private Long expiresIn;
    private Integer credits;
    private Boolean isNewUser;
    private String openid;
}
