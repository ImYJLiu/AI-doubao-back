package com.doubao.watermark.service;

import cn.binarywang.wx.miniapp.api.WxMaService;
import cn.binarywang.wx.miniapp.bean.WxMaJscode2SessionResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.doubao.watermark.common.BusinessException;
import com.doubao.watermark.mapper.UserMapper;
import com.doubao.watermark.model.entity.User;
import com.doubao.watermark.model.vo.LoginResponse;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final WxMaService wxMaService;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private Long jwtExpiration;

    public LoginResponse login(String code) {
        try {
            // 打印接收到的code和配置的AppID
            String configuredAppId = wxMaService.getWxMaConfig().getAppid();
            log.info("收到登录请求 - AppID: {}, code: {}", configuredAppId, code);

            // 调用微信接口获取openid
            WxMaJscode2SessionResult session = wxMaService.getUserService().getSessionInfo(code);
            String openid = session.getOpenid();
            log.info("微信登录成功 - openid: {}", openid);

            // 查找或创建用户
            User user = userMapper.selectOne(
                    new LambdaQueryWrapper<User>().eq(User::getOpenid, openid)
            );

            boolean isNewUser = false;
            if (user == null) {
                isNewUser = true;
                user = new User();
                user.setOpenid(openid);
                user.setCredits(3);
                user.setIsVip(false);
                user.setDailyAdCount(0);
                user.setDailyShareCount(0);
                user.setLastResetDate(LocalDate.now());
                userMapper.insert(user);
            }

            // 每日重置
            resetDailyCreditsIfNeeded(user);

            // 生成JWT Token
            String token = generateToken(user.getId());

            LoginResponse response = new LoginResponse();
            response.setToken(token);
            response.setExpiresIn(jwtExpiration);
            response.setCredits(user.getCredits());
            response.setIsNewUser(isNewUser);
            response.setOpenid(openid);

            return response;
        } catch (Exception e) {
            log.error("登录失败 - AppID: {}, code: {}", wxMaService.getWxMaConfig().getAppid(), code, e);
            throw new BusinessException("登录失败: " + e.getMessage());
        }
    }

    private void resetDailyCreditsIfNeeded(User user) {
        LocalDate today = LocalDate.now();
        if (user.getLastResetDate() == null || user.getLastResetDate().isBefore(today)) {
            user.setCredits(3);
            user.setDailyAdCount(0);
            user.setDailyShareCount(0);
            user.setLastResetDate(today);
            userMapper.updateById(user);
        }
    }

    private String generateToken(Long userId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtExpiration * 1000);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("userId", userId)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }
}
