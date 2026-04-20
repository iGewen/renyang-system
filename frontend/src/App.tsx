/**
 * App.tsx - 主应用入口
 *
 * ============================================================================
 * NOTE: F-H01 上帝组件重构计划 (约 2700 行，建议拆分)
 * ============================================================================
 *
 * 当前文件包含过多组件，建议逐步拆分到独立文件：
 *
 * 1. 页面组件 (建议移至 pages/ 目录):
 *    - AuthPage -> pages/auth/AuthPage.tsx (约 300 行)
 *    - HomePage -> pages/home/HomePage.tsx (约 100 行)
 *    - NotificationPage -> pages/notification/NotificationPage.tsx (约 130 行)
 *    - GrowthRecordsPage -> pages/growth/GrowthRecordsPage.tsx (约 150 行)
 *    - SupportPage -> pages/support/SupportPage.tsx (约 160 行)
 *    - ProfilePage -> pages/profile/ProfilePage.tsx (约 500 行)
 *    - SecurityPage -> pages/security/SecurityPage.tsx (约 300 行)
 *
 * 2. 共享组件 (建议移至 components/ 目录):
 *    - Navbar -> components/layout/Navbar.tsx
 *    - TabBar, GlobalTabBar -> components/layout/TabBar.tsx
 *    - NotificationBadge -> components/common/NotificationBadge.tsx
 *    - LivestockCard -> components/livestock/LivestockCard.tsx
 *    - HomePageSkeleton -> components/skeleton/HomePageSkeleton.tsx
 *
 * 3. 上下文和 Hooks (建议移至 contexts/ 和 hooks/ 目录):
 *    - AuthContext -> contexts/AuthContext.tsx
 *    - useAuth -> hooks/useAuth.ts
 *
 * 4. 路由守卫 (建议移至 routes/ 目录):
 *    - AdminProtectedRoute -> routes/AdminProtectedRoute.tsx
 *    - UserProtectedRoute -> routes/UserProtectedRoute.tsx
 *
 * 重构优先级:
 * - P0: ProfilePage (最大，约 500 行)
 * - P1: AuthPage + SecurityPage (认证相关，约 600 行)
 * - P2: 其他页面组件 (约 500 行)
 * - P3: 布局组件 (约 200 行)
 *
 * 注意: 每次拆分后需确保:
 * - 路由配置正确
 * - Context 依赖正确
 * - 样式一致
 * - 功能测试通过
 * ============================================================================
 */

import React, { useState, useEffect, createContext, useContext, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, Modal, Input, EmptyState, useToast } from './components/ui';
import { cn } from './lib/utils';
import type { Livestock, Adoption, User } from './types';
import { AdoptionStatus, OrderStatus, getAdoptionStatusText } from './types/enums';
import { livestockApi, adoptionApi, orderApi, paymentApi, notificationApi, authApi, agreementApi, redemptionApi } from './services/api';
import { SiteConfigProvider, usePaymentConfig, useSiteConfig } from './contexts/SiteConfigContext';

// Lazy load pages for better performance
const OrdersPage = lazy(() => import('./pages/order/OrdersPage'));
const AdoptionDetailPage = lazy(() => import('./pages/adoption/AdoptionDetailPage'));
const FeedBillDetailPage = lazy(() => import('./pages/feed-bill/FeedBillDetailPage'));
const RedemptionPage = lazy(() => import('./pages/redemption/RedemptionPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const BalancePage = lazy(() => import('./pages/user/BalancePage'));

// SMS 冷却存储 Key
const SMS_COOLDOWN_KEY = 'sms_cooldown_end';

// ==================== 认证上下文 ====================

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 默认认证值 - 使用稳定对象避免每次渲染创建新对象
const DEFAULT_AUTH_VALUE: AuthContextType = {
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
};

const useAuth = () => {
  const context = useContext(AuthContext);
  // 返回稳定的默认值，而不是每次创建新对象
  return context ?? DEFAULT_AUTH_VALUE;
};

// ==================== 认证页面 ====================

type AuthMode = 'login' | 'register' | 'forgot';

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
    } catch (error: any) {
      setErrors({ code: error.message || '发送失败' });
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
    } catch (error: any) {
      setErrors({ submit: error.message || '登录失败' });
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
    } catch (error: any) {
      setErrors({ submit: error.message || '注册失败' });
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
    } catch (error: any) {
      setErrors({ submit: error.message || '重置失败' });
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
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">欢迎回来</h1>
                  <p className="text-slate-500">登录您的云端牧场账号</p>
                </div>
                <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                  <button onClick={() => setLoginType('code')} className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", loginType === 'code' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500')}>验证码登录</button>
                  <button onClick={() => setLoginType('password')} className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", loginType === 'password' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500')}>密码登录</button>
                </div>
                <div className="space-y-4">
                  <Input label="手机号" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} icon={<Icons.Smartphone className="w-5 h-5" />} error={errors.phone} />
                  {loginType === 'password' ? (
                    <Input label="密码" type={showPassword ? 'text' : 'password'} placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />}
                      suffix={<button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} error={errors.password} />
                  ) : (
                    <Input label="验证码" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} icon={<Icons.Key className="w-5 h-5" />}
                      suffix={<button onClick={handleSendCode} disabled={countdown > 0} className="text-brand-primary font-medium text-sm disabled:text-slate-300">{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>} error={errors.code} />
                  )}
                </div>
                {errors.submit && <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>}
                <div className="flex justify-between items-center mt-4 text-sm">
                  <button onClick={() => setMode('forgot')} className="text-slate-500">忘记密码？</button>
                  <button onClick={() => setMode('register')} className="text-brand-primary font-medium">注册账号</button>
                </div>
                <Button className="w-full mt-6" size="lg" onClick={handleLogin} loading={loading}>登录</Button>
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
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">创建账号</h1>
                  <p className="text-slate-500">注册成为云端牧场会员</p>
                </div>
                <div className="space-y-4">
                  <Input label="手机号" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} icon={<Icons.Smartphone className="w-5 h-5" />} error={errors.phone} />
                  <Input label="验证码" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} icon={<Icons.Key className="w-5 h-5" />}
                    suffix={<button onClick={handleSendCode} disabled={countdown > 0} className="text-brand-primary font-medium text-sm disabled:text-slate-300">{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>} error={errors.code} />
                  <Input label="设置密码" type={showPassword ? 'text' : 'password'} placeholder="请设置登录密码（至少6位）" value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />}
                    suffix={<button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} error={errors.password} />
                  <Input label="确认密码" type="password" placeholder="请再次输入密码" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />} error={errors.confirmPassword} />
                </div>
                <div className="mt-4 flex items-start gap-2">
                  <button onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors mt-0.5", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
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
                  <button onClick={() => setMode('login')} className="text-brand-primary font-medium ml-1">立即登录</button>
                </div>
                <Button className="w-full mt-6" size="lg" onClick={handleRegister} loading={loading}>注册</Button>
              </motion.div>
            )}
            {mode === 'forgot' && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">重置密码</h1>
                  <p className="text-slate-500">通过手机验证码重置您的密码</p>
                </div>
                <div className="space-y-4">
                  <Input label="手机号" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} icon={<Icons.Smartphone className="w-5 h-5" />} error={errors.phone} />
                  <Input label="验证码" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} icon={<Icons.Key className="w-5 h-5" />}
                    suffix={<button onClick={handleSendCode} disabled={countdown > 0} className="text-brand-primary font-medium text-sm disabled:text-slate-300">{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>} error={errors.code} />
                  <Input label="新密码" type={showPassword ? 'text' : 'password'} placeholder="请设置新密码（至少6位）" value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />}
                    suffix={<button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} error={errors.password} />
                </div>
                {errors.submit && <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>}
                <div className="flex justify-center items-center mt-4 text-sm">
                  <span className="text-slate-500">想起密码了？</span>
                  <button onClick={() => setMode('login')} className="text-brand-primary font-medium ml-1">返回登录</button>
                </div>
                <Button className="w-full mt-6" size="lg" onClick={handleResetPassword} loading={loading}>重置密码</Button>
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

