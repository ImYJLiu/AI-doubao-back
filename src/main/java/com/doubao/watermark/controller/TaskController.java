package com.doubao.watermark.controller;

import com.doubao.watermark.common.Result;
import com.doubao.watermark.model.vo.TaskStatusVO;
import com.doubao.watermark.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/task")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping("/create")
    public Result<TaskStatusVO> createTask(
            @RequestParam("imageId") Long imageId,
            @RequestParam("file") MultipartFile maskFile
    ) {
        TaskStatusVO vo = taskService.createTask(imageId, maskFile);
        return Result.success(vo);
    }

    /**
     * 创建预览任务（不扣积分）
     */
    @PostMapping("/preview")
    public Result<TaskStatusVO> createPreview(
            @RequestParam("imageId") Long imageId,
            @RequestParam("file") MultipartFile maskFile
    ) {
        TaskStatusVO vo = taskService.createPreviewTask(imageId, maskFile);
        return Result.success(vo);
    }

    /**
     * 确认预览任务（扣除积分）
     */
    @PostMapping("/{taskId}/confirm")
    public Result<TaskStatusVO> confirmTask(@PathVariable Long taskId) {
        TaskStatusVO vo = taskService.confirmTask(taskId);
        return Result.success(vo);
    }

    @GetMapping("/{taskId}/status")
    public Result<TaskStatusVO> getStatus(@PathVariable Long taskId) {
        TaskStatusVO vo = taskService.getTaskStatus(taskId);
        return Result.success(vo);
    }
}
