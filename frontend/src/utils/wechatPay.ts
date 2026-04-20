/**
 * 微信支付工具
 * 用于在微信浏览器中调起微信支付
 */

/**
 * JSAPI 调起支付参数
 */
export interface WechatPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;  // 格式: prepay_id=xxx
  signType: 'RSA';
  paySign: string;
}

/**
 * JSAPI 支付结果
 */
export type WechatPayResult = 'success' | 'cancel' | 'fail';

/**
 * 在微信浏览器中调起 JSAPI 支付
 * 使用 WeixinJSBridge 方式
 *
 * @param payParams 从后端获取的支付参数
 * @returns Promise<WechatPayResult> 支付结果
 *
 * @example
 * ```typescript
 * // 1. 从后端获取支付参数
 * const response = await api.createJsapiPayment(orderId);
 * const payParams = response.payParams;
 *
 * // 2. 调起支付
 * const result = await invokeWechatJsapiPay(payParams);
 *
 * // 3. 处理结果
 * if (result === 'success') {
 *   // 支付成功，但需要后端确认
 *   await checkPaymentStatus(orderId);
 * } else if (result === 'cancel') {
 *   // 用户取消支付
 * } else {
 *   // 支付失败
 * }
 * ```
 */
export function invokeWechatJsapiPay(payParams: WechatPayParams): Promise<WechatPayResult> {
  return new Promise((resolve, reject) => {
    // 检查是否在微信浏览器中
    if (!isWechatBrowser()) {
      reject(new Error('请在微信浏览器中打开'));
      return;
    }

    const onBridgeReady = () => {
      (globalThis as any).WeixinJSBridge.invoke(
        'getBrandWCPayRequest',
        {
          appId: payParams.appId,
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType,
          paySign: payParams.paySign,
        },
        (res: any) => {
          if (res.err_msg === 'get_brand_wcpay_request:ok') {
            // 用户点击了支付成功
            // 注意：这并不保证支付真的成功，需要后端查单确认
            resolve('success');
          } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
            // 用户取消支付
            resolve('cancel');
          } else {
            // 支付失败
            console.error('[WechatPay] 支付失败:', res);
            resolve('fail');
          }
        }
      );
    };

    if (typeof (globalThis as any).WeixinJSBridge === 'undefined') {
      if (document.addEventListener) {
        document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
      } else {
        // 兼容旧版本 IE
        (document as any).attachEvent('onWeixinJSBridgeReady', onBridgeReady);
      }
    } else {
      onBridgeReady();
    }
  });
}

/**
 * 检查是否在微信浏览器中
 */
export function isWechatBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
}

/**
 * 获取微信环境信息
 */
export function getWechatEnv(): 'wechat' | 'miniprogram' | 'other' {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('miniprogram')) {
    return 'miniprogram';
  } else if (ua.includes('micromessenger')) {
    return 'wechat';
  }

  return 'other';
}

/**
 * 小程序支付（使用 wx.requestPayment）
 * 仅在小程序环境中可用
 *
 * @param payParams 从后端获取的支付参数
 * @returns Promise<WechatPayResult> 支付结果
 */
export function invokeMiniProgramPay(payParams: WechatPayParams): Promise<WechatPayResult> {
  return new Promise((resolve, reject) => {
    const wx = (globalThis as any).wx;

    if (!wx?.requestPayment) {
      reject(new Error('请在小程序环境中使用'));
      return;
    }

    wx.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
      success: () => {
        resolve('success');
      },
      fail: (err: any) => {
        if (err.errMsg.includes('cancel')) {
          resolve('cancel');
        } else {
          console.error('[WechatPay] 小程序支付失败:', err);
          resolve('fail');
        }
      },
    });
  });
}

/**
 * 统一支付入口
 * 自动判断环境并调用对应的支付方式
 *
 * @param payParams 从后端获取的支付参数
 * @returns Promise<WechatPayResult> 支付结果
 */
export async function invokeWechatPay(payParams: WechatPayParams): Promise<WechatPayResult> {
  const env = getWechatEnv();

  switch (env) {
    case 'miniprogram':
      return invokeMiniProgramPay(payParams);
    case 'wechat':
      return invokeWechatJsapiPay(payParams);
    default:
      throw new Error('当前环境不支持微信支付，请在微信或小程序中打开');
  }
}

/**
 * 支付状态轮询检查
 * 用于确认支付是否真的成功
 *
 * @param checkFn 检查函数，返回 true 表示支付成功
 * @param options 轮询选项
 * @returns Promise<boolean> 是否支付成功
 */
export async function pollPaymentStatus(
  checkFn: () => Promise<boolean>,
  options: {
    maxAttempts?: number;   // 最大尝试次数，默认 10
    interval?: number;      // 轮询间隔（毫秒），默认 2000
  } = {}
): Promise<boolean> {
  const { maxAttempts = 10, interval = 2000 } = options;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const isSuccess = await checkFn();
      if (isSuccess) {
        return true;
      }
    } catch (error) {
      console.error('[WechatPay] 检查支付状态失败:', error);
    }

    // 等待下一次轮询
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}
