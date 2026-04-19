package com.doubao.watermark.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.doubao.watermark.common.BusinessException;
import com.doubao.watermark.common.UserContext;
import com.doubao.watermark.mapper.CreditRecordMapper;
import com.doubao.watermark.mapper.UserMapper;
import com.doubao.watermark.model.entity.CreditRecord;
import com.doubao.watermark.model.entity.User;
import com.doubao.watermark.model.vo.CreditCheckVO;
import com.doubao.watermark.model.vo.CreditInfoVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreditService {

    private final UserMapper userMapper;
    private final CreditRecordMapper creditRecordMapper;

    /**
     * 校验是否有足够次数（进入编辑页前调用）
     */
    public CreditCheckVO checkCredits() {
        Long userId = UserContext.getUserId();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        resetDailyCreditsIfNeeded(user);
        // 重新读取，因为 resetDailyCreditsIfNeeded 可能更新了数据库
        user = userMapper.selectById(userId);
        CreditCheckVO vo = new CreditCheckVO();
        vo.setSufficient(user.getCredits() > 0);
        vo.setCredits(user.getCredits());
        return vo;
    }

    /**
     * 获取次数信息
     */
    public CreditInfoVO getCreditsInfo() {
        Long userId = UserContext.getUserId();
        User user = userMapper.selectById(userId);

        if (user == null) {
            throw new BusinessException("用户不存在");
        }

        // 每日重置
        resetDailyCreditsIfNeeded(user);

        CreditInfoVO vo = new CreditInfoVO();
        vo.setCredits(user.getCredits());
        vo.setMaxDaily(3);
        vo.setTodayAdCount(user.getDailyAdCount());
        vo.setTodayShareCount(user.getDailyShareCount());
        vo.setIsVip(user.getIsVip());
        return vo;
    }

    /**
     * 消费次数（悲观锁）
     */
    @Transactional
    public void consumeCredit(Long taskId) {
        Long userId = UserContext.getUserId();

        // 悲观锁扣减：UPDATE user SET credits = credits - 1 WHERE id = ? AND credits > 0
        int affected = userMapper.consumeCredit(userId);
        if (affected == 0) {
            throw new BusinessException("次数不足");
        }

        // 记录
        User user = userMapper.selectById(userId);
        recordCredit(userId, "CONSUME", -1, user.getCredits(), taskId, "去水印任务消费");
    }

    /**
     * 退还次数（任务失败时）
     */
    @Transactional
    public void refundCredit(Long taskId) {
        Long userId = UserContext.getUserId();
        userMapper.refundCredit(userId);

        User user = userMapper.selectById(userId);
        recordCredit(userId, "TASK_REFUND", 1, user.getCredits(), taskId, "任务失败退还");
    }

    /**
     * 广告奖励（防并发：检查条件下沉到 SQL WHERE）
     */
    @Transactional
    public void rewardAd() {
        Long userId = UserContext.getUserId();

        // 直接执行 UPDATE，WHERE 条件包含 daily_ad_count < 5
        int affected = userMapper.addAdCountAndCredits(userId);
        if (affected == 0) {
            throw new BusinessException("今日广告次数已上限");
        }

        User user = userMapper.selectById(userId);
        recordCredit(userId, "AD_REWARD", 3, user.getCredits(), null, "观看广告奖励");
    }

    /**
     * 分享奖励（防并发：检查条件下沉到 SQL WHERE）
     */
    @Transactional
    public void rewardShare() {
        Long userId = UserContext.getUserId();

        // 直接执行 UPDATE，WHERE 条件包含 daily_share_count < 2
        int affected = userMapper.addShareCountAndCredits(userId);
        if (affected == 0) {
            throw new BusinessException("今日分享次数已上限");
        }

        User user = userMapper.selectById(userId);
        recordCredit(userId, "SHARE_REWARD", 2, user.getCredits(), null, "分享好友奖励");
    }

    /**
     * 退还次数（不依赖 ThreadLocal，直接传 userId）
     */
    public void refundCreditInternal(Long userId, Long taskId) {
        userMapper.refundCredit(userId);

        User user = userMapper.selectById(userId);
        recordCredit(userId, "TASK_REFUND", 1, user.getCredits(), taskId, "任务失败退还");
    }

    private void resetDailyCreditsIfNeeded(User user) {
        LocalDate today = LocalDate.now();
        if (user.getLastResetDate() == null || user.getLastResetDate().isBefore(today)) {
            userMapper.resetDailyCredits(user.getId());
        }
    }

    private void recordCredit(Long userId, String type, int delta, int balanceAfter, Long taskId, String remark) {
        CreditRecord record = new CreditRecord();
        record.setUserId(userId);
        record.setType(type);
        record.setDelta(delta);
        record.setBalanceAfter(balanceAfter);
        record.setRelatedTaskId(taskId);
        record.setRemark(remark);
        record.setCreatedAt(LocalDateTime.now());
        creditRecordMapper.insert(record);
    }
}
