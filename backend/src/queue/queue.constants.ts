/**
 * BullMQ 队列名称常量
 */
export const QUEUE_NAMES = {
  // 通知队列 - 低优先级，异步发送
  NOTIFICATION: 'notification',

  // 退款处理队列 - 高优先级
  REFUND_PROCESS: 'refund-process',

  // 延迟任务队列 - 订单自动取消、买断超时取消
  DELAYED_TASKS: 'delayed-tasks',
} as const;

/**
 * 作业名称
 */
export const JOB_NAMES = {
  // 通知队列作业
  SEND_SMS: 'send-sms',
  SEND_WECHAT_TEMPLATE: 'send-wechat-template',
  CREATE_IN_APP_NOTIFICATION: 'create-in-app-notification',

  // 退款队列作业
  EXECUTE_REFUND: 'execute-refund',

  // 延迟任务作业
  ORDER_AUTO_CANCEL: 'order-auto-cancel',
  REDEMPTION_AUTO_CANCEL: 'redemption-auto-cancel',
} as const;

/**
 * 队列配置
 */
export const QUEUE_CONFIG = {
  [QUEUE_NAMES.NOTIFICATION]: {
    // 通知队列：低优先级，允许失败
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },

  [QUEUE_NAMES.REFUND_PROCESS]: {
    // 退款队列：高优先级，必须成功
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s, 16s, 32s
      },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  },

  [QUEUE_NAMES.DELAYED_TASKS]: {
    // 延迟任务：执行一次，失败不重试（由业务逻辑决定）
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  },
} as const;
