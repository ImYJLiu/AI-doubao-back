package com.doubao.watermark.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.doubao.watermark.common.BusinessException;
import com.doubao.watermark.common.UserContext;
import com.doubao.watermark.mapper.TaskMapper;
import com.doubao.watermark.model.entity.Task;
import com.doubao.watermark.model.vo.HistoryItemVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class HistoryService {

    private final TaskMapper taskMapper;

    public List<HistoryItemVO> getHistory(int page, int size, String period) {
        Long userId = UserContext.getUserId();

        LambdaQueryWrapper<Task> query = new LambdaQueryWrapper<Task>()
                .eq(Task::getUserId, userId)
                .eq(Task::getStatus, "SUCCESS")
                .orderByDesc(Task::getCreatedAt)
                .last("LIMIT " + ((page - 1) * size) + ", " + size);

        // 时间过滤
        if ("week".equals(period)) {
            query.ge(Task::getCreatedAt, java.time.LocalDateTime.now().minusWeeks(1));
        } else if ("earlier".equals(period)) {
            query.lt(Task::getCreatedAt, java.time.LocalDateTime.now().minusWeeks(1));
        }

        List<Task> tasks = taskMapper.selectList(query);

        return tasks.stream().map(task -> {
            HistoryItemVO vo = new HistoryItemVO();
            vo.setTaskId(task.getId());
            vo.setThumbUrl(task.getResultThumbnailUrl() != null ? task.getResultThumbnailUrl() : task.getResultUrl());
            vo.setResultUrl(task.getResultUrl());
            vo.setCreatedAt(task.getCreatedAt().toString().substring(0, 10));
            return vo;
        }).collect(Collectors.toList());
    }

    public void deleteTask(Long taskId) {
        Long userId = UserContext.getUserId();
        Task task = taskMapper.selectById(taskId);

        if (task == null || !task.getUserId().equals(userId)) {
            throw new BusinessException("任务不存在或无权删除");
        }

        taskMapper.deleteById(taskId);
    }

    public int batchDelete(List<Long> taskIds) {
        Long userId = UserContext.getUserId();

        // 先批量查询验证所有 taskId 属于当前用户
        List<Task> tasks = taskMapper.selectBatchIds(taskIds);
        for (Task task : tasks) {
            if (!task.getUserId().equals(userId)) {
                throw new BusinessException("无权删除其他用户的任务");
            }
        }

        // 验证通过后批量删除
        int count = taskMapper.deleteBatchIds(taskIds);
        log.info("批量删除任务: userId={}, count={}", userId, count);
        return count;
    }
}
