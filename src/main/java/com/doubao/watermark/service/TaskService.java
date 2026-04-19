package com.doubao.watermark.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.doubao.watermark.common.BusinessException;
import com.doubao.watermark.common.UserContext;
import com.doubao.watermark.mapper.TaskMapper;
import com.doubao.watermark.model.entity.Task;
import com.doubao.watermark.model.vo.TaskStatusVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskMapper taskMapper;
    private final CreditService creditService;
    private final InpaintService inpaintService;
    private final StorageService storageService;

    /**
     * 创建去水印任务
     */
    @Transactional
    public TaskStatusVO createTask(Long imageId, MultipartFile maskFile) {
        Long userId = UserContext.getUserId();

        // 1. 上传蒙版文件到本地存储
        String maskUrl = storageService.uploadFile(maskFile, "masks");

        // 2. 创建任务记录
        Task task = new Task();
        task.setUserId(userId);
        task.setImageId(imageId);
        task.setMaskUrl(maskUrl);
        task.setStatus("PENDING");
        task.setTaskType("CONFIRMED");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.insert(task);

        Long taskId = task.getId();

        // 3. 任务创建成功后扣减次数
        creditService.consumeCredit(taskId);

        // 4. 事务提交后启动异步处理
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                processTaskAsync(taskId, userId);
            }
        });

        // 5. 返回
        return buildTaskStatusVO(task);
    }

    /**
     * 创建预览任务（同步调用 AI 处理，不扣积分）
     */
    public TaskStatusVO createPreviewTask(Long imageId, MultipartFile maskFile) {
        Long userId = UserContext.getUserId();

        // 1. 上传蒙版文件到本地存储
        String maskUrl = storageService.uploadFile(maskFile, "masks");

        // 2. 同步调用 AI 去水印（阻塞等待结果，最长 60s）
        LocalDateTime startTime = LocalDateTime.now();
        String resultUrl = inpaintService.inpaint(imageId, maskUrl);
        long duration = java.time.Duration.between(startTime, LocalDateTime.now()).toMillis();

        // 3. 处理成功后创建 Task 记录（status=SUCCESS）
        Task task = new Task();
        task.setUserId(userId);
        task.setImageId(imageId);
        task.setMaskUrl(maskUrl);
        task.setResultUrl(resultUrl);
        task.setResultThumbnailUrl(resultUrl);
        task.setStatus("SUCCESS");
        task.setTaskType("PREVIEW");
        task.setAiModel("iopaint-lama");
        task.setProcessDurationMs(duration);
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.insert(task);

        log.info("同步预览完成: taskId={}, userId={}, imageId={}, duration={}ms", task.getId(), userId, imageId, duration);
        return buildTaskStatusVO(task);
    }

    /**
     * 确认预览任务（扣除积分）
     */
    @Transactional
    public TaskStatusVO confirmTask(Long taskId) {
        Long userId = UserContext.getUserId();

        Task task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }

        if (!task.getUserId().equals(userId)) {
            throw new BusinessException("无权操作此任务");
        }

        if (!"PREVIEW".equals(task.getTaskType())) {
            throw new BusinessException("只能确认预览任务");
        }

        if (!"SUCCESS".equals(task.getStatus())) {
            throw new BusinessException("预览尚未完成");
        }

        // 扣除积分
        creditService.consumeCredit(taskId);

        // 更新任务类型为 CONFIRMED
        task.setTaskType("CONFIRMED");
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);

        log.info("确认预览任务: taskId={}, userId={}, status={}", taskId, userId, task.getStatus());
        return buildTaskStatusVO(task);
    }

    /**
     * 查询任务状态
     */
    public TaskStatusVO getTaskStatus(Long taskId) {
        Task task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BusinessException("任务不存在");
        }

        return buildTaskStatusVO(task);
    }

    /**
     * 构建 TaskStatusVO
     */
    private TaskStatusVO buildTaskStatusVO(Task task) {
        TaskStatusVO vo = new TaskStatusVO();
        vo.setTaskId(task.getId());
        vo.setStatus(task.getStatus());
        vo.setResultUrl(task.getResultUrl());
        vo.setErrorMsg(task.getErrorMessage());
        vo.setProgress(calculateProgress(task.getStatus()));
        vo.setTaskType(task.getTaskType());
        return vo;
    }

    /**
     * 异步处理任务（不依赖 ThreadLocal）
     */
    @Async
    public void processTaskAsync(Long taskId, Long userId) {
        Task task = taskMapper.selectById(taskId);
        if (task == null) {
            return;
        }

        try {
            LocalDateTime startTime = LocalDateTime.now();

            // 更新状态为处理中
            task.setStatus("PROCESSING");
            task.setUpdatedAt(LocalDateTime.now());
            taskMapper.updateById(task);

            // 调用 AI 处理
            String resultUrl = inpaintService.inpaint(task.getImageId(), task.getMaskUrl());

            long duration = java.time.Duration.between(startTime, LocalDateTime.now()).toMillis();

            // 更新成功
            task.setStatus("SUCCESS");
            task.setResultUrl(resultUrl);
            task.setResultThumbnailUrl(resultUrl);
            task.setAiModel("iopaint-lama");
            task.setProcessDurationMs(duration);
            task.setUpdatedAt(LocalDateTime.now());
            taskMapper.updateById(task);

            log.info("任务处理完成: taskId={}, duration={}ms", taskId, duration);

        } catch (Exception e) {
            log.error("任务处理失败: taskId={}", taskId, e);
            task.setStatus("FAILED");
            task.setErrorMessage(e.getMessage());
            task.setUpdatedAt(LocalDateTime.now());
            taskMapper.updateById(task);

            // 退还次数（直接传 userId，不依赖 ThreadLocal）
            try {
                creditService.refundCreditInternal(userId, taskId);
            } catch (Exception refundEx) {
                log.error("退还次数失败: userId={}, taskId={}", userId, taskId, refundEx);
            }
        }
    }

    private int calculateProgress(String status) {
        return switch (status) {
            case "PENDING" -> 0;
            case "PROCESSING" -> 50;
            case "SUCCESS" -> 100;
            case "FAILED" -> -1;
            default -> 0;
        };
    }
}
