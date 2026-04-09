import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icons, PageTransition, Input, Button } from '../components/ui';
import { authApi } from '../services/api';

interface AuthPageProps {
  onLogin: (token: string, user: any) => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'wechat-bind';

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginType, setLoginType] = useState<'password' | 'code'>('code');

  // 表单状态
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 验证码倒计时
  const [countdown, setCountdown] = useState(0);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || !/^1\d{10}$/.test(phone)) {
      setErrors({ phone: '请输入正确的手机号' });
      return;
    }

    if (countdown > 0) return;

    try {
      const type = mode === 'register' ? 'register' : mode === 'forgot' ? 'reset_password' : 'login';
      await authApi.sendSmsCode(phone, type);
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
      setErrors({});
    } catch (error: any) {
      setErrors({ code: error.message || '发送失败，请重试' });
    }
  };

  // 登录
  const handleLogin = async () => {
    const newErrors: Record<string, string> = {};
    if (!phone || !/^1\d{10}$/.test(phone)) {
      newErrors.phone = '请输入正确的手机号';
    }
    if (loginType === 'password' && !password) {
      newErrors.password = '请输入密码';
    }
    if (loginType === 'code' && !code) {
      newErrors.code = '请输入验证码';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      let result;
      if (loginType === 'password') {
        result = await authApi.loginByPassword({ phone, password });
      } else {
        result = await authApi.loginByCode({ phone, code });
      }
      onLogin(result.token, result.user);
      navigate('/');
    } catch (error: any) {
      setErrors({ submit: error.message || '登录失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const handleRegister = async () => {
    const newErrors: Record<string, string> = {};
    if (!phone || !/^1\d{10}$/.test(phone)) {
      newErrors.phone = '请输入正确的手机号';
    }
    if (!code) {
      newErrors.code = '请输入验证码';
    }
    if (!password || password.length < 6) {
      newErrors.password = '密码至少6位';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次密码不一致';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.register({ phone, code, password });
      onLogin(result.token, result.user);
      navigate('/');
    } catch (error: any) {
      setErrors({ submit: error.message || '注册失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!phone || !/^1\d{10}$/.test(phone)) {
      newErrors.phone = '请输入正确的手机号';
    }
    if (!code) {
      newErrors.code = '请输入验证码';
    }
    if (!password || password.length < 6) {
      newErrors.password = '密码至少6位';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ phone, code, newPassword: password });
      setMode('login');
      setErrors({});
    } catch (error: any) {
      setErrors({ submit: error.message || '重置密码失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 微信登录
  const handleWechatLogin = async () => {
    // TODO: 实现微信登录
    alert('微信登录功能开发中');
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex flex-col">
        {/* 头部 */}
        <div className="p-6">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
          >
            <Icons.ArrowLeft className="w-5 h-5 text-brand-primary" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 px-6 pb-8">
          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">欢迎回来</h1>
                  <p className="text-slate-500">登录您的云端牧场账号</p>
                </div>

                {/* 登录方式切换 */}
                <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setLoginType('code')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${loginType === 'code' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                  >
                    验证码登录
                  </button>
                  <button
                    onClick={() => setLoginType('password')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${loginType === 'password' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                  >
                    密码登录
                  </button>
                </div>

                <div className="space-y-4">
                  <Input
                    label="手机号"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    icon={<Icons.Smartphone className="w-5 h-5" />}
                    error={errors.phone}
                  />

                  {loginType === 'password' ? (
                    <Input
                      label="密码"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      icon={<Icons.Lock className="w-5 h-5" />}
                      suffix={
                        <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                          {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                        </button>
                      }
                      error={errors.password}
                    />
                  ) : (
                    <Input
                      label="验证码"
                      placeholder="请输入验证码"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      icon={<Icons.Key className="w-5 h-5" />}
                      suffix={
                        <button
                          onClick={handleSendCode}
                          disabled={countdown > 0}
                          className="text-brand-primary font-medium text-sm disabled:text-slate-300"
                        >
                          {countdown > 0 ? `${countdown}s` : '获取验证码'}
                        </button>
                      }
                      error={errors.code}
                    />
                  )}
                </div>

                {errors.submit && (
                  <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>
                )}

                <div className="flex justify-between items-center mt-4 text-sm">
                  <button onClick={() => setMode('forgot')} className="text-slate-500">
                    忘记密码？
                  </button>
                  <button onClick={() => setMode('register')} className="text-brand-primary font-medium">
                    注册账号
                  </button>
                </div>

                <Button
                  className="w-full mt-6"
                  size="lg"
                  onClick={handleLogin}
                  loading={loading}
                >
                  登录
                </Button>

                {/* 微信登录 */}
                <div className="mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400">其他登录方式</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <button
                    onClick={handleWechatLogin}
                    className="w-full flex items-center justify-center gap-3 py-3 border border-green-500 text-green-600 rounded-2xl font-medium hover:bg-green-50 transition-colors"
                  >
                    <Icons.Wechat className="w-5 h-5" />
                    微信登录
                  </button>
                </div>
              </motion.div>
            )}

            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">创建账号</h1>
                  <p className="text-slate-500">注册成为云端牧场会员</p>
                </div>

                <div className="space-y-4">
                  <Input
                    label="手机号"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    icon={<Icons.Smartphone className="w-5 h-5" />}
                    error={errors.phone}
                  />

                  <Input
                    label="验证码"
                    placeholder="请输入验证码"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    icon={<Icons.Key className="w-5 h-5" />}
                    suffix={
                      <button
                        onClick={handleSendCode}
                        disabled={countdown > 0}
                        className="text-brand-primary font-medium text-sm disabled:text-slate-300"
                      >
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </button>
                    }
                    error={errors.code}
                  />

                  <Input
                    label="设置密码"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请设置登录密码（至少6位）"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    icon={<Icons.Lock className="w-5 h-5" />}
                    suffix={
                      <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                        {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                      </button>
                    }
                    error={errors.password}
                  />

                  <Input
                    label="确认密码"
                    type="password"
                    placeholder="请再次输入密码"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    icon={<Icons.Lock className="w-5 h-5" />}
                    error={errors.confirmPassword}
                  />
                </div>

                {errors.submit && (
                  <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>
                )}

                <div className="flex justify-center items-center mt-4 text-sm">
                  <span className="text-slate-500">已有账号？</span>
                  <button onClick={() => setMode('login')} className="text-brand-primary font-medium ml-1">
                    立即登录
                  </button>
                </div>

                <Button
                  className="w-full mt-6"
                  size="lg"
                  onClick={handleRegister}
                  loading={loading}
                >
                  注册
                </Button>
              </motion.div>
            )}

            {mode === 'forgot' && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">重置密码</h1>
                  <p className="text-slate-500">通过手机验证码重置您的密码</p>
                </div>

                <div className="space-y-4">
                  <Input
                    label="手机号"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    icon={<Icons.Smartphone className="w-5 h-5" />}
                    error={errors.phone}
                  />

                  <Input
                    label="验证码"
                    placeholder="请输入验证码"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    icon={<Icons.Key className="w-5 h-5" />}
                    suffix={
                      <button
                        onClick={handleSendCode}
                        disabled={countdown > 0}
                        className="text-brand-primary font-medium text-sm disabled:text-slate-300"
                      >
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </button>
                    }
                    error={errors.code}
                  />

                  <Input
                    label="新密码"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请设置新密码（至少6位）"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    icon={<Icons.Lock className="w-5 h-5" />}
                    suffix={
                      <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                        {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                      </button>
                    }
                    error={errors.password}
                  />
                </div>

                {errors.submit && (
                  <p className="text-red-500 text-sm mt-4 text-center">{errors.submit}</p>
                )}

                <div className="flex justify-center items-center mt-4 text-sm">
                  <span className="text-slate-500">想起密码了？</span>
                  <button onClick={() => setMode('login')} className="text-brand-primary font-medium ml-1">
                    返回登录
                  </button>
                </div>

                <Button
                  className="w-full mt-6"
                  size="lg"
                  onClick={handleResetPassword}
                  loading={loading}
                >
                  重置密码
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
};
