import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Card, Input, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { SystemConfig } from '../../../types';
import { SensitiveTextarea } from './admin-utils';

export const AdminConfig: React.FC = () => {
  const toast = useToast();
  const [_configs, setConfigs] = useState<SystemConfig[]>([]); // configs 用于内部状态管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'payment' | 'sms' | 'wechat'>('basic');

  // 配置表单
  const [basicConfig, setBasicConfig] = useState({
    siteName: '',
    siteTitle: '',
    siteDescription: '',
    siteKeywords: '',
    contactPhone: '',
    contactEmail: '',
    contactWechat: '',
  });

  const [paymentConfig, setPaymentConfig] = useState({
    alipayEnabled: true,
    wechatEnabled: true,
    alipayAppId: '',
    alipayPrivateKey: '',
    alipayPublicKey: '',
    alipayNotifyUrl: '',
    alipayReturnUrl: '',
    wechatAppId: '',
    wechatMchId: '',
    wechatPayKey: '',
    wechatApiV3Key: '',
    wechatSerialNo: '',
    wechatPrivateKey: '',
    wechatNotifyUrl: '',
  });

  const [smsConfig, setSmsConfig] = useState({
    aliyunAccessKeyId: '',
    aliyunAccessKeySecret: '',
    aliyunSignName: '',
    // 短信模板
    smsTemplateLogin: '',        // 登录验证码
    smsTemplateRegister: '',     // 注册验证码
    smsTemplateResetPassword: '',// 找回密码验证码
    smsTemplateOrder: '',        // 订单通知
    smsTemplateFeedBill: '',     // 饲料费通知
  });

  const [wechatTemplateConfig, setWechatTemplateConfig] = useState({
    adoptionSuccess: '',      // 领养成功通知
    feedBill: '',             // 饲料费账单
    feedBillOverdue: '',      // 饲料费逾期
    redemptionAudit: '',      // 买断审核
    redemptionSuccess: '',    // 买断成功
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  // 配置键到设置函数的映射
  const configKeyMap = {
    // 基础配置
    site_name: (v: string) => setBasicConfig(prev => ({ ...prev, siteName: v })),
    site_title: (v: string) => setBasicConfig(prev => ({ ...prev, siteTitle: v })),
    site_description: (v: string) => setBasicConfig(prev => ({ ...prev, siteDescription: v })),
    site_keywords: (v: string) => setBasicConfig(prev => ({ ...prev, siteKeywords: v })),
    contact_phone: (v: string) => setBasicConfig(prev => ({ ...prev, contactPhone: v })),
    contact_email: (v: string) => setBasicConfig(prev => ({ ...prev, contactEmail: v })),
    contact_wechat: (v: string) => setBasicConfig(prev => ({ ...prev, contactWechat: v })),
    // 支付配置 - 布尔值
    payment_alipay_enabled: (v: string) => setPaymentConfig(prev => ({ ...prev, alipayEnabled: v === 'true' })),
    payment_wechat_enabled: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatEnabled: v === 'true' })),
    // 支付配置 - 支付宝
    alipay_app_id: (v: string) => setPaymentConfig(prev => ({ ...prev, alipayAppId: v })),
    alipay_private_key: (v: string) => setPaymentConfig(prev => ({ ...prev, alipayPrivateKey: v })),
    alipay_public_key: (v: string) => setPaymentConfig(prev => ({ ...prev, alipayPublicKey: v })),
    alipay_notify_url: (v: string) => setPaymentConfig(prev => ({ ...prev, alipayNotifyUrl: v })),
    alipay_return_url: (v: string) => setPaymentConfig(prev => ({ ...prev, alipayReturnUrl: v })),
    // 支付配置 - 微信
    wechat_app_id: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatAppId: v })),
    wechat_mch_id: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatMchId: v })),
    wechat_pay_key: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatPayKey: v })),
    wechat_api_v3_key: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatApiV3Key: v })),
    wechat_serial_no: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatSerialNo: v })),
    wechat_private_key: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatPrivateKey: v })),
    wechat_notify_url: (v: string) => setPaymentConfig(prev => ({ ...prev, wechatNotifyUrl: v })),
    // 短信配置
    aliyun_access_key_id: (v: string) => setSmsConfig(prev => ({ ...prev, aliyunAccessKeyId: v })),
    aliyun_access_key_secret: (v: string) => setSmsConfig(prev => ({ ...prev, aliyunAccessKeySecret: v })),
    aliyun_sign_name: (v: string) => setSmsConfig(prev => ({ ...prev, aliyunSignName: v })),
    sms_template_login: (v: string) => setSmsConfig(prev => ({ ...prev, smsTemplateLogin: v })),
    sms_template_register: (v: string) => setSmsConfig(prev => ({ ...prev, smsTemplateRegister: v })),
    sms_template_reset_password: (v: string) => setSmsConfig(prev => ({ ...prev, smsTemplateResetPassword: v })),
    sms_template_order: (v: string) => setSmsConfig(prev => ({ ...prev, smsTemplateOrder: v })),
    sms_template_feed_bill: (v: string) => setSmsConfig(prev => ({ ...prev, smsTemplateFeedBill: v })),
    // 微信模板配置
    wechat_template_adoption_success: (v: string) => setWechatTemplateConfig(prev => ({ ...prev, adoptionSuccess: v })),
    wechat_template_feed_bill: (v: string) => setWechatTemplateConfig(prev => ({ ...prev, feedBill: v })),
    wechat_template_feed_bill_overdue: (v: string) => setWechatTemplateConfig(prev => ({ ...prev, feedBillOverdue: v })),
    wechat_template_redemption_audit: (v: string) => setWechatTemplateConfig(prev => ({ ...prev, redemptionAudit: v })),
    wechat_template_redemption_success: (v: string) => setWechatTemplateConfig(prev => ({ ...prev, redemptionSuccess: v })),
  } as const;

  const loadConfigs = async () => {
    try {
      const res = await adminApi.getConfigs();
      setConfigs(res);

      // 使用映射表解析配置
      res.forEach((config: SystemConfig) => {
        const value = config.configValue || '';
        const setter = configKeyMap[config.configKey as keyof typeof configKeyMap];
        if (setter) setter(value);
      });
    } catch (error) {
      console.error('加载配置失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasic = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('site_name', basicConfig.siteName),
        adminApi.updateConfig('site_title', basicConfig.siteTitle),
        adminApi.updateConfig('site_description', basicConfig.siteDescription),
        adminApi.updateConfig('site_keywords', basicConfig.siteKeywords),
        adminApi.updateConfig('contact_phone', basicConfig.contactPhone),
        adminApi.updateConfig('contact_email', basicConfig.contactEmail),
        adminApi.updateConfig('contact_wechat', basicConfig.contactWechat),
      ]);
      toast.success('保存成功');
      // 保存成功后重新加载配置
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('payment_alipay_enabled', paymentConfig.alipayEnabled ? 'true' : 'false'),
        adminApi.updateConfig('payment_wechat_enabled', paymentConfig.wechatEnabled ? 'true' : 'false'),
        adminApi.updateConfig('alipay_app_id', paymentConfig.alipayAppId),
        adminApi.updateConfig('alipay_private_key', paymentConfig.alipayPrivateKey),
        adminApi.updateConfig('alipay_public_key', paymentConfig.alipayPublicKey),
        adminApi.updateConfig('alipay_notify_url', paymentConfig.alipayNotifyUrl),
        adminApi.updateConfig('alipay_return_url', paymentConfig.alipayReturnUrl),
        adminApi.updateConfig('wechat_app_id', paymentConfig.wechatAppId),
        adminApi.updateConfig('wechat_mch_id', paymentConfig.wechatMchId),
        adminApi.updateConfig('wechat_pay_key', paymentConfig.wechatPayKey),
        adminApi.updateConfig('wechat_api_v3_key', paymentConfig.wechatApiV3Key),
        adminApi.updateConfig('wechat_serial_no', paymentConfig.wechatSerialNo),
        adminApi.updateConfig('wechat_private_key', paymentConfig.wechatPrivateKey),
        adminApi.updateConfig('wechat_notify_url', paymentConfig.wechatNotifyUrl),
      ]);
      toast.success('保存成功');
      // 保存成功后重新加载配置
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSms = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('aliyun_access_key_id', smsConfig.aliyunAccessKeyId),
        adminApi.updateConfig('aliyun_access_key_secret', smsConfig.aliyunAccessKeySecret),
        adminApi.updateConfig('aliyun_sign_name', smsConfig.aliyunSignName),
        // 短信模板
        adminApi.updateConfig('sms_template_login', smsConfig.smsTemplateLogin),
        adminApi.updateConfig('sms_template_register', smsConfig.smsTemplateRegister),
        adminApi.updateConfig('sms_template_reset_password', smsConfig.smsTemplateResetPassword),
        adminApi.updateConfig('sms_template_order', smsConfig.smsTemplateOrder),
        adminApi.updateConfig('sms_template_feed_bill', smsConfig.smsTemplateFeedBill),
      ]);
      toast.success('保存成功');
      // 保存成功后重新加载配置
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWechatTemplate = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('wechat_template_adoption_success', wechatTemplateConfig.adoptionSuccess),
        adminApi.updateConfig('wechat_template_feed_bill', wechatTemplateConfig.feedBill),
        adminApi.updateConfig('wechat_template_feed_bill_overdue', wechatTemplateConfig.feedBillOverdue),
        adminApi.updateConfig('wechat_template_redemption_audit', wechatTemplateConfig.redemptionAudit),
        adminApi.updateConfig('wechat_template_redemption_success', wechatTemplateConfig.redemptionSuccess),
      ]);
      toast.success('保存成功');
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const tabs = [
    { id: 'basic', label: '基础配置', icon: Icons.Settings },
    { id: 'payment', label: '支付配置', icon: Icons.CreditCard },
    { id: 'sms', label: '短信配置', icon: Icons.MessageSquare },
    { id: 'wechat', label: '微信通知', icon: Icons.Bell },
  ];

  return (
    <div className="p-6">


      <div className="flex gap-4 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'basic' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">网站基础配置</h3>
          <div className="space-y-4 max-w-2xl">
            <Input label="网站名称" value={basicConfig.siteName} onChange={e => setBasicConfig({ ...basicConfig, siteName: e.target.value })} placeholder="云端牧场" />
            <Input label="网站标题" value={basicConfig.siteTitle} onChange={e => setBasicConfig({ ...basicConfig, siteTitle: e.target.value })} placeholder="云端牧场 - 智慧农业领养平台" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="site-description">网站描述 (SEO)</label>
              <textarea id="site-description" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none" rows={3} value={basicConfig.siteDescription} onChange={e => setBasicConfig({ ...basicConfig, siteDescription: e.target.value })} placeholder="网站描述，用于SEO优化" />
            </div>
            <Input label="网站关键词 (SEO)" value={basicConfig.siteKeywords} onChange={e => setBasicConfig({ ...basicConfig, siteKeywords: e.target.value })} placeholder="云端牧场,智慧农业,活体领养" />
            <Input label="联系电话" value={basicConfig.contactPhone} onChange={e => setBasicConfig({ ...basicConfig, contactPhone: e.target.value })} placeholder="400-xxx-xxxx" />
            <Input label="联系邮箱" value={basicConfig.contactEmail} onChange={e => setBasicConfig({ ...basicConfig, contactEmail: e.target.value })} placeholder="contact@example.com" />
            <Input label="客服微信" value={basicConfig.contactWechat} onChange={e => setBasicConfig({ ...basicConfig, contactWechat: e.target.value })} placeholder="微信号或二维码链接" />
            <div className="pt-4">
              <Button onClick={handleSaveBasic} loading={saving}>保存配置</Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-6">
          {/* 支付开关 */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">支付方式开关</h3>
            <p className="text-sm text-slate-500 mb-4">开启或关闭对应的支付方式，关闭后用户端将不显示该支付选项</p>
            <div className="flex gap-8">
              <div className="flex items-center gap-3 cursor-pointer">
                <div
                  id="alipay-switch"
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    paymentConfig.alipayEnabled ? "bg-brand-primary" : "bg-slate-300"
                  )}
                  onClick={() => setPaymentConfig(prev => ({ ...prev, alipayEnabled: !prev.alipayEnabled }))}
                  onKeyDown={(e) => e.key === 'Enter' && setPaymentConfig(prev => ({ ...prev, alipayEnabled: !prev.alipayEnabled }))}
                  role="switch"
                  tabIndex={0}
                  aria-checked={paymentConfig.alipayEnabled}
                  aria-labelledby="alipay-label"
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform",
                    paymentConfig.alipayEnabled ? "translate-x-6" : "translate-x-0.5"
                  )} />
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Alipay className="w-5 h-5 text-blue-500" />
                  <span id="alipay-label" className="font-medium">支付宝支付</span>
                  <span className={cn("text-sm", paymentConfig.alipayEnabled ? "text-brand-primary" : "text-slate-400")}>
                    {paymentConfig.alipayEnabled ? '已启用' : '已关闭'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 cursor-pointer">
                <div
                  id="wechat-switch"
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    paymentConfig.wechatEnabled ? "bg-brand-primary" : "bg-slate-300"
                  )}
                  onClick={() => setPaymentConfig(prev => ({ ...prev, wechatEnabled: !prev.wechatEnabled }))}
                  onKeyDown={(e) => e.key === 'Enter' && setPaymentConfig(prev => ({ ...prev, wechatEnabled: !prev.wechatEnabled }))}
                  role="switch"
                  tabIndex={0}
                  aria-checked={paymentConfig.wechatEnabled}
                  aria-labelledby="wechat-label"
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform",
                    paymentConfig.wechatEnabled ? "translate-x-6" : "translate-x-0.5"
                  )} />
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Wechat className="w-5 h-5 text-green-500" />
                  <span id="wechat-label" className="font-medium">微信支付</span>
                  <span className={cn("text-sm", paymentConfig.wechatEnabled ? "text-brand-primary" : "text-slate-400")}>
                    {paymentConfig.wechatEnabled ? '已启用' : '已关闭'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">支付宝支付配置（H5支付）</h3>
            <div className="space-y-4 max-w-2xl">
              <Input label="App ID" value={paymentConfig.alipayAppId} onChange={e => setPaymentConfig({ ...paymentConfig, alipayAppId: e.target.value })} placeholder="支付宝应用ID" />
              <SensitiveTextarea
                label="应用私钥"
                value={paymentConfig.alipayPrivateKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, alipayPrivateKey: value })}
                placeholder="支付宝应用私钥（RSA2格式）"
                rows={4}
              />
              <SensitiveTextarea
                label="支付宝公钥"
                value={paymentConfig.alipayPublicKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, alipayPublicKey: value })}
                placeholder="支付宝公钥（用于验签）"
                rows={4}
              />
              <Input label="支付回调URL" value={paymentConfig.alipayNotifyUrl} onChange={e => setPaymentConfig({ ...paymentConfig, alipayNotifyUrl: e.target.value })} placeholder="https://example.com/api/payment/alipay/notify" />
              <Input label="支付返回URL" value={paymentConfig.alipayReturnUrl} onChange={e => setPaymentConfig({ ...paymentConfig, alipayReturnUrl: e.target.value })} placeholder="https://example.com/payment/result" />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">微信支付配置（H5支付）</h3>
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <Input label="App ID" value={paymentConfig.wechatAppId} onChange={e => setPaymentConfig({ ...paymentConfig, wechatAppId: e.target.value })} placeholder="微信应用ID" />
                <Input label="商户号" value={paymentConfig.wechatMchId} onChange={e => setPaymentConfig({ ...paymentConfig, wechatMchId: e.target.value })} placeholder="微信商户号" />
              </div>
              <SensitiveTextarea
                label="商户API密钥（V2）"
                value={paymentConfig.wechatPayKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, wechatPayKey: value })}
                placeholder="微信支付V2密钥（32位）"
                rows={2}
              />
              <SensitiveTextarea
                label="API V3密钥"
                value={paymentConfig.wechatApiV3Key}
                onChange={value => setPaymentConfig({ ...paymentConfig, wechatApiV3Key: value })}
                placeholder="微信支付V3密钥（32位）"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="商户证书序列号" value={paymentConfig.wechatSerialNo} onChange={e => setPaymentConfig({ ...paymentConfig, wechatSerialNo: e.target.value })} placeholder="商户API证书序列号" />
                <Input label="支付回调URL" value={paymentConfig.wechatNotifyUrl} onChange={e => setPaymentConfig({ ...paymentConfig, wechatNotifyUrl: e.target.value })} placeholder="https://example.com/api/payment/wechat/notify" />
              </div>
              <SensitiveTextarea
                label="商户API私钥"
                value={paymentConfig.wechatPrivateKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, wechatPrivateKey: value })}
                placeholder="商户API私钥（用于签名）"
                rows={4}
              />
              <div className="pt-4">
                <Button onClick={handleSavePayment} loading={saving}>保存支付配置</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'sms' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">阿里云短信配置</h3>
          <div className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Access Key ID" value={smsConfig.aliyunAccessKeyId} onChange={e => setSmsConfig({ ...smsConfig, aliyunAccessKeyId: e.target.value })} placeholder="阿里云 Access Key ID" />
              <Input label="Access Key Secret" value={smsConfig.aliyunAccessKeySecret} onChange={e => setSmsConfig({ ...smsConfig, aliyunAccessKeySecret: e.target.value })} placeholder="阿里云 Access Key Secret" type="password" />
            </div>
            <Input label="短信签名" value={smsConfig.aliyunSignName} onChange={e => setSmsConfig({ ...smsConfig, aliyunSignName: e.target.value })} placeholder="短信签名名称，如：云端牧场" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mt-8 mb-4">短信模板配置</h3>
          <p className="text-sm text-slate-500 mb-4">
            请在阿里云短信控制台创建对应模板，填写模板CODE（如：SMS_123456789）
          </p>
          <div className="space-y-4 max-w-2xl">
            <Input
              label="登录验证码模板"
              value={smsConfig.smsTemplateLogin}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateLogin: e.target.value })}
              placeholder="模板CODE，变量：${code}"
            />
            <Input
              label="注册验证码模板"
              value={smsConfig.smsTemplateRegister}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateRegister: e.target.value })}
              placeholder="模板CODE，变量：${code}"
            />
            <Input
              label="找回密码验证码模板"
              value={smsConfig.smsTemplateResetPassword}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateResetPassword: e.target.value })}
              placeholder="模板CODE，变量：${code}"
            />
            <Input
              label="订单通知模板"
              value={smsConfig.smsTemplateOrder}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateOrder: e.target.value })}
              placeholder="模板CODE，变量：${orderNo}（认养编号）"
            />
            <Input
              label="饲料费通知模板"
              value={smsConfig.smsTemplateFeedBill}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateFeedBill: e.target.value })}
              placeholder="模板CODE，变量：${orderNo}（认养编号）"
            />
            <div className="pt-4">
              <Button onClick={handleSaveSms} loading={saving}>保存短信配置</Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'wechat' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">微信公众号模板消息配置</h3>
          <p className="text-sm text-slate-500 mb-4">
            请在微信公众平台 → 功能 → 模板消息中申请对应模板，填写模板ID
          </p>
          <div className="space-y-4 max-w-2xl">
            <Input
              label="领养成功通知模板"
              value={wechatTemplateConfig.adoptionSuccess}
              onChange={e => setWechatTemplateConfig({ ...wechatTemplateConfig, adoptionSuccess: e.target.value })}
              placeholder="模板ID（如：OPENTM410000000）"
            />
            <p className="text-xs text-slate-400 -mt-2">用于：领养/订单支付成功时通知用户</p>

            <Input
              label="饲料费账单模板"
              value={wechatTemplateConfig.feedBill}
              onChange={e => setWechatTemplateConfig({ ...wechatTemplateConfig, feedBill: e.target.value })}
              placeholder="模板ID（如：OPENTM410000000）"
            />
            <p className="text-xs text-slate-400 -mt-2">用于：每月饲料费账单生成时通知用户</p>

            <Input
              label="饲料费逾期模板"
              value={wechatTemplateConfig.feedBillOverdue}
              onChange={e => setWechatTemplateConfig({ ...wechatTemplateConfig, feedBillOverdue: e.target.value })}
              placeholder="模板ID（如：OPENTM410000000）"
            />
            <p className="text-xs text-slate-400 -mt-2">用于：饲料费逾期时提醒用户</p>

            <Input
              label="买断审核模板"
              value={wechatTemplateConfig.redemptionAudit}
              onChange={e => setWechatTemplateConfig({ ...wechatTemplateConfig, redemptionAudit: e.target.value })}
              placeholder="模板ID（如：OPENTM410000000）"
            />
            <p className="text-xs text-slate-400 -mt-2">用于：买断申请审核结果通知</p>

            <Input
              label="买断成功模板"
              value={wechatTemplateConfig.redemptionSuccess}
              onChange={e => setWechatTemplateConfig({ ...wechatTemplateConfig, redemptionSuccess: e.target.value })}
              placeholder="模板ID（如：OPENTM410000000）"
            />
            <p className="text-xs text-slate-400 -mt-2">用于：买断支付成功时通知用户</p>

            <div className="pt-4">
              <Button onClick={handleSaveWechatTemplate} loading={saving}>保存微信模板配置</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
