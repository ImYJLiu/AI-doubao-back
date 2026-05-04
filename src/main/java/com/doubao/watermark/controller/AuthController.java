package com.doubao.watermark.controller;

import com.doubao.watermark.common.Result;
import com.doubao.watermark.model.dto.LoginRequest;
import com.doubao.watermark.model.vo.LoginResponse;
import com.doubao.watermark.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${jwt.expiration}")
    private Long jwtExpiration;

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                       HttpServletResponse httpResponse) {
        LoginResponse response = authService.login(request.getCode());

        // 设置 token cookie，让 wx.uploadFile 自动携带（激活 AuthInterceptor 的 cookie 回退）
        Cookie cookie = new Cookie("token", response.getToken());
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(jwtExpiration.intValue());
        httpResponse.addCookie(cookie);

        return Result.success(response);
    }
}
