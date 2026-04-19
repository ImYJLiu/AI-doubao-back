package com.doubao.watermark.controller;

import com.doubao.watermark.common.Result;
import com.doubao.watermark.model.vo.CreditCheckVO;
import com.doubao.watermark.model.vo.CreditInfoVO;
import com.doubao.watermark.service.CreditService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/credits")
@RequiredArgsConstructor
public class CreditController {

    private final CreditService creditService;

    @GetMapping("/check")
    public Result<CreditCheckVO> check() {
        return Result.success(creditService.checkCredits());
    }

    @GetMapping("/info")
    public Result<CreditInfoVO> info() {
        return Result.success(creditService.getCreditsInfo());
    }

    @PostMapping("/ad-reward")
    public Result<?> adReward() {
        creditService.rewardAd();
        return Result.success();
    }

    @PostMapping("/share-reward")
    public Result<?> shareReward() {
        creditService.rewardShare();
        return Result.success();
    }
}
