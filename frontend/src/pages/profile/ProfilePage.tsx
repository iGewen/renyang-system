/**
 * ProfilePage.tsx - 个人中心页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Card, Button, Modal, Input, useToast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import type { User } from '../../types';
import { NotificationBadge } from '../../components/layout/NotificationBadge';

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
              <p className="text-sm text-white/70 mt-0.5 font-mono">{profile?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未绑定手机'}</p>
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

export default ProfilePage;