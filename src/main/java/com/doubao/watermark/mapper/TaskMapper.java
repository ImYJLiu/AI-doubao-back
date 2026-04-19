package com.doubao.watermark.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.doubao.watermark.model.entity.Task;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TaskMapper extends BaseMapper<Task> {
}