// ==================== 首页骨架屏组件 ====================

const HomePageSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={`skeleton-home-card-${i}`} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="relative h-64 bg-slate-200 animate-pulse" />
        <div className="p-6 space-y-4">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-slate-200 rounded animate-pulse w-full" />
          <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-6">
              <div className="space-y-1">
                <div className="h-2 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="h-2 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-14 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ==================== 活体卡片组件 ====================

interface LivestockCardProps {
  item: Livestock;
  index: number;
  onClick: () => void;
}

const LivestockCard: React.FC<LivestockCardProps> = ({ item, index, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1">
        {/* 图片区域 */}
        <div className="relative h-64 overflow-hidden">
          <img
            src={item.mainImage || item.images?.[0] || '/placeholder.jpg'}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          {/* 渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {/* 顶部标签 */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            {item.typeName && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white text-[10px] font-bold uppercase tracking-wider">
                {item.typeName}
              </span>
            )}
          </div>

          {/* 底部信息 */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-display font-bold text-white mb-1 drop-shadow-md">
                  {item.name}
                </h3>
                <p className="text-white/70 text-sm line-clamp-1 max-w-[180px]">
                  {item.description}
                </p>
              </div>
              <div className="flex-shrink-0 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-4 py-2">
                <span className="text-white/70 text-xs">¥</span>
                <span className="text-white text-xl font-bold">{item.price}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部详情 */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">月饲料</span>
                <span className="text-base font-bold text-brand-primary">¥{item.monthlyFeedFee}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">买断期</span>
                <span className="text-base font-bold text-brand-primary">{item.redemptionMonths}个月</span>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-bg to-slate-50 border border-slate-100 flex items-center justify-center group-hover:from-brand-primary group-hover:to-indigo-600 group-hover:border-transparent group-hover:text-white transition-all duration-300"
            >
              <Icons.ChevronRight className="w-5 h-5" />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ==================== 首页 ====================

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [livestockList, setLivestockList] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchLivestock = async () => {
      try {
        const data = await livestockApi.getList();
        setLivestockList(data.list);
      } catch (error) {
        console.error('Failed to fetch livestock:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLivestock();

    // 获取未读消息数
    notificationApi.getUnreadCount().then(res => setUnreadCount(res.count)).catch(() => {});
  }, []);

  const rightContent = (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/notifications')}
      className="relative w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-white/30 flex items-center justify-center text-brand-primary shadow-sm"
    >
      <Icons.Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
    </motion.button>
  );

  return (
    <PageTransition>
      <div className="min-h-screen pb-28">
        <Navbar title="云端牧场" transparent rightContent={rightContent} />
        <div className="max-w-screen-xl mx-auto px-6 pt-2 pb-8">
          {/* 头部区域 */}
          <header className="mb-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-brand-accent/10 to-emerald-50 text-brand-accent text-[10px] font-bold uppercase tracking-wider mb-4 border border-brand-accent/10"
            >
              <Icons.Leaf className="w-3.5 h-3.5" />
              智慧农业新体验
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl font-display font-bold text-brand-primary leading-tight mb-4"
            >
              在云端，<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-indigo-600">拥有属于您的牧场</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-slate-500 text-base max-w-md leading-relaxed"
            >
              连接自然与科技，每一份领养都是对生命的尊重与呵护。
            </motion.p>
          </header>

          {/* 内容区域 */}
          {(() => {
            if (loading) {
              return <HomePageSkeleton />;
            }
            if (livestockList.length === 0) {
              return (
                <EmptyState
                  icon={<Icons.Sprout className="w-10 h-10" />}
                  title="暂无可领养的活体"
                  description="我们正在为您寻找更多优质活体，请稍后再来查看"
                  action={
                    <Button variant="outline" onClick={() => globalThis.location.reload()}>
                      刷新页面
                    </Button>
                  }
                />
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {livestockList.map((item, index) => (
                  <LivestockCard
                    key={item.id}
                    item={item}
                    index={index}
                    onClick={() => navigate(`/details/${item.id}`)}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 导航栏 ====================

const Navbar: React.FC<{ title: string; showBack?: boolean; transparent?: boolean; rightContent?: React.ReactNode }> = ({ title, showBack = false, transparent = false, rightContent }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  return (
    <div className={cn("sticky top-0 z-50 transition-all", transparent ? "bg-transparent" : "bg-brand-bg/80 backdrop-blur-xl border-b border-slate-100")}>
      <div className="max-w-screen-xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform" aria-label="返回上一页">
              <Icons.ArrowLeft className="w-5 h-5 text-brand-primary" aria-hidden="true" />
            </button>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary tracking-tight">{title}</h1>
        </div>
        {rightContent || (
          <div className="flex gap-3">
            <Link to="/notifications" className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-brand-primary transition-colors relative" aria-label="通知消息">
              <Icons.Bell className="w-5 h-5" aria-hidden="true" />
              <NotificationBadge />
            </Link>
            <Link to={isAuthenticated ? "/profile" : "/auth"} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/20 flex items-center justify-center text-white hover:scale-105 transition-transform" aria-label={isAuthenticated ? "个人中心" : "登录"}>
              <Icons.User className="w-5 h-5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

// 统一的消息角标组件，通过 variant 区分样式
// - default: 带动画脉冲效果，用于首页导航栏
// - compact: 无动画，用于 Profile 页面等紧凑位置
interface NotificationBadgeProps {
  variant?: 'default' | 'compact';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ variant = 'default' }) => {
  const [count, setCount] = useState(0);
  const { token, isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // 只有登录后才获取未读数
    if (!token || !isAuthenticated) {
      setCount(0);
      return;
    }
    notificationApi.getUnreadCount().then(res => {
      setCount(res.count || 0);
    }).catch(() => {
      setCount(0);
    });
  }, [token, isAuthenticated, location.pathname]);

  if (count === 0) return null;

  // 根据变体返回不同样式
  if (variant === 'compact') {
    return <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{count > 9 ? '9+' : count}</span>;
  }

  return <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">{count > 9 ? '9+' : count}</span>;
};

// ==================== 底部导航 ====================

const TabBar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const [unreadCount, setUnreadCount] = useState(0);

  // 获取未读消息数的函数
  const fetchUnreadCount = React.useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    notificationApi.getUnreadCount().then(res => {
      setUnreadCount(res.count || 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // 每60秒刷新一次（优化：减少轮询频率）
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // 路由变化时刷新未读数
  useEffect(() => {
    fetchUnreadCount();
  }, [location.pathname, fetchUnreadCount]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-md md:max-w-lg mx-auto px-6 pb-6 pointer-events-auto">
        <div className="bg-brand-primary/95 backdrop-blur-md rounded-[32px] flex justify-around items-center py-3 px-4 safe-area-bottom shadow-2xl shadow-brand-primary/40 border border-white/10">
          <Link to="/" className={cn("flex flex-col items-center justify-center gap-1 transition-colors duration-200 min-w-[60px]", isActive('/') ? "text-white" : "text-white/40 hover:text-white/60")} aria-label="探索首页" aria-current={isActive('/') ? 'page' : undefined}>
            <Icons.Home className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wider uppercase">探索</span>
          </Link>
          <Link to="/my-adoptions" className={cn("flex flex-col items-center justify-center gap-1 transition-colors duration-200 min-w-[60px]", isActive('/my-adoptions') ? "text-white" : "text-white/40 hover:text-white/60")} aria-label="我的牧场" aria-current={isActive('/my-adoptions') ? 'page' : undefined}>
            <Icons.Package className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wider uppercase">牧场</span>
          </Link>
          <Link to="/profile" className={cn("flex flex-col items-center justify-center gap-1 transition-colors duration-200 min-w-[60px] relative", isActive('/profile') ? "text-white" : "text-white/40 hover:text-white/60")} aria-label="个人中心" aria-current={isActive('/profile') ? 'page' : undefined}>
            <Icons.User className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wider uppercase">我的</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 right-2 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
};

// 全局底部导航栏 - 只在特定页面显示
const GlobalTabBar: React.FC = () => {
  const location = useLocation();
  // 只在首页、我的牧场、个人中心页面显示底部导航
  const showTabBarPages = ['/', '/my-adoptions', '/profile'];
  const shouldShow = showTabBarPages.includes(location.pathname);

  if (!shouldShow) return null;

  return <TabBar />;
};

// ==================== 详情页 ====================

const DetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [livestock, setLivestock] = useState<Livestock | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementContent, setAgreementContent] = useState<{ title: string; content: string } | null>(null);
  const [loadingAgreement, setLoadingAgreement] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      try {
        const data = await livestockApi.getById(id);
        if (data) setLivestock(data);
      } catch (error) {
        console.error('Failed to fetch livestock details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleShowAgreement = async () => {
    setLoadingAgreement(true);
    setShowAgreement(true);
    try {
      const data = await agreementApi.get('adoption');
      setAgreementContent(data);
    } catch (error) {
      // 如果没有配置协议，显示默认内容（记录错误用于调试）
      console.debug('获取协议失败，使用默认内容:', error);
      setAgreementContent({
        title: '云端牧场领养协议',
        content: '暂无协议内容，请联系管理员配置。',
      });
    } finally {
      setLoadingAgreement(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setCreatingOrder(true);
    try {
      // 安全修复 F-009：使用 crypto.randomUUID() 替代 Date.now()
    // Date.now() 是可预测的，攻击者可能伪造 clientOrderId
    const clientOrderId = `CLIENT-${crypto.randomUUID().replaceAll('-', '').substring(0, 16).toUpperCase()}`;
    const order = await orderApi.create({ livestockId: id, clientOrderId });
      // 后端返回完整的 order 对象，ID 字段是 id
      // 使用 URL 参数传递 orderId，避免刷新后 state 丢失
      navigate(`/payment?orderId=${order.id}`);
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!livestock) return <div className="flex justify-center items-center h-screen text-slate-400">活体不存在</div>;

  return (
    <PageTransition>
      <div className="min-h-screen pb-32">
        <Navbar title="领养确认" showBack />
        <div className="max-w-screen-xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="premium-card overflow-hidden h-[400px] lg:h-[600px]">
                <img src={livestock.mainImage || livestock.images?.[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={livestock.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="premium-card p-6 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-3"><Icons.Award className="w-5 h-5" /></div>
                  <h5 className="text-xs font-bold mb-1">品质认证</h5>
                  <p className="text-[10px] text-slate-400">纯种优良基因</p>
                </div>
                <div className="premium-card p-6 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-3"><Icons.Leaf className="w-5 h-5" /></div>
                  <h5 className="text-xs font-bold mb-1">绿色生态</h5>
                  <p className="text-[10px] text-slate-400">自然散养环境</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="premium-card p-8 mb-8 flex-1">
                <div className="mb-8">
                  <h3 className="text-4xl font-display font-bold text-brand-primary mb-2">{livestock.name}</h3>
                  <div className="flex items-center gap-1 text-brand-accent">
                    {Array.from({ length: 5 }).map((_, i) => <Icons.Star key={`star-${livestock.id}-${i}`} className="w-4 h-4 fill-current" />)}
                    <span className="text-xs font-bold ml-2">5.0 优质品种</span>
                  </div>
                </div>
                <p className="text-slate-500 leading-relaxed mb-10">{livestock.description}</p>
                <div className="space-y-6 pt-8 border-t border-slate-50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Icons.ShieldCheck className="w-4 h-4" /></div>
                      <span className="text-sm text-slate-500">领养编号</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-400">支付后生成</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Icons.Package className="w-4 h-4" /></div>
                      <span className="text-sm text-slate-500">订单编号</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-400">支付后生成</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Icons.Calendar className="w-4 h-4" /></div>
                      <span className="text-sm text-slate-500">月饲养费</span>
                    </div>
                    <span className="text-sm font-bold text-brand-primary">¥{livestock.monthlyFeedFee}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部固定支付栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            {/* 移动端布局 */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
                    <Icons.Check className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500">同意<button type="button" onClick={handleShowAgreement} className="text-brand-primary cursor-pointer font-bold">《领养协议》</button></span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-brand-primary">¥</span>
                  <span className="text-2xl font-display font-bold text-brand-primary">{livestock.price}</span>
                </div>
              </div>
              <button onClick={handleConfirm} disabled={!agreed || creatingOrder} className={cn("w-full h-12 rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all", agreed && !creatingOrder ? "bg-brand-primary text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")}>
                {creatingOrder ? '处理中...' : '确认领养'}
              </button>
            </div>

            {/* 桌面端布局 */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
                  <Icons.Check className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm text-slate-500">我已阅读并同意 <button type="button" onClick={handleShowAgreement} className="text-brand-primary cursor-pointer font-bold hover:underline">《云端牧场领养协议》</button></span>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">应付总额</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-bold text-brand-primary">¥</span>
                    <span className="text-3xl font-display font-bold text-brand-primary">{livestock.price}</span>
                  </div>
                </div>
                <button onClick={handleConfirm} disabled={!agreed || creatingOrder} className={cn("h-12 px-10 rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all", agreed && !creatingOrder ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/40" : "bg-slate-200 text-slate-400 cursor-not-allowed")}>
                  {creatingOrder ? '处理中...' : '确认领养'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 协议弹窗 */}
        <Modal open={showAgreement} onClose={() => setShowAgreement(false)} title={agreementContent?.title || '领养协议'}>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {loadingAgreement ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : (
              <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
                {agreementContent?.content}
              </div>
            )}
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

// ==================== 支付页 ====================

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { error, success } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [checkingOrder, setCheckingOrder] = useState(true);
  const [orderExpired, setOrderExpired] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const paymentConfig = usePaymentConfig();

  // 从 URL 参数获取 orderId
  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get('orderId');

  // 检查订单状态并获取订单数据
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        console.error('PaymentPage: 没有 orderId 参数');
        error('订单数据不存在，请重新下单');
        navigate('/');
        return;
      }

      try {
        // 获取订单详情
        const order = await orderApi.getById(orderId);
        if (order.status === OrderStatus.PENDING_PAYMENT) {
          // 设置订单数据
          setOrderData({
            orderId: order.id,
            orderNo: order.orderNo,
            livestock: order.livestock,
          });
        } else {
          setOrderExpired(true);
          error('订单已过期或已支付，请返回订单列表查看');
        }
      } catch (err: any) {
        console.error('检查订单状态失败:', err);
        error('获取订单信息失败');
        navigate('/orders');
      } finally {
        setCheckingOrder(false);
      }
    };

    fetchOrderData();
  }, [orderId, navigate, error]);

  const handlePay = async (method: 'alipay' | 'wechat' | 'balance') => {
    if (!orderData?.orderId) {
      error('订单数据不存在，请重新下单');
      navigate('/');
      return;
    }

    if (orderExpired) {
      error('订单已过期，无法支付');
      navigate('/orders');
      return;
    }

    setIsPaying(true);
    try {
      // 支付前再次检查订单状态
      const order = await orderApi.getById(orderData.orderId);
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        error('订单状态已变更，请返回订单列表查看');
        navigate('/orders');
        return;
      }

      const amount = orderData?.livestock?.price || 0;
      console.log('发起支付:', { orderType: 'adoption', orderId: orderData.orderId, paymentMethod: method, amount });
      const result = await paymentApi.create({ orderType: 'adoption', orderId: orderData.orderId, paymentMethod: method, amount });
      console.log('支付结果:', result);

      if (result.payUrl) {
        // 跳转到支付页面
        globalThis.location.href = result.payUrl;
      } else {
        // 余额支付成功，跳转到成功页，使用 replace 避免返回到支付页
        success('支付成功');
        navigate(`/success?orderId=${orderData.orderId}`, { replace: true });
      }
    } catch (err: any) {
      console.error('支付失败:', err);
      error(err.message || '支付失败，请重试');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        <Navbar title="收银台" showBack />
        <div className="max-w-md mx-auto flex flex-col items-center py-16 px-8">
          {/* 检查订单状态中 */}
          {checkingOrder && (
            <div className="flex flex-col items-center py-16">
              <Icons.Loader2 className="w-8 h-8 text-brand-primary animate-spin mb-4" />
              <p className="text-slate-400">正在检查订单状态...</p>
            </div>
          )}
          {/* 订单已过期 */}
          {!checkingOrder && orderExpired && (
            <div className="flex flex-col items-center py-16">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <Icons.AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">订单已过期</h2>
              <p className="text-slate-400 mb-6">该订单已超时取消，请重新下单</p>
              <Button onClick={() => navigate('/orders')}>查看订单列表</Button>
            </div>
          )}
          {/* 正常支付界面 */}
          {!checkingOrder && !orderExpired && (
            <>
              <div className="w-20 h-20 bg-brand-bg rounded-[24px] flex items-center justify-center mb-6 shadow-sm">
                <Icons.CreditCard className="w-10 h-10 text-brand-primary" />
              </div>
              <p className="text-slate-400 text-sm font-medium mb-2">支付金额</p>
              <div className="flex items-baseline gap-1 mb-16">
                <span className="text-xl font-bold text-slate-900">¥</span>
                <h2 className="text-5xl font-display font-bold text-slate-900">{orderData?.livestock?.price || '0.00'}</h2>
              </div>
              <div className="w-full premium-card p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">收款方</span>
                  <span className="text-sm font-bold text-brand-primary">云端牧场智慧平台</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">订单号</span>
                  <span className="text-sm font-mono text-slate-600">{orderData?.orderNo}</span>
                </div>
              </div>
              <div className="w-full mt-8 space-y-3">
                {paymentConfig.loaded ? (
                  <>
                    {paymentConfig.alipayEnabled && (
                      <button onClick={() => handlePay('alipay')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-blue-500 text-blue-600 rounded-2xl font-medium hover:bg-blue-50 transition-colors disabled:opacity-50">
                        <Icons.Alipay className="w-6 h-6" />支付宝支付
                      </button>
                    )}
                    {paymentConfig.wechatEnabled && (
                      <button onClick={() => handlePay('wechat')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-green-500 text-green-600 rounded-2xl font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
                        <Icons.Wechat className="w-6 h-6" />微信支付
                      </button>
                    )}
                    <button onClick={() => handlePay('balance')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-brand-primary text-brand-primary rounded-2xl font-medium hover:bg-brand-primary/5 transition-colors disabled:opacity-50">
                      <Icons.Wallet className="w-6 h-6" />余额支付
                    </button>
                  </>
                ) : (
                  <div className="flex justify-center py-8">
                    <Icons.Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                  </div>
                )}
              </div>
              <p className="mt-8 text-[10px] text-slate-300 flex items-center gap-2"><Icons.ShieldCheck className="w-3 h-3" /> 支付安全加密保障</p>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 支付结果查询页 ====================

const PaymentResultPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'pending' | 'failed' | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  // 使用 ref 保存轮询定时器引用，确保组件卸载时能正确清理
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从URL参数获取支付信息
  const searchParams = new URLSearchParams(location.search);
  const outTradeNo = searchParams.get('out_trade_no');
  const paymentNo = searchParams.get('payment_no');

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!outTradeNo && !paymentNo) {
        // 没有支付参数，跳转到订单列表
        navigate('/orders');
        return;
      }

      try {
        // 查询支付状态
        const paymentIdentifier = paymentNo || outTradeNo;
        if (!paymentIdentifier) {
          throw new Error('缺少支付参数');
        }

        const result = await paymentApi.getStatus(paymentIdentifier);

        if (result.status === 2) {
          // 支付成功
          setPaymentStatus('success');
          setOrderInfo(result);
          success('支付成功！');
        } else if (result.status === 1) {
          // 待支付，轮询查询
          setPaymentStatus('pending');
          let retryCount = 0;
          const maxRetries = 10;

          pollIntervalRef.current = setInterval(async () => {
            retryCount++;
            try {
              const pollResult = await paymentApi.getStatus(paymentIdentifier);
              if (pollResult.status === 2) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setPaymentStatus('success');
                setOrderInfo(pollResult);
                success('支付成功！');
              } else if (pollResult.status === 3 || retryCount >= maxRetries) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                if (pollResult.status === 3) {
                  setPaymentStatus('failed');
                } else {
                  setPaymentStatus('pending');
                  error('支付状态查询超时，请稍后在订单列表查看');
                }
              }
            } catch (e) {
              // 轮询失败时静默处理，不影响用户流程
              console.debug('支付状态轮询:', e);
            }
          }, 2000);
        } else {
          // 支付失败或已关闭
          setPaymentStatus('failed');
        }
      } catch (err: any) {
        setPaymentStatus('failed');
        error(err.message || '查询支付状态失败');
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [outTradeNo, paymentNo, navigate, success, error]);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
          <Icons.Loader2 className="w-12 h-12 text-brand-primary animate-spin mb-4" />
          <p className="text-slate-500">正在查询支付结果...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
        {paymentStatus === 'success' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">支付成功</h2>
            <p className="text-slate-500 mb-6">您的订单已支付完成</p>
            {orderInfo && (
              <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">支付金额</span>
                  <span className="font-bold text-brand-primary">¥{orderInfo.amount}</span>
                </div>
                {orderInfo.paymentNo && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500">支付单号</span>
                    <span className="font-mono text-sm text-slate-600">{orderInfo.paymentNo}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/orders')}>
                查看订单
              </Button>
              <Button onClick={() => navigate('/my-adoptions')}>
                进入牧场
              </Button>
            </div>
          </motion.div>
        )}

        {paymentStatus === 'pending' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.Clock className="w-12 h-12 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">支付处理中</h2>
            <p className="text-slate-500 mb-6">请稍后在订单列表查看支付状态</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/orders')}>
                查看订单
              </Button>
              <Button onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </motion.div>
        )}

        {paymentStatus === 'failed' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.XCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">支付失败</h2>
            <p className="text-slate-500 mb-6">支付遇到问题，请重新尝试</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/orders')}>
                查看订单
              </Button>
              <Button onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

// ==================== 成功页 ====================

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 从 URL 参数获取 orderId
  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get('orderId');

  // 从后端获取订单数据
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        // 没有 orderId，跳转到订单列表
        navigate('/orders');
        return;
      }

      try {
        const order = await orderApi.getById(orderId);
        setOrderData({
          orderId: order.id,
          orderNo: order.orderNo,
          livestock: order.livestock,
        });
      } catch (error) {
        console.error('Failed to fetch order data:', error);
        // 获取失败，跳转到订单列表
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, navigate]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 2500),
      setTimeout(() => setStep(3), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
          <LoadingSpinner />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
        <div className="max-w-screen-xl mx-auto w-full flex flex-col items-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-12">
            <div className="w-24 h-24 bg-brand-primary rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-primary/30">
              <Icons.CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-display font-bold text-brand-primary mb-3">领养成功</h2>
            <p className="text-slate-400 text-sm">您的智慧牧场生活正式开启</p>
          </motion.div>
          <div className="w-full max-w-2xl premium-card p-8 mb-10">
            <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-50">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">领养编号</p>
                <p className="text-lg font-mono font-bold text-brand-primary">{orderData?.orderId || 'ADPT-' + Date.now().toString(36).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">订单状态</p>
                <p className="text-sm font-bold text-green-600">已完成</p>
              </div>
            </div>
            <div className="space-y-8 relative">
              <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-slate-100" />
              {[
                { title: '订单已转入消息队列', desc: '正在同步牧场管理系统...', icon: Icons.Zap },
                { title: '领养详情短信已发送', desc: '请查收您的手机通知', icon: Icons.MessageSquare },
                { title: '领养流程已全部完成', desc: '您可以前往牧场查看', icon: Icons.ShieldCheck }
              ].map((s, i) => (
                <div key={`step-${s.title.slice(0, 4)}-${i}`} className="flex gap-6 relative">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center z-10 transition-colors duration-500", step >= i + 1 ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-slate-100 text-slate-300")}>
                    <s.icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-bold transition-colors duration-500", step >= i + 1 ? "text-slate-900" : "text-slate-300")}>{s.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => navigate('/my-adoptions')} className="w-full max-w-2xl btn-elegant h-16">进入我的牧场</button>
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 我的领养页 ====================

const MyAdoptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [adoptionsData, redemptionsData] = await Promise.all([
          adoptionApi.getMyAdoptions(),
          redemptionApi.getMyRedemptions().catch(() => [])
        ]);
        setAdoptions(adoptionsData);
        setRedemptions(redemptionsData);
      } catch (error) {
        console.error('Failed to fetch adoptions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getRedemptionForAdoption = (adoptionId: string) => {
    return redemptions.find(r => r.adoptionId === adoptionId && (r.status === 1 || r.status === 2));
  };

  // 获取领养状态的 Badge variant
  const getAdoptionBadgeVariant = (status: number): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (status === AdoptionStatus.ACTIVE) return 'success';
    if (status === AdoptionStatus.FEED_OVERDUE || status === AdoptionStatus.EXCEPTION) return 'danger';
    if (status === AdoptionStatus.REDEEMABLE) return 'info';
    if (status === AdoptionStatus.REDEMPTION_PENDING) return 'warning';
    return 'default';
  };

  const getStatusBadge = (status: number, redemption?: any) => {
    // 如果有买断订单且状态是审核通过，显示特殊状态
    if (redemption?.status === 2) {
      return <Badge variant="info">审核通过待支付</Badge>;
    }
    const map: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
      [AdoptionStatus.ACTIVE]: { label: '领养中', variant: 'success' },
      [AdoptionStatus.FEED_OVERDUE]: { label: '饲料费逾期', variant: 'danger' },
      [AdoptionStatus.EXCEPTION]: { label: '异常', variant: 'danger' },
      [AdoptionStatus.REDEEMABLE]: { label: '可买断', variant: 'info' },
      [AdoptionStatus.REDEMPTION_PENDING]: { label: '买断审核中', variant: 'warning' },
      [AdoptionStatus.REDEEMED]: { label: '已买断', variant: 'default' },
      [AdoptionStatus.TERMINATED]: { label: '已终止', variant: 'default' }
    };
    const config = map[status] || { label: getAdoptionStatusText(status), variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <div className="pb-28">
        <Navbar title="我的牧场" />
        <div className="max-w-screen-xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-brand-primary mb-2">牧场概览</h2>
            <p className="text-slate-400 text-sm">您目前有 {adoptions.length} 个活体正在茁壮成长</p>
          </div>
          {adoptions.length === 0 ? (
            <EmptyState icon={<Icons.Package className="w-16 h-16" />} title="暂无领养记录" description="去探索您喜欢的活体吧" action={<Link to="/" className="text-brand-primary font-bold text-sm flex items-center gap-2">去探索 <Icons.ChevronRight className="w-4 h-4" /></Link>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {adoptions.map((item) => {
                const redemption = getRedemptionForAdoption(item.id);
                const canPayRedemption = redemption?.status === 2;
                return (
                  <Card key={item.id} className="p-8" onClick={() => navigate(`/adoption/${item.id}`)}>
                    <div className="flex gap-5 mb-6">
                      <div className="w-20 h-20 rounded-[24px] overflow-hidden shadow-sm flex-shrink-0">
                        <img src={item.livestockSnapshot?.mainImage || item.livestock?.mainImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-xl font-display font-bold text-brand-primary truncate">{item.livestockSnapshot?.name || item.livestock?.name}</h3>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mb-2">ID: {item.adoptionNo}</p>
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(item.status, redemption)}
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>已领养 <b className="text-brand-primary">{item.days || 0}</b> 天</span>
                          <span>已缴 <b className="text-brand-primary">{item.feedMonthsPaid}</b> 月</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}?tab=bills`); }}>饲料费</Button>
                      {canPayRedemption && (
                        <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}`); }}>去支付</Button>
                      )}
                      {!canPayRedemption && (item.status === AdoptionStatus.REDEEMABLE || item.status === AdoptionStatus.ACTIVE) && (
                        <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}/redemption`); }}>申请买断</Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 个人中心页 ====================

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { token, logout, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameForm, setNicknameForm] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const { success, error } = useToast();

  const handleSaveNickname = async () => {
    const trimmedNickname = nicknameForm.trim();
    if (!trimmedNickname) {
      error('昵称不能为空');
      return;
    }
    if (trimmedNickname.length > 20) {
      error('昵称最多20个字符');
      return;
    }

    setSavingNickname(true);
    try {
      const updatedUser = await authApi.updateCurrentUser({ nickname: trimmedNickname });
      setProfile(updatedUser);
      setShowNicknameModal(false);
      success('昵称修改成功');
    } catch (err: any) {
      error(err.message || '修改失败');
    } finally {
      setSavingNickname(false);
    }
  };

  const openNicknameModal = () => {
    setNicknameForm(profile?.nickname || '');
    setShowNicknameModal(true);
  };

  useEffect(() => {
    // 未登录时跳转到登录页
    if (!token && !isAuthenticated) {
      navigate('/auth');
      return;
    }

    const fetchProfile = async () => {
      try {
        const data = await authApi.getCurrentUser();
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        // 如果获取用户信息失败，可能是 token 过期，跳转到登录页
        logout();
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token, isAuthenticated, navigate, logout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg pb-24">
        <div className="relative h-40 bg-brand-primary animate-pulse" />
        <div className="max-w-screen-xl mx-auto px-6 mt-16 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div className="bg-white rounded-2xl p-6 h-32 animate-pulse" />
              <div className="bg-white rounded-2xl p-6 h-48 animate-pulse" />
            </div>
            <div className="space-y-8">
              <div className="bg-white rounded-2xl p-6 h-48 animate-pulse" />
              <div className="bg-red-50/50 rounded-2xl h-16 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 未登录状态显示登录引导
  if (!profile && !isAuthenticated) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-24 h-24 bg-gradient-to-br from-brand-primary to-indigo-600 rounded-[32px] flex items-center justify-center mb-6 shadow-xl shadow-brand-primary/30"
          >
            <Icons.User className="w-12 h-12 text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-display font-bold text-brand-primary mb-2"
          >
            欢迎来到云端牧场
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 mb-8 text-center"
          >
            登录后即可查看个人信息和领养记录
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button className="px-12" size="lg" onClick={() => navigate('/auth')}>立即登录</Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-24">
        {/* 头部区域 */}
        <div className="bg-gradient-to-br from-brand-primary via-indigo-600 to-brand-primary pt-10 pb-20 px-6">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-accent/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              <div className="w-16 h-16 rounded-2xl border-2 border-white/30 overflow-hidden bg-white/20 backdrop-blur-md shadow-lg">
                <img src={profile?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full border-2 border-brand-primary flex items-center justify-center shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold text-white tracking-tight">{profile?.nickname || '智慧牧场主'}</h2>
                <button
                  onClick={openNicknameModal}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Icons.Edit className="w-4 h-4 text-white/70" />
                </button>
              </div>
              <p className="text-sm text-white/70 mt-0.5 font-mono">{profile?.phone || '未绑定手机'}</p>
            </motion.div>
          </div>
        </div>

        {/* 统计卡片 - 独立区域 */}
        <div className="px-6 -mt-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 grid grid-cols-3 gap-4 text-center shadow-lg">
              <Link to="/balance" className="group">
                <p className="text-xl font-display font-bold text-brand-primary group-hover:scale-105 transition-transform">¥{Number.parseFloat(String(profile?.balance || '0')).toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-0.5">余额</p>
              </Link>
              <div className="border-x border-slate-100">
                <p className="text-xl font-display font-bold text-brand-primary">{profile?.stats?.adoptions || 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">领养</p>
              </div>
              <div>
                <p className="text-xl font-display font-bold text-brand-primary">{profile?.stats?.days || 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">天数</p>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* 内容区域 */}
        <div className="max-w-screen-xl mx-auto px-6 mt-6 space-y-6">
          {/* 桌面端统计卡片 */}
          <div className="hidden lg:grid grid-cols-3 gap-6">
            {[
              { value: `¥${Number.parseFloat(String(profile?.balance || '0')).toFixed(2)}`, label: '账户余额', to: '/balance' },
              { value: String(profile?.stats?.adoptions || 0), label: '领养活体', to: '/my-adoptions' },
              { value: String(profile?.stats?.days || 0), label: '领养天数' },
            ].map((item, i) => (
              <motion.div
                key={`stat-${item.label}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Link to={item.to || '#'}>
                  <Card className="p-6 flex flex-col items-center hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                    <p className="text-3xl font-display font-bold text-brand-primary mb-1">{item.value}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{item.label}</p>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 左侧 */}
            <div className="space-y-6">
              {/* 我的订单 */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-lg font-bold text-slate-900">我的订单</h3>
                  <Link to="/orders" className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 hover:text-brand-primary transition-colors">
                    全部订单 <Icons.ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <Card className="p-6 grid grid-cols-3 gap-6">
                  {[
                    { icon: Icons.Wallet, label: '待付款', to: '/orders?status=pending', color: 'text-orange-500' },
                    { icon: Icons.Package, label: '领养中', to: '/orders?status=paid', color: 'text-brand-primary' },
                    { icon: Icons.CheckCircle2, label: '已完成', to: '/orders?status=completed', color: 'text-green-500' }
                  ].map((item) => (
                    <Link key={`order-status-${item.label}`} to={item.to} className="flex flex-col items-center gap-3 group cursor-pointer">
                      <motion.div
                        whileHover={{ scale: 1.1, y: -2 }}
                        className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-sm"
                      >
                        <item.icon className={cn("w-6 h-6", item.color, "group-hover:text-white")} />
                      </motion.div>
                      <span className="text-xs font-bold text-slate-600">{item.label}</span>
                    </Link>
                  ))}
                </Card>
              </motion.section>

              {/* 智慧牧场服务 */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4">智慧牧场服务</h3>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-slate-50">
                    {[
                      { icon: Icons.BookOpen, title: '成长档案', desc: '记录爱宠成长点滴', to: '/growth-records' },
                      { icon: Icons.Headset, title: '专属管家', desc: '1对1贴心养殖指导', to: '/support' }
                    ].map((item) => (
                      <Link key={`service-${item.title}`} to={item.to} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-primary/10 to-indigo-50 flex items-center justify-center text-brand-primary group-hover:from-brand-primary group-hover:to-indigo-600 group-hover:text-white transition-all">
                            <item.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.title}</p>
                            <p className="text-xs text-slate-400">{item.desc}</p>
                          </div>
                        </div>
                        <Icons.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                      </Link>
                    ))}
                  </div>
                </Card>
              </motion.section>
            </div>

            {/* 右侧 */}
            <div className="space-y-6">
              {/* 通用设置 */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4">通用设置</h3>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-slate-50">
                    <Link to="/notifications" className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-primary/10 to-indigo-50 flex items-center justify-center text-brand-primary shadow-sm relative">
                          <Icons.Bell className="w-5 h-5" />
                          <NotificationBadge variant="compact" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">消息中心</span>
                      </div>
                      <Icons.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                    </Link>
                    <Link to="/balance" className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-primary/10 to-indigo-50 flex items-center justify-center text-brand-primary">
                          <Icons.Wallet className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">我的余额</span>
                      </div>
                      <Icons.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                    </Link>
                    <Link to="/security" className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-primary/10 to-indigo-50 flex items-center justify-center text-brand-primary">
                          <Icons.ShieldCheck className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">账户安全</span>
                      </div>
                      <Icons.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                    </Link>
                  </div>
                </Card>
              </motion.section>

              {/* 退出按钮 */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { logout(); navigate('/'); }}
                className="w-full py-4 flex items-center justify-center gap-3 text-red-500 font-bold text-sm bg-red-50/50 rounded-2xl hover:bg-red-50 transition-all shadow-sm border border-red-100/50"
              >
                <Icons.LogOut className="w-5 h-5" />
                退出当前账号
              </motion.button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-300 pb-4 mt-4">云端牧场智慧平台 v2.1.0 · 智慧农业领先品牌</p>
        </div>

        {/* 昵称修改弹窗 */}
        <Modal open={showNicknameModal} onClose={() => setShowNicknameModal(false)} title="修改昵称">
          <div className="p-6">
            <Input
              label="昵称"
              placeholder="请输入昵称"
              value={nicknameForm}
              onChange={(e) => setNicknameForm(e.target.value)}
              maxLength={20}
            />
            <p className="text-xs text-slate-400 mt-2">昵称最多20个字符</p>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowNicknameModal(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSaveNickname} loading={savingNickname}>
                保存
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

// ==================== 账户安全页 ====================

const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();

  // 修改密码
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 修改手机号
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ newPhone: '', code: '' });
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

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

  // 发送验证码
  const handleSendCode = async () => {
    if (!phoneForm.newPhone || !/^1\d{10}$/.test(phoneForm.newPhone)) {
      error('请输入正确的手机号');
      return;
    }
    if (countdown > 0) return;

    try {
      // 使用 reset_password 类型发送换绑手机验证码
      await authApi.sendSmsCode(phoneForm.newPhone, 'reset_password');
      setCountdown(60);
      // 清理之前的定时器
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      success('验证码已发送');
    } catch (err: any) {
      error(err.message || '发送失败');
    }
  };

  // 修改密码
  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      error('请填写完整信息');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      error('新密码至少6位');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      error('两次密码不一致');
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      success('密码修改成功，请重新登录');
      setShowPasswordModal(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      error(err.message || '修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 修改手机号
  const handleChangePhone = async () => {
    if (!phoneForm.newPhone || !/^1\d{10}$/.test(phoneForm.newPhone)) {
      error('请输入正确的手机号');
      return;
    }
    if (!phoneForm.code) {
      error('请输入验证码');
      return;
    }

    setPhoneLoading(true);
    try {
      await authApi.changePhone({
        newPhone: phoneForm.newPhone,
        code: phoneForm.code
      });
      success('手机号修改成功');
      setShowPhoneModal(false);
      setPhoneForm({ newPhone: '', code: '' });
    } catch (err: any) {
      error(err.message || '修改失败');
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">账户安全</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 mt-6 space-y-4">
          {/* 当前账户信息 */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">账户信息</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-slate-500">当前手机号</span>
                <span className="font-medium">{user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-slate-500">登录密码</span>
                <span className="text-green-600 text-sm">已设置</span>
              </div>
            </div>
          </Card>

          {/* 安全设置 */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">安全设置</h3>
            <div className="divide-y divide-slate-50">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Icons.Lock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900">修改密码</p>
                    <p className="text-xs text-slate-400">定期修改密码更安全</p>
                  </div>
                </div>
                <Icons.ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
              <button
                onClick={() => setShowPhoneModal(true)}
                className="w-full py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icons.Smartphone className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900">更换手机号</p>
                    <p className="text-xs text-slate-400">更换绑定的手机号</p>
                  </div>
                </div>
                <Icons.ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </Card>

          {/* 安全提示 */}
          <Card className="p-6 bg-amber-50 border-amber-100">
            <div className="flex gap-4">
              <Icons.AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-amber-800">安全提示</h4>
                <ul className="text-sm text-amber-700 mt-2 space-y-1">
                  <li>• 请勿将密码告知他人</li>
                  <li>• 请勿使用简单密码如123456</li>
                  <li>• 定期更换密码保护账户安全</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* 修改密码弹窗 */}
        <Modal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="修改密码">
          <div className="p-4 space-y-3">
            <Input
              label="原密码"
              type="password"
              placeholder="请输入原密码"
              value={passwordForm.oldPassword}
              onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
            />
            <Input
              label="新密码"
              type="password"
              placeholder="请输入新密码（至少6位）"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
            <Input
              label="确认密码"
              type="password"
              placeholder="请再次输入新密码"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowPasswordModal(false)}>
                取消
              </Button>
              <Button size="sm" className="flex-1" onClick={handleChangePassword} loading={passwordLoading}>
                确认修改
              </Button>
            </div>
          </div>
        </Modal>

        {/* 修改手机号弹窗 */}
        <Modal open={showPhoneModal} onClose={() => setShowPhoneModal(false)} title="更换手机号">
          <div className="p-4 space-y-3">
            <Input
              label="新手机号"
              placeholder="请输入新手机号"
              value={phoneForm.newPhone}
              onChange={e => setPhoneForm({ ...phoneForm, newPhone: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="verification-code">验证码</label>
              <div className="flex gap-2">
                <Input
                  id="verification-code"
                  placeholder="请输入验证码"
                  value={phoneForm.code}
                  onChange={e => setPhoneForm({ ...phoneForm, code: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  className="whitespace-nowrap px-3"
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowPhoneModal(false)}>
                取消
              </Button>
              <Button size="sm" className="flex-1" onClick={handleChangePhone} loading={phoneLoading}>
                确认修改
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

// ==================== 消息页 ====================

const NotificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.getList({ isRead: activeTab === 'unread' ? 0 : undefined }),
        notificationApi.getUnreadCount()
      ]);
      setNotifications(listRes.list || []);
      setUnreadCount(countRes.count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleReadAll = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleCardClick = (n: any) => {
    // 切换展开状态
    setExpandedId(prev => prev === n.id ? null : n.id);
    // 如果未读，标记为已读
    if (n.isRead === 0) {
      markAsRead(n.id);
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === 'order') return <Icons.Package className="w-5 h-5" />;
    if (type === 'feed') return <Icons.Coins className="w-5 h-5" />;
    if (type === 'redemption') return <Icons.CheckCircle2 className="w-5 h-5" />;
    if (type === 'balance') return <Icons.Wallet className="w-5 h-5" />;
    return <Icons.Bell className="w-5 h-5" />;
  };

  const getTypeColor = (type: string) => {
    if (type === 'order') return 'bg-blue-100 text-blue-600';
    if (type === 'feed') return 'bg-orange-100 text-orange-600';
    if (type === 'redemption') return 'bg-green-100 text-green-600';
    if (type === 'balance') return 'bg-cyan-100 text-cyan-600';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Icons.ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold text-slate-900">消息中心</h1>
            <button onClick={handleReadAll} className="text-sm text-brand-primary font-medium" disabled={unreadCount === 0}>全部已读</button>
          </div>
          <div className="flex gap-2 px-6 pb-4">
            {[
              { key: 'all', label: '全部消息' },
              { key: 'unread', label: '未读消息', count: unreadCount }
            ].map(item => (
              <button key={item.key} onClick={() => setActiveTab(item.key as any)} className={cn('px-4 py-2 rounded-full text-sm font-medium transition-colors relative', activeTab === item.key ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600')}>
                {item.label}
                {item.count !== undefined && item.count > 0 ? <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{item.count > 9 ? '9+' : item.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 mt-4">
          {notifications.length === 0 ? (
            <EmptyState icon={<Icons.MessageSquare className="w-16 h-16" />} title={activeTab === 'unread' ? '暂无未读消息' : '暂无消息'} />
          ) : (
            <div className="space-y-3">
              {notifications.map(n => {
                const isExpanded = expandedId === n.id;
                const isUnread = n.isRead === 0;
                return (
                  <Card
                    key={n.id}
                    className={cn('p-4 cursor-pointer transition-all', isUnread ? 'bg-blue-50/50 border-blue-100' : '', isExpanded ? 'ring-2 ring-brand-primary/20' : '')}
                    onClick={() => handleCardClick(n)}
                  >
                    <div className="flex gap-4">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', getTypeColor(n.type))}>
                        {getTypeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-slate-900 truncate pr-2">{n.title}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isUnread && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                            <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed" style={isExpanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {n.content}
                        </p>
                        {n.content && n.content.length > 50 && (
                          <span className="text-xs text-brand-primary mt-1 inline-block">{isExpanded ? '收起' : '展开'}</span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 成长档案页 ====================

const GrowthRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      navigate('/auth');
      return;
    }

    const fetchAdoptions = async () => {
      try {
        const data = await adoptionApi.getMyAdoptions();
        setAdoptions(data || []);
      } catch (error) {
        console.error('Failed to fetch adoptions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdoptions();
  }, [token, isAuthenticated, navigate]);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg pb-8">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
            <div className="flex items-center px-6 py-4">
              <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Icons.ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold text-slate-900 ml-4">成长档案</h1>
            </div>
          </div>
          <div className="p-6">
            <LoadingSpinner />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* 头部 */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 ml-4">成长档案</h1>
          </div>
        </div>

        <div className="p-6">
          {adoptions.length === 0 ? (
            <EmptyState
              icon={<Icons.BookOpen className="w-12 h-12" />}
              title="暂无成长档案"
              description="领养活体后即可查看成长档案"
              action={
                <Button variant="outline" onClick={() => navigate('/')}>
                  去领养
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {adoptions.map((adoption) => {
                const livestock = adoption.livestockSnapshot as any;
                const startDate = new Date(adoption.startDate);
                const now = new Date();
                const days = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <motion.div
                    key={adoption.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/adoption/${adoption.id}`)}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  >
                    {/* 卡片头部 */}
                    <div className="flex gap-4 p-4 border-b border-slate-50">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                        <img
                          src={livestock?.mainImage || '/placeholder.jpg'}
                          alt={livestock?.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{livestock?.name || '未知活体'}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">{adoption.adoptionNo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={getAdoptionBadgeVariant(adoption.status)}>
                            {getAdoptionStatusText(adoption.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* 时间线 */}
                    <div className="p-4 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-500">领养时间线</span>
                        <span className="text-sm font-bold text-brand-primary">已领养 {days} 天</span>
                      </div>

                      {/* 进度条 */}
                      <div className="relative">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-primary to-indigo-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (adoption.feedMonthsPaid / (adoption.redemptionMonths - 1)) * 100)}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-400">
                          <span>已缴 {adoption.feedMonthsPaid} 月</span>
                          <span>买断需 {adoption.redemptionMonths - 1} 月</span>
                        </div>
                      </div>
                    </div>

                    {/* 重要事件 */}
                    <div className="p-4 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Icons.Calendar className="w-4 h-4" />
                        <span>领养日期：{startDate.toLocaleDateString('zh-CN')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                        <Icons.Coins className="w-4 h-4" />
                        <span>月饲料费：¥{livestock?.monthlyFeedFee || 0}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 专属管家页 ====================

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const siteConfig = useSiteConfig();
  const { success } = useToast();

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* 头部 */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 ml-4">专属管家</h1>
          </div>
        </div>

        <div className="p-6">
          {/* 服务介绍 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-brand-primary to-indigo-600 rounded-2xl p-6 text-white mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Icons.Headset className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">1对1贴心服务</h2>
                <p className="text-white/70 text-sm">专业养殖指导，全程陪伴</p>
              </div>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              我们的专属管家团队随时为您提供专业的养殖指导和问题解答服务，让您的云养殖之旅更加顺畅。
            </p>
          </motion.div>

          {/* 联系方式 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-50">
              <h3 className="font-bold text-slate-900">联系方式</h3>
            </div>

            {/* 电话 */}
            {siteConfig.contactPhone && (
              <a
                href={`tel:${siteConfig.contactPhone}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                    <Icons.Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">客服电话</p>
                    <p className="text-sm text-slate-500">{siteConfig.contactPhone}</p>
                  </div>
                </div>
                <Icons.ChevronRight className="w-5 h-5 text-slate-300" />
              </a>
            )}

            {/* 微信 */}
            {siteConfig.contactWechat && (
              <div className="flex items-center justify-between p-4 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                    <Icons.Wechat className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">客服微信</p>
                    <p className="text-sm text-slate-500">{siteConfig.contactWechat}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(siteConfig.contactWechat);
                    success('微信号已复制');
                  }}
                  className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-lg text-sm font-medium hover:bg-brand-primary/20 transition-colors"
                >
                  复制
                </button>
              </div>
            )}

            {/* 邮箱 */}
            {siteConfig.contactEmail && (
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <Icons.Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">客服邮箱</p>
                    <p className="text-sm text-slate-500">{siteConfig.contactEmail}</p>
                  </div>
                </div>
                <Icons.ChevronRight className="w-5 h-5 text-slate-300" />
              </a>
            )}

            {/* 无联系方式 */}
            {!siteConfig.contactPhone && !siteConfig.contactWechat && !siteConfig.contactEmail && (
              <div className="p-8 text-center">
                <Icons.Headset className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">暂无联系方式</p>
                <p className="text-sm text-slate-300 mt-1">请联系管理员配置</p>
              </div>
            )}
          </motion.div>

          {/* 服务时间 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
          >
            <div className="flex items-center gap-3">
              <Icons.Clock className="w-5 h-5 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900">服务时间</p>
                <p className="text-sm text-slate-500">工作日 9:00-18:00，节假日可能延迟回复</p>
              </div>
            </div>
          </motion.div>

          {/* 常见问题 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <h3 className="font-bold text-slate-900 mb-3">常见问题</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {[
                { q: '如何查看我的领养状态？', a: '在「我的牧场」页面可以查看所有领养记录和当前状态' },
                { q: '饲料费如何缴纳？', a: '进入领养详情页，点击「缴纳饲料费」即可在线支付' },
                { q: '如何申请买断？', a: '领养期满后，在领养详情页点击「申请买断」提交申请' },
              ].map((item, i) => (
                <div key={`faq-${item.q.slice(0, 6)}-${i}`} className="p-4 border-b border-slate-50 last:border-b-0">
                  <p className="font-medium text-slate-900 text-sm">{item.q}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 后台管理登录页 ====================

// 使用独立的登录页面组件
const AdminLoginPageWrapper: React.FC = () => {
  // 动态导入以避免循环依赖
  const [LoginPage, setLoginPage] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import('./pages/admin/AdminLoginPage').then(module => {
      setLoginPage(() => module.default);
    });
  }, []);

  if (!LoginPage) return <LoadingSpinner />;
  return <LoginPage />;
};

// ==================== 管理后台路由守卫 ====================

const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const adminToken = localStorage.getItem('admin_token');

  // 检查 Token 是否有效
  if (!adminToken) {
    return <Navigate to="/admin-login" replace />;
  }

  // 检查 Token 是否过期
  try {
    const payload = JSON.parse(atob(adminToken.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('adminInfo');
      return <Navigate to="/admin-login" replace />;
    }
  } catch {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('adminInfo');
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
};

// ==================== 用户路由守卫 ====================

const UserProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  // 检查 Token 是否过期
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return <Navigate to="/auth" replace />;
    }
  } catch {
    // Token 解析失败，清除并跳转
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

// ==================== 主应用 ====================

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // 安全修复 (F-C03): 使用 sessionStorage 替代 localStorage
    // sessionStorage 在标签页关闭后自动清除，比 localStorage 更安全
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setInitializing(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    // 安全修复 (F-C03): 使用 sessionStorage 存储
    sessionStorage.setItem('token', newToken);
    // 仅存储必要的用户信息，不存储敏感字段
    sessionStorage.setItem('user', JSON.stringify({
      id: newUser.id,
      phone: newUser.phone,
      nickname: newUser.nickname,
      avatar: newUser.avatar,
      status: newUser.status,
    }));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  // 使用 useMemo 避免不必要的重渲染
  const authContextValue = useMemo(
    () => ({ user, token, isAuthenticated: !!token, login, logout }),
    [user, token, login, logout]
  );

  // 初始化时显示加载状态，避免闪烁或跳转问题
  if (initializing) {
    return (
      <div className="w-full min-h-screen bg-brand-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <SiteConfigProvider>
      <AuthContext.Provider value={authContextValue}>
        <Router>
          <div className="w-full min-h-screen bg-brand-bg relative overflow-x-hidden">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/details/:id" element={<UserProtectedRoute><DetailsPage /></UserProtectedRoute>} />
                <Route path="/payment" element={<UserProtectedRoute><PaymentPage /></UserProtectedRoute>} />
                <Route path="/payment-result" element={<UserProtectedRoute><PaymentResultPage /></UserProtectedRoute>} />
                <Route path="/success" element={<UserProtectedRoute><SuccessPage /></UserProtectedRoute>} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/admin-login" element={<AdminLoginPageWrapper />} />
                {/* 用户需要登录才能访问的路由 */}
                <Route path="/my-adoptions" element={<UserProtectedRoute><MyAdoptionsPage /></UserProtectedRoute>} />
                <Route path="/profile" element={<UserProtectedRoute><ProfilePage /></UserProtectedRoute>} />
                <Route path="/balance" element={<UserProtectedRoute><Suspense fallback={<LoadingSpinner />}><BalancePage /></Suspense></UserProtectedRoute>} />
                <Route path="/notifications" element={<UserProtectedRoute><NotificationPage /></UserProtectedRoute>} />
                <Route path="/security" element={<UserProtectedRoute><SecurityPage /></UserProtectedRoute>} />
                <Route path="/growth-records" element={<UserProtectedRoute><GrowthRecordsPage /></UserProtectedRoute>} />
                <Route path="/support" element={<UserProtectedRoute><SupportPage /></UserProtectedRoute>} />
                <Route path="/orders" element={<UserProtectedRoute><Suspense fallback={<LoadingSpinner />}><OrdersPage /></Suspense></UserProtectedRoute>} />
                <Route path="/adoption/:id" element={<Suspense fallback={<LoadingSpinner />}><UserProtectedRoute><AdoptionDetailPage /></UserProtectedRoute></Suspense>} />
                <Route path="/adoption/:id/redemption" element={<Suspense fallback={<LoadingSpinner />}><UserProtectedRoute><RedemptionPage /></UserProtectedRoute></Suspense>} />
                <Route path="/feed-bill/:id" element={<Suspense fallback={<LoadingSpinner />}><UserProtectedRoute><FeedBillDetailPage /></UserProtectedRoute></Suspense>} />
                {/* 管理后台需要管理员登录 */}
                <Route path="/admin/*" element={<AdminProtectedRoute><Suspense fallback={<LoadingSpinner />}><AdminPage /></Suspense></AdminProtectedRoute>} />
              </Routes>
            </AnimatePresence>
            <GlobalTabBar />
          </div>
        </Router>
      </AuthContext.Provider>
    </SiteConfigProvider>
  );
}
