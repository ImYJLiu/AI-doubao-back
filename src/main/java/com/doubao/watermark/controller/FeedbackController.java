package com.doubao.watermark.controller;

import com.doubao.watermark.common.Result;
import com.doubao.watermark.model.dto.FeedbackRequest;
import com.doubao.watermark.mapper.TaskMapper;
import com.doubao.watermark.model.entity.Task;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final TaskMapper taskMapper;

    @PostMapping
    public Result<?> submit(@Valid @RequestBody FeedbackRequest request) {
        Task task = taskMapper.selectById(request.getTaskId());
        if (task != null) {
            task.setRating(request.getRating());
            taskMapper.updateById(task);
        }
        return Result.success();
    }
}
