/**
 * AuthPage.tsx - 认证页面
 * 从 App.tsx 拆分出来的独立模块
 *
 * 包含：
 * - 登录（验证码/密码）
 * - 注册
 * - 忘记密码
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { PageTransition, Button, Modal, Input } from '../../components/ui';
import { Icons } from '../../components/ui';
import { cn } from '../../lib/utils';
import { authApi, agreementApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// SMS 冷却存储 Key
const SMS_COOLDOWN_KEY = 'sms_cooldown_end';

// ==================== 类型定义 ====================

type AuthMode = 'login' | 'register' | 'forgot';

// ==================== 认证页面组件 ====================

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginType, setLoginType] = useState<'password' | 'code'>('code');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(() => {
    // 从 localStorage 恢复冷却时间
    const storedEndTime = localStorage.getItem(SMS_COOLDOWN_KEY);
    if (storedEndTime) {
      const remaining = Math.ceil((Number.parseInt(storedEndTime, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        return remaining;
      }
      localStorage.removeItem(SMS_COOLDOWN_KEY);
    }
    return 0;
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementContent, setAgreementContent] = useState<{ title: string; content: string } | null>(null);

  // 使用 ref 保存定时器引用，用于清理
  const countdownTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // 恢复冷却倒计时（如果页面刷新后还有剩余时间）
  useEffect(() => {
    if (countdown > 0 && !countdownTimerRef.current) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            localStorage.removeItem(SMS_COOLDOWN_KEY);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, []); // 只在组件挂载时执行一次

  const handleSendCode = async () => {
    if (!phone || !/^1\d{10}$/.test(phone)) {
      setErrors({ phone: '请输入正确的手机号' });
      return;
    }
    if (countdown > 0) return;
    try {
      let type: 'register' | 'reset_password' | 'login';
      if (mode === 'register') {
        type = 'register';
      } else if (mode === 'forgot') {
        type = 'reset_password';
      } else {
        type = 'login';
      }
      await authApi.sendSmsCode(phone, type);
      const cooldownSeconds = 60;
      const endTime = Date.now() + cooldownSeconds * 1000;
      // 存储冷却结束时间到 localStorage
      localStorage.setItem(SMS_COOLDOWN_KEY, endTime.toString());
      setCountdown(cooldownSeconds);
      // 使用 ref 保存定时器引用
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            localStorage.removeItem(SMS_COOLDOWN_KEY);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setErrors({});
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '发送失败';
      setErrors({ code: message });
    }
  };

  // 验证手机号
  const validatePhone = (phoneNum: string): string | null => {
    if (!phoneNum || !/^1\d{10}$/.test(phoneNum)) {
      return '请输入正确的手机号';
    }
    return null;
  };

  // 验证登录表单
  const validateLoginForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    if (loginType === 'password' && !password) newErrors.password = '请输入密码';
    if (loginType === 'code' && !code) newErrors.code = '请输入验证码';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 验证注册表单
  const validateRegisterForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    if (!code) newErrors.code = '请输入验证码';
    if (!password || password.length < 6) newErrors.password = '密码至少6位';
    if (password !== confirmPassword) newErrors.confirmPassword = '两次密码不一致';
    if (!agreed) newErrors.agreed = '请阅读并同意用户协议和隐私政策';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 验证重置密码表单
  const validateResetForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    if (!code) newErrors.code = '请输入验证码';
    if (!password || password.length < 6) newErrors.password = '密码至少6位';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateLoginForm()) return;

    setLoading(true);
    try {
      const result = loginType === 'password'
        ? await authApi.loginByPassword({ phone, password })
        : await authApi.loginByCode({ phone, code });
      login(result.token, result.user);
      navigate('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登录失败';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validateRegisterForm()) return;

    setLoading(true);
    try {
      const result = await authApi.register({ phone, code, password });
      login(result.token, result.user);
      navigate('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '注册失败';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  const handleShowAgreement = async (type: 'user' | 'privacy') => {
    setShowAgreement(true);
    try {
      const data = await agreementApi.get(type);
      setAgreementContent(data);
    } catch {
      setAgreementContent({
        title: type === 'user' ? '用户协议' : '隐私政策',
        content: '暂无协议内容，请联系管理员配置。',
      });
    }
  };

  const handleResetPassword = async () => {
    if (!validateResetForm()) return;

    setLoading(true);
    try {
      await authApi.resetPassword({ phone, code, newPassword: password });
      setMode('login');
      setErrors({});
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '重置失败';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <div className="p-6">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
            <Icons.ArrowLeft className="w-5 h-5 text-brand-primary" />
          </button>
        </div>
        <div className="flex-1 px-6 pb-8">
          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                  <div className="mb-8">
                    <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">欢迎回来</h1>
                    <p className="text-slate-500">登录您的云端牧场账号</p>
                  </div>
                  <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                    <button type="button" onClick={() => setLoginType('code')} className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", loginType === 'code' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500')}>验证码登录</button>
                    <button type="button" onClick={() => setLoginType('password')} className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", loginType === 'password' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500')}>密码登录</button>
                  </div>
                  <div className="space-y-4">
                    <Input label="手机号" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} icon={<Icons.Smartphone className="w-5 h-5" />} error={errors.phone} />
                    {loginType === 'password' ? (
                      <Input label="密码" type={showPassword ? 'text' : 'password'} placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />} name="password" autoComplete="current-password"
                        suffix={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} error={errors.password} />
                    ) : (
                      <Input label="验证码" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} icon={<Icons.Key className="w-5 h-5" />}
                        suffix={<button type="button" onClick={handleSendCode} disabled={countdown > 0} className="text-brand-primary font-medium text-sm disabled:text-slate-300">{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>} error={errors.code} />
                    )}
                  </div>
                  {errors.submit && <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>}
                  <div className="flex justify-between items-center mt-4 text-sm">
                    <button type="button" onClick={() => setMode('forgot')} className="text-slate-500">忘记密码？</button>
                    <button type="button" onClick={() => setMode('register')} className="text-brand-primary font-medium">注册账号</button>
                  </div>
                  <Button type="submit" className="w-full mt-6" size="lg" loading={loading}>登录</Button>
                </form>
                <div className="mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-slate-200" /><span className="text-xs text-slate-400">其他登录方式</span><div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <button className="w-full flex items-center justify-center gap-3 py-3 border border-green-500 text-green-600 rounded-2xl font-medium hover:bg-green-50 transition-colors">
                    <Icons.Wechat className="w-5 h-5" />微信登录
                  </button>
                </div>
              </motion.div>
            )}
            {mode === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
                  <div className="mb-8">
                    <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">创建账号</h1>
                    <p className="text-slate-500">注册成为云端牧场会员</p>
                  </div>
                  <div className="space-y-4">
                    <Input label="手机号" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} icon={<Icons.Smartphone className="w-5 h-5" />} error={errors.phone} />
                    <Input label="验证码" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} icon={<Icons.Key className="w-5 h-5" />}
                      suffix={<button type="button" onClick={handleSendCode} disabled={countdown > 0} className="text-brand-primary font-medium text-sm disabled:text-slate-300">{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>} error={errors.code} />
                    <Input label="设置密码" type={showPassword ? 'text' : 'password'} placeholder="请设置登录密码（至少6位）" value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />} name="password" autoComplete="new-password"
                      suffix={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} error={errors.password} />
                    <Input label="确认密码" type="password" placeholder="请再次输入密码" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />} name="confirmPassword" autoComplete="new-password" error={errors.confirmPassword} />
                  </div>
                  <div className="mt-4 flex items-start gap-2">
                    <button type="button" onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors mt-0.5", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
                      <Icons.Check className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm text-slate-500">
                      我已阅读并同意{' '}
                      <button type="button" onClick={() => handleShowAgreement('user')} className="text-brand-primary cursor-pointer font-medium">《用户协议》</button>
                      {' '}和{' '}
                      <button type="button" onClick={() => handleShowAgreement('privacy')} className="text-brand-primary cursor-pointer font-medium">《隐私政策》</button>
                    </span>
                  </div>
                  {errors.agreed && <p className="text-red-500 text-sm mt-2">{errors.agreed}</p>}
                  {errors.submit && <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>}
                  <div className="flex justify-center items-center mt-4 text-sm">
                    <span className="text-slate-500">已有账号？</span>
                    <button type="button" onClick={() => setMode('login')} className="text-brand-primary font-medium ml-1">立即登录</button>
                  </div>
                  <Button type="submit" className="w-full mt-6" size="lg" loading={loading}>注册</Button>
                </form>
              </motion.div>
            )}
            {mode === 'forgot' && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
                  <div className="mb-8">
                    <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">重置密码</h1>
                    <p className="text-slate-500">通过手机验证码重置您的密码</p>
                  </div>
                  <div className="space-y-4">
                    <Input label="手机号" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} icon={<Icons.Smartphone className="w-5 h-5" />} error={errors.phone} />
                    <Input label="验证码" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} icon={<Icons.Key className="w-5 h-5" />}
                      suffix={<button type="button" onClick={handleSendCode} disabled={countdown > 0} className="text-brand-primary font-medium text-sm disabled:text-slate-300">{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>} error={errors.code} />
                    <Input label="新密码" type={showPassword ? 'text' : 'password'} placeholder="请设置新密码（至少6位）" value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />} name="newPassword" autoComplete="new-password"
                      suffix={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} error={errors.password} />
                  </div>
                  {errors.submit && <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>}
                  <div className="flex justify-center items-center mt-4 text-sm">
                    <span className="text-slate-500">想起密码了？</span>
                    <button type="button" onClick={() => setMode('login')} className="text-brand-primary font-medium ml-1">返回登录</button>
                  </div>
                  <Button type="submit" className="w-full mt-6" size="lg" loading={loading}>重置密码</Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 协议弹窗 - 使用 DOMPurify 防止 XSS */}
        <Modal open={showAgreement} onClose={() => setShowAgreement(false)} title={agreementContent?.title || '协议'}>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div
              className="prose prose-sm max-w-none text-slate-600"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(agreementContent?.content || '', {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'span', 'div'],
                  // 修复 F-007：移除 style 属性，防止 CSS 注入攻击
                  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
                  ADD_ATTR: ['target'],
                }),
              }}
            />
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

export default AuthPage;
