import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icons, Input, Button } from '../../components/ui';
import { adminApi } from '../../services/api';
import { cn } from '../../lib/utils';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
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
        // 保存登录信息
        localStorage.setItem('admin_token', result.token);
        localStorage.setItem('admin_info', JSON.stringify(result.admin));

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
      localStorage.setItem('admin_token', adminData.token);
      await adminApi.updatePassword({ oldPassword, newPassword });

      // 清除状态，重新登录
      localStorage.removeItem('admin_token');
      setNeedChangePassword(false);
      setAdminData(null);
      setError('');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // 提示用户重新登录
      alert('密码修改成功，请使用新密码重新登录');
    } catch (err: any) {
      // 修改失败时清除 token
      localStorage.removeItem('admin_token');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 渐变圆形装饰 */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

        {/* 网格背景 */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* 登录卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 mb-4 shadow-lg shadow-violet-500/25"
          >
            <Icons.LayoutDashboard className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white mb-2"
          >
            {!needChangePassword ? '牧场管理后台' : '首次登录'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-400 text-sm"
          >
            {!needChangePassword ? '云端牧场 · 智慧农业管理系统' : '请修改初始密码后继续使用'}
          </motion.p>
        </div>

        {/* 登录表单 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700/50"
        >
          {!needChangePassword ? (
            <form onSubmit={handleLogin} className="space-y-6">
              {/* 用户名 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">用户名</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icons.User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="请输入用户名"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">密码</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icons.Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-3 pl-12 pr-12 text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 记住我 */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <div
                    className={cn(
                      "w-5 h-5 rounded border transition-colors flex items-center justify-center",
                      rememberMe
                        ? "bg-violet-500 border-violet-500"
                        : "border-slate-600 group-hover:border-slate-500"
                    )}
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    {rememberMe && <Icons.Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    记住用户名
                  </span>
                </label>
              </div>

              {/* 错误提示 */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3"
                >
                  <Icons.AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-300">{error}</span>
                </motion.div>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3 rounded-xl font-medium text-white transition-all duration-200",
                  "bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600",
                  "shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-violet-500/25",
                  "flex items-center justify-center gap-2"
                )}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <Icons.LogIn className="w-5 h-5" />
                    登录
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* 强制修改密码提示 */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
                <Icons.AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-300">安全提示</p>
                  <p className="text-xs text-orange-400/80 mt-1">首次登录需要修改初始密码，请设置新密码后继续使用。</p>
                </div>
              </div>

              {/* 原密码 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">原密码</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icons.Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="请输入原密码"
                  />
                </div>
              </div>

              {/* 新密码 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">新密码</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icons.Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="请输入新密码（至少6位）"
                  />
                </div>
              </div>

              {/* 确认密码 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">确认密码</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icons.Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="请再次输入新密码"
                  />
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3"
                >
                  <Icons.AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-300">{error}</span>
                </motion.div>
              )}

              {/* 按钮组 */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNeedChangePassword(false);
                    setAdminData(null);
                    setError('');
                  }}
                  className="flex-1 py-3 rounded-xl font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >
                  返回登录
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-medium text-white transition-all duration-200",
                    "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600",
                    "shadow-lg shadow-orange-500/25",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {changingPassword ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Icons.Check className="w-5 h-5" />
                      确认修改
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* 底部链接 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors inline-flex items-center gap-2"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            返回首页
          </button>
        </motion.div>

        {/* 版权信息 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <p className="text-slate-600 text-xs">
            © 2024 云端牧场 · All Rights Reserved
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
