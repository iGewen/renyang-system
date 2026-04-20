import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icons, useToast } from '../../components/ui';
import { adminApi } from '../../services/api';
import { cn } from '../../lib/utils';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // 强制修改密码状态
  const [needChangePassword, setNeedChangePassword] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // 密码强度指示器
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const result = await adminApi.login({ username, password });

      // 检查是否需要强制修改密码
      if (result.admin?.forceChangePassword) {
        setAdminData(result);
        setNeedChangePassword(true);
        setOldPassword(password); // 预填原密码
      } else {
        // 保存登录信息 - 使用 sessionStorage 替代 localStorage（关闭浏览器标签页即清除）
        sessionStorage.setItem('admin_token', result.token);
        sessionStorage.setItem('admin_info', JSON.stringify({
          id: result.admin.id,
          username: result.admin.username,
          name: result.admin.name,
          role: result.admin.role,
          // 不存储敏感字段如 avatar 等
        }));

        // 如果选择了记住我，保存用户名
        if (rememberMe) {
          localStorage.setItem('admin_remembered_username', username);
        } else {
          localStorage.removeItem('admin_remembered_username');
        }

        // 跳转到管理后台
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  // 计算密码强度 - 使用 useCallback 避免每次渲染创建新函数
  const calculatePasswordStrength = React.useCallback((pwd: string) => {
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  }, []);

  // 密码强度相关辅助函数
  const getPasswordStrengthBarColor = (strength: number, level: number): string => {
    if (strength >= level) {
      if (strength <= 2) return "bg-red-400";
      if (strength <= 3) return "bg-yellow-400";
      return "bg-green-400";
    }
    return "bg-slate-200";
  };

  const getPasswordStrengthTextColor = (strength: number): string => {
    if (strength <= 2) return "text-red-500";
    if (strength <= 3) return "text-yellow-500";
    return "text-green-500";
  };

  const getPasswordStrengthText = (strength: number): string => {
    if (strength <= 2) return '弱';
    if (strength <= 3) return '中';
    return '强';
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setChangingPassword(true);
    try {
      // 先保存 token 以便调用修改密码接口
      sessionStorage.setItem('admin_token', adminData.token);
      await adminApi.updatePassword({ oldPassword, newPassword });

      // 清除状态，重新登录
      sessionStorage.removeItem('admin_token');
      setNeedChangePassword(false);
      setAdminData(null);
      setError('');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // 提示用户重新登录
      success('密码修改成功，请使用新密码重新登录');
    } catch (err: any) {
      // 修改失败时清除 token
      sessionStorage.removeItem('admin_token');
      setError(err.message || '修改密码失败');
    } finally {
      setChangingPassword(false);
    }
  };

  // 页面加载时检查是否有记住的用户名
  useEffect(() => {
    const remembered = localStorage.getItem('admin_remembered_username');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  // 监听密码变化
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(newPassword));
  }, [newPassword, calculatePasswordStrength]);

  // 背景动画元素
  const FloatingShape = ({ delay, duration, className }: { delay: number; duration: number; className: string }) => (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 0.15,
        scale: 1,
        y: [0, -20, 0],
      }}
      transition={{
        delay,
        duration,
        y: {
          repeat: Infinity,
          duration: duration * 2,
          ease: "easeInOut"
        }
      }}
      className={className}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-bg via-indigo-50/50 to-brand-bg relative overflow-hidden">
      {/* 装饰性背景元素 */}
      <FloatingShape
        delay={0}
        duration={2}
        className="absolute top-20 left-10 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl"
      />
      <FloatingShape
        delay={0.5}
        duration={2.5}
        className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-brand-accent/10 blur-3xl"
      />
      <FloatingShape
        delay={1}
        duration={3}
        className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-indigo-400/10 blur-3xl"
      />

      {/* 网格背景 */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(to right, #6366F1 1px, transparent 1px),
                           linear-gradient(to bottom, #6366F1 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* 登录卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 min-h-screen flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md">
          {/* Logo 和标题 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-8"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary to-indigo-600 mb-5 shadow-xl shadow-brand-primary/30"
            >
              <Icons.LayoutDashboard className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-slate-800 mb-2"
            >
              {needChangePassword ? '首次登录' : '牧场管理后台'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 text-sm"
            >
              {needChangePassword ? '请修改初始密码后继续使用' : '云端牧场 · 智慧农业管理系统'}
            </motion.p>
          </motion.div>

          {/* 登录表单 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-white/50"
          >
            <AnimatePresence mode="wait">
              {needChangePassword ? (
                <motion.div
                  key="change-password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* 强制修改密码提示 */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50 rounded-xl p-4 flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Icons.ShieldCheck className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-700">安全提示</p>
                      <p className="text-xs text-orange-600 mt-1">首次登录需要修改初始密码，请设置新密码后继续使用。</p>
                    </div>
                  </motion.div>

                  {/* 原密码 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="old-password">原密码</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                        <Icons.Lock className="w-5 h-5" />
                      </div>
                      <input
                        id="old-password"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all duration-200"
                        placeholder="请输入原密码"
                      />
                    </div>
                  </div>

                  {/* 新密码 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="new-password">新密码</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                        <Icons.Key className="w-5 h-5" />
                      </div>
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all duration-200"
                        placeholder="请输入新密码（至少6位）"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {/* 密码强度指示器 */}
                    {newPassword && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={cn(
                                "h-1.5 rounded-full flex-1 transition-all duration-300",
                                getPasswordStrengthBarColor(passwordStrength, level)
                              )}
                            />
                          ))}
                        </div>
                        <span className={cn(
                          "text-xs font-medium",
                          getPasswordStrengthTextColor(passwordStrength)
                        )}>
                          {getPasswordStrengthText(passwordStrength)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 确认密码 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="confirm-password">确认密码</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                        <Icons.Lock className="w-5 h-5" />
                      </div>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={cn(
                          "w-full bg-slate-50/80 border rounded-xl py-3.5 pl-12 pr-12 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 outline-none transition-all duration-200",
                          confirmPassword && newPassword !== confirmPassword
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : "border-slate-200 focus:border-brand-primary focus:ring-brand-primary/20"
                        )}
                        placeholder="请再次输入新密码"
                      />
                      {confirmPassword && newPassword === confirmPassword && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
                          <Icons.Check className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">密码不一致</p>
                    )}
                  </div>

                  {/* 错误提示 */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <Icons.AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-sm text-red-600">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 按钮组 */}
                  <div className="flex gap-3 pt-2">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setNeedChangePassword(false);
                        setAdminData(null);
                        setError('');
                      }}
                      className="flex-1 py-3.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      返回登录
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: changingPassword ? 1 : 1.02 }}
                      whileTap={{ scale: changingPassword ? 1 : 0.98 }}
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className={cn(
                        "flex-1 py-3.5 rounded-xl font-semibold text-white transition-all duration-200",
                        "bg-gradient-to-r from-orange-500 to-amber-500",
                        "shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40",
                        "disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none",
                        "flex items-center justify-center gap-2"
                      )}
                    >
                      {changingPassword ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          处理中...
                        </>
                      ) : (
                        <>
                          <Icons.Check className="w-5 h-5" />
                          确认修改
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  {/* 用户名 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="username">用户名</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                        <Icons.User className="w-5 h-5" />
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all duration-200"
                        placeholder="请输入用户名"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {/* 密码 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="password">密码</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                        <Icons.Lock className="w-5 h-5" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all duration-200"
                        placeholder="请输入密码"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* 记住我 */}
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={() => setRememberMe(!rememberMe)}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center",
                          rememberMe
                            ? "bg-brand-primary border-brand-primary"
                            : "border-slate-300 group-hover:border-brand-primary/50"
                        )}
                      >
                        <AnimatePresence>
                          {rememberMe && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              <Icons.Check className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className="ml-2.5 text-sm text-slate-500 group-hover:text-slate-700 transition-colors">
                        记住用户名
                      </span>
                    </label>
                  </div>

                  {/* 错误提示 */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <Icons.AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-sm text-red-600">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 登录按钮 */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.99 }}
                    className={cn(
                      "w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200",
                      "bg-gradient-to-r from-brand-primary to-indigo-600",
                      "shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40",
                      "disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        登录中...
                      </>
                    ) : (
                      <>
                        <Icons.LogIn className="w-5 h-5" />
                        登录管理后台
                      </>
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 底部链接 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center"
          >
            <motion.button
              whileHover={{ x: -4 }}
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-brand-primary text-sm transition-colors inline-flex items-center gap-2"
            >
              <Icons.ArrowLeft className="w-4 h-4" />
              返回首页
            </motion.button>
          </motion.div>

          {/* 版权信息 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <p className="text-slate-300 text-xs">
              © {new Date().getFullYear()} 云端牧场 · All Rights Reserved
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
