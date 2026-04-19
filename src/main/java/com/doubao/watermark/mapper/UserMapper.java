package com.doubao.watermark.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.doubao.watermark.model.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    int consumeCredit(@Param("userId") Long userId);

    int refundCredit(@Param("userId") Long userId);

    int addAdCountAndCredits(@Param("userId") Long userId);

    int addShareCountAndCredits(@Param("userId") Long userId);

    int resetDailyCredits(@Param("userId") Long userId);
}
