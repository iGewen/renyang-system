import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, StatCard, Modal, Input, ConfirmDialog, EmptyState } from './components/ui';
import { cn } from './lib/utils';
import type { Livestock, Adoption, FeedBill, User } from './types';
import { livestockApi, adoptionApi, orderApi, paymentApi, userApi, balanceApi, notificationApi, authApi, adminApi } from './services/api';

// Lazy load pages for better performance
const OrdersPage = lazy(() => import('./pages/order/OrdersPage'));
const AdoptionDetailPage = lazy(() => import('./pages/adoption/AdoptionDetailPage'));
const FeedBillDetailPage = lazy(() => import('./pages/feed-bill/FeedBillDetailPage'));
const RedemptionPage = lazy(() => import('./pages/redemption/RedemptionPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

// ==================== 认证上下文 ====================

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return { user: null, token: null, isAuthenticated: false, login: () => {}, logout: () => {} };
  }
  return context;
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
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      setErrors({});
    } catch (error: any) {
      setErrors({ code: error.message || '发送失败' });
    }
  };

  const handleLogin = async () => {
    const newErrors: Record<string, string> = {};
    if (!phone || !/^1\d{10}$/.test(phone)) newErrors.phone = '请输入正确的手机号';
    if (loginType === 'password' && !password) newErrors.password = '请输入密码';
    if (loginType === 'code' && !code) newErrors.code = '请输入验证码';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

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
    const newErrors: Record<string, string> = {};
    if (!phone || !/^1\d{10}$/.test(phone)) newErrors.phone = '请输入正确的手机号';
    if (!code) newErrors.code = '请输入验证码';
    if (!password || password.length < 6) newErrors.password = '密码至少6位';
    if (password !== confirmPassword) newErrors.confirmPassword = '两次密码不一致';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

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

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!phone || !/^1\d{10}$/.test(phone)) newErrors.phone = '请输入正确的手机号';
    if (!code) newErrors.code = '请输入验证码';
    if (!password || password.length < 6) newErrors.password = '密码至少6位';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

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
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
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
      </div>
    </PageTransition>
  );
};

// ==================== 首页 ====================

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [livestockList, setLivestockList] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return (
    <PageTransition>
      <div className="pb-32">
        <Navbar title="云端牧场" transparent />
        <div className="max-w-screen-xl mx-auto px-6 pt-2 pb-8">
          <header className="mb-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-[10px] font-bold uppercase tracking-wider mb-4">
              <Icons.Zap className="w-3 h-3" /> 智慧农业新体验
            </motion.div>
            <h2 className="text-4xl font-display font-bold text-brand-primary leading-tight mb-4">在云端，<br />拥有属于您的牧场</h2>
            <p className="text-slate-500 text-sm max-w-[80%] leading-relaxed">连接自然与科技，每一份领养都是对生命的尊重与呵护。</p>
          </header>
          {loading ? <LoadingSpinner /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {livestockList.map((item, index) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} onClick={() => navigate(`/details/${item.id}`)} className="premium-card overflow-hidden group cursor-pointer">
                  <div className="relative h-64 overflow-hidden">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                      <div>
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1 block">{item.type === 'sheep' ? '草原之王' : item.type === 'chicken' ? '林间精灵' : '沙漠明珠'}</span>
                        <h3 className="text-2xl font-display font-bold text-white">{item.name}</h3>
                      </div>
                      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-4 py-2 text-white">
                        <span className="text-xs opacity-70">¥</span><span className="text-xl font-bold">{item.price}</span>
                      </div>
                    </div>
                    <button className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                      <Icons.Heart className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-slate-500 leading-relaxed mb-6">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-6">
                        <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">月饲料</span><span className="text-sm font-bold text-brand-primary">¥{item.monthlyFeedFee}</span></div>
                        <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">买断期</span><span className="text-sm font-bold text-brand-primary">{item.redemptionMonths}个月</span></div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-brand-bg border border-slate-100 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <Icons.ChevronRight className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        <TabBar />
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
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform">
              <Icons.ArrowLeft className="w-5 h-5 text-brand-primary" />
            </button>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary tracking-tight">{title}</h1>
        </div>
        {rightContent || (
          <div className="flex gap-3">
            <Link to="/notifications" className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-brand-primary transition-colors relative">
              <Icons.Bell className="w-5 h-5" />
              <NotificationBadge />
            </Link>
            <Link to={isAuthenticated ? "/profile" : "/auth"} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/20 flex items-center justify-center text-white hover:scale-105 transition-transform">
              <Icons.User className="w-5 h-5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const NotificationBadge: React.FC = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    notificationApi.getUnreadCount().then(res => setCount(res.count)).catch(() => {});
  }, []);
  if (count === 0) return null;
  return <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{count > 9 ? '9+' : count}</span>;
};

// ==================== 底部导航 ====================

const TabBar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-md md:max-w-lg mx-auto px-6 pointer-events-auto">
        <div className="bg-brand-primary/95 backdrop-blur-md rounded-[40px] flex justify-around py-5 safe-area-bottom shadow-2xl shadow-brand-primary/40 border border-white/10">
          <Link to="/" className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", isActive('/') ? "text-white scale-110" : "text-white/40 hover:text-white/60")}>
            <Icons.Home className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wider uppercase">探索</span>
          </Link>
          <Link to="/my-adoptions" className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", isActive('/my-adoptions') ? "text-white scale-110" : "text-white/40 hover:text-white/60")}>
            <Icons.Package className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wider uppercase">牧场</span>
          </Link>
          <Link to="/notifications" className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", isActive('/notifications') ? "text-white scale-110" : "text-white/40 hover:text-white/60")}>
            <div className="relative">
              <Icons.Bell className="w-6 h-6" />
              <NotificationBadge />
            </div>
            <span className="text-[10px] font-bold tracking-wider uppercase">消息</span>
          </Link>
          <Link to="/profile" className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", isActive('/profile') ? "text-white scale-110" : "text-white/40 hover:text-white/60")}>
            <Icons.User className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wider uppercase">我的</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

// ==================== 详情页 ====================

const DetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [livestock, setLivestock] = useState<Livestock | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [agreed, setAgreed] = useState(false);

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

  const handleConfirm = async () => {
    if (!id) return;
    setCreatingOrder(true);
    try {
      const { orderId, orderNo } = await orderApi.create({ livestockId: id, clientOrderId: `CLIENT-${Date.now()}` });
      navigate('/payment', { state: { orderId, orderNo, livestock } });
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
      <div className="pb-32">
        <Navbar title="领养确认" showBack />
        <div className="max-w-screen-xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="premium-card overflow-hidden h-[400px] lg:h-[600px]">
                <img src={livestock.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={livestock.name} />
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
                    {[...Array(5)].map((_, i) => <Icons.Star key={i} className="w-4 h-4 fill-current" />)}
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
              <div className="px-2">
                <div className="mb-6 flex items-center gap-3">
                  <button onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
                    <Icons.Check className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm text-slate-500">我已阅读并同意 <span className="text-brand-primary cursor-pointer font-bold hover:underline">《云端牧场领养协议》</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">应付总额</p>
                    <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-brand-primary">¥</span><span className="text-4xl font-display font-bold text-brand-primary">{livestock.price}</span></div>
                  </div>
                  <button onClick={handleConfirm} disabled={!agreed || creatingOrder} className={cn("btn-elegant h-16 px-12 flex items-center gap-3 text-lg transition-all", (!agreed || creatingOrder) && "opacity-50 cursor-not-allowed")}>
                    {creatingOrder ? '处理中...' : '确认领养'} <Icons.ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 支付页 ====================

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state as any;
  const [isPaying, setIsPaying] = useState(false);

  const handlePay = async (method: 'alipay' | 'wechat' | 'balance') => {
    if (!orderData?.orderId) return;
    setIsPaying(true);
    try {
      const result = await paymentApi.create({ orderType: 'adoption', orderId: orderData.orderId, paymentMethod: method });
      if (result.payUrl) {
        window.location.href = result.payUrl;
      } else {
        navigate('/success', { state: orderData });
      }
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        <Navbar title="收银台" showBack />
        <div className="max-w-md mx-auto flex flex-col items-center py-16 px-8">
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
            <button onClick={() => handlePay('alipay')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-blue-500 text-blue-600 rounded-2xl font-medium hover:bg-blue-50 transition-colors disabled:opacity-50">
              <Icons.Alipay className="w-6 h-6" />支付宝支付
            </button>
            <button onClick={() => handlePay('wechat')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-green-500 text-green-600 rounded-2xl font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
              <Icons.Wechat className="w-6 h-6" />微信支付
            </button>
            <button onClick={() => handlePay('balance')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-brand-primary text-brand-primary rounded-2xl font-medium hover:bg-brand-primary/5 transition-colors disabled:opacity-50">
              <Icons.Wallet className="w-6 h-6" />余额支付
            </button>
          </div>
          <p className="mt-8 text-[10px] text-slate-300 flex items-center gap-2"><Icons.ShieldCheck className="w-3 h-3" /> 支付安全加密保障</p>
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 成功页 ====================

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state as any;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 2500),
      setTimeout(() => setStep(3), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

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
                <div key={i} className="flex gap-6 relative">
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdoptions = async () => {
      try {
        const data = await adoptionApi.getMyAdoptions();
        setAdoptions(data);
      } catch (error) {
        console.error('Failed to fetch adoptions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAdoptions();
  }, []);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
      active: { label: '领养中', variant: 'success' },
      feed_overdue: { label: '饲料费逾期', variant: 'danger' },
      exception: { label: '异常', variant: 'danger' },
      redeemable: { label: '可买断', variant: 'info' },
      redemption_pending: { label: '买断审核中', variant: 'warning' },
      redeemed: { label: '已买断', variant: 'default' },
      terminated: { label: '已终止', variant: 'default' }
    };
    const config = map[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <div className="pb-32">
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
              {adoptions.map((item) => (
                <Card key={item.id} className="p-8" onClick={() => navigate(`/adoption/${item.id}`)}>
                  <div className="flex gap-5 mb-6">
                    <div className="w-20 h-20 rounded-[24px] overflow-hidden shadow-sm flex-shrink-0">
                      <img src={item.livestockSnapshot?.mainImage || item.livestock?.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xl font-display font-bold text-brand-primary truncate">{item.livestockSnapshot?.name || item.livestock?.name}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mb-2">ID: {item.adoptionNo}</p>
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span>已领养 <b className="text-brand-primary">{item.days || 0}</b> 天</span>
                        <span>已缴 <b className="text-brand-primary">{item.feedMonthsPaid}</b> 月</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}/feed-bills`); }}>饲料费</Button>
                    {(item.status === 'redeemable' || item.status === 'active') && (
                      <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}/redemption`); }}>申请买断</Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <TabBar />
      </div>
    </PageTransition>
  );
};

// ==================== 个人中心页 ====================

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingSpinner />;

  // 未登录状态显示登录引导
  if (!profile && !isAuthenticated) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
          <div className="w-24 h-24 bg-brand-primary rounded-[32px] flex items-center justify-center mb-6 shadow-lg shadow-brand-primary/30">
            <Icons.User className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold text-brand-primary mb-2">欢迎来到云端牧场</h2>
          <p className="text-slate-500 mb-8 text-center">登录后即可查看个人信息和领养记录</p>
          <Button className="px-12" size="lg" onClick={() => navigate('/auth')}>立即登录</Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-48">
        <div className="relative h-80 bg-brand-primary">
          <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-accent rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
          </div>
          <div className="relative z-10 px-8 pt-20 flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-[32px] border-4 border-white/20 overflow-hidden bg-white/10 backdrop-blur-md">
                <img src={profile?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-accent rounded-full border-2 border-brand-primary flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-display font-bold text-white mb-1 tracking-tight">{profile?.nickname || '智慧牧场主'}</h2>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] text-white/80 font-bold border border-white/10 uppercase tracking-widest">黄金会员</span>
                <span className="text-xs text-white/60 font-mono tracking-tighter">{profile?.phone || '未绑定手机'}</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-8 translate-y-1/2 lg:hidden">
            <Card className="p-6 grid grid-cols-3 gap-4 text-center">
              <Link to="/balance">
                <p className="text-2xl font-display font-bold text-brand-primary">¥{profile?.balance?.toFixed(0) || '0'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">账户余额</p>
              </Link>
              <div className="border-x border-slate-100">
                <p className="text-2xl font-display font-bold text-brand-primary">{profile?.stats?.adoptions || 0}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">领养活体</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-brand-primary">{profile?.stats?.days || 0}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">领养天数</p>
              </div>
            </Card>
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto px-8 mt-24 lg:mt-16 space-y-12">
          <div className="hidden lg:grid grid-cols-3 gap-8">
            <Link to="/balance">
              <Card className="p-10 flex flex-col items-center hover:shadow-md transition-shadow">
                <p className="text-4xl font-display font-bold text-brand-primary mb-2">¥{profile?.balance?.toFixed(0) || '0'}</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">账户余额</p>
              </Card>
            </Link>
            <Card className="p-10 flex flex-col items-center">
              <p className="text-4xl font-display font-bold text-brand-primary">{profile?.stats?.adoptions || 0}</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">领养活体</p>
            </Card>
            <Card className="p-10 flex flex-col items-center">
              <p className="text-4xl font-display font-bold text-brand-primary">{profile?.stats?.days || 0}</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">领养天数</p>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-12">
              <section>
                <div className="flex justify-between items-end mb-6">
                  <h3 className="text-2xl font-display font-bold text-slate-900">我的订单</h3>
                  <Link to="/orders" className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 hover:text-brand-primary transition-colors">全部订单 <Icons.ChevronRight className="w-3 h-3" /></Link>
                </div>
                <Card className="p-10 grid grid-cols-3 gap-8">
                  {[
                    { icon: Icons.Wallet, label: '待付款', to: '/orders?status=pending' },
                    { icon: Icons.Package, label: '领养中', to: '/orders?status=paid' },
                    { icon: Icons.History, label: '已完成', to: '/orders?status=completed' }
                  ].map((item, i) => (
                    <Link key={i} to={item.to} className="flex flex-col items-center gap-4 group cursor-pointer">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-sm">
                        <item.icon className="w-7 h-7" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 tracking-tight">{item.label}</span>
                    </Link>
                  ))}
                </Card>
              </section>
              <section>
                <h3 className="text-2xl font-display font-bold text-slate-900 mb-6">智慧牧场服务</h3>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-slate-50">
                    {[
                      { icon: Icons.BookOpen, title: '成长档案', desc: '记录爱宠成长点滴', to: '/growth-records' },
                      { icon: Icons.Headset, title: '专属管家', desc: '1对1贴心养殖指导', to: '/support' }
                    ].map((item, i) => (
                      <Link key={i} to={item.to} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-full bg-brand-bg flex items-center justify-center text-brand-primary shadow-sm"><item.icon className="w-7 h-7" /></div>
                          <div><p className="text-lg font-bold text-slate-900">{item.title}</p><p className="text-xs text-slate-400">{item.desc}</p></div>
                        </div>
                        <Icons.ChevronRight className="w-6 h-6 text-slate-300" />
                      </Link>
                    ))}
                  </div>
                </Card>
              </section>
            </div>
            <div className="space-y-12">
              <section>
                <h3 className="text-2xl font-display font-bold text-slate-900 mb-6">通用设置</h3>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-slate-50">
                    <Link to="/notifications" className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-full bg-brand-bg flex items-center justify-center text-brand-primary shadow-sm"><Icons.Bell className="w-7 h-7" /></div>
                        <span className="text-lg font-bold text-slate-700">消息中心</span>
                      </div>
                      <Icons.ChevronRight className="w-6 h-6 text-slate-300" />
                    </Link>
                    <Link to="/balance" className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-full bg-brand-bg flex items-center justify-center text-brand-primary shadow-sm"><Icons.Wallet className="w-7 h-7" /></div>
                        <span className="text-lg font-bold text-slate-700">我的余额</span>
                      </div>
                      <Icons.ChevronRight className="w-6 h-6 text-slate-300" />
                    </Link>
                    <Link to="/admin" className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent"><Icons.LayoutDashboard className="w-7 h-7" /></div>
                        <span className="text-lg font-bold text-slate-700">进入后台管理</span>
                      </div>
                      <Icons.ChevronRight className="w-6 h-6 text-slate-300" />
                    </Link>
                  </div>
                </Card>
              </section>
              <button onClick={() => { logout(); navigate('/'); }} className="w-full py-8 flex items-center justify-center gap-4 text-red-500 font-bold text-lg bg-red-50/50 rounded-[32px] hover:bg-red-50 transition-all shadow-sm">
                <Icons.LogOut className="w-6 h-6" /> 退出当前账号
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-slate-300 pb-12">云端牧场智慧平台 v2.1.0 · 智慧农业领先品牌</p>
        </div>
        <TabBar />
      </div>
    </PageTransition>
  );
};

// ==================== 余额页 ====================

const BalancePage: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');

  useEffect(() => {
    balanceApi.get().then(res => setBalance(res.balance)).catch(() => {});
  }, []);

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) { alert('请输入正确的金额'); return; }
    try {
      const result = await balanceApi.recharge(amount, paymentMethod);
      if (result.payUrl) window.location.href = result.payUrl;
      else { alert('充值成功'); setShowRecharge(false); setBalance(prev => prev + amount); }
    } catch (error: any) {
      alert(error.message || '充值失败');
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        <div className="bg-brand-primary text-white px-6 pt-6 pb-12 rounded-b-[32px]">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Icons.ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold">我的余额</h1>
            <div className="w-10" />
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm mb-2">账户余额（元）</p>
            <p className="text-5xl font-display font-bold">{balance.toFixed(2)}</p>
          </div>
        </div>
        <div className="px-6 -mt-6">
          <Button className="w-full" size="lg" onClick={() => setShowRecharge(true)} icon={<Icons.Plus className="w-5 h-5" />}>充值余额</Button>
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">交易记录</h2>
            <EmptyState icon={<Icons.History className="w-16 h-16" />} title="暂无交易记录" />
          </div>
        </div>
        {showRecharge && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowRecharge(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="relative w-full max-w-lg bg-white rounded-t-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">充值余额</h3>
                <button onClick={() => setShowRecharge(false)} className="text-slate-400"><Icons.X className="w-6 h-6" /></button>
              </div>
              <Input label="充值金额" type="number" placeholder="请输入充值金额" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} icon={<Icons.Coins className="w-5 h-5" />} />
              <div className="flex gap-3 mt-4">
                {[50, 100, 200, 500].map(amount => (
                  <button key={amount} onClick={() => setRechargeAmount(amount.toString())} className={cn('flex-1 py-2 rounded-xl text-sm font-medium transition-colors', rechargeAmount === amount.toString() ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600')}>¥{amount}</button>
                ))}
              </div>
              <div className="mt-6">
                <p className="text-sm text-slate-500 mb-3">支付方式</p>
                <div className="space-y-2">
                  {[
                    { key: 'alipay', icon: Icons.Alipay, label: '支付宝', color: 'text-blue-500' },
                    { key: 'wechat', icon: Icons.Wechat, label: '微信支付', color: 'text-green-500' }
                  ].map(item => (
                    <button key={item.key} onClick={() => setPaymentMethod(item.key as any)} className={cn('w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors', paymentMethod === item.key ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100')}>
                      <item.icon className={cn('w-6 h-6', item.color)} />
                      <span className="font-medium">{item.label}</span>
                      {paymentMethod === item.key && <Icons.Check className="w-5 h-5 text-brand-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full mt-6" size="lg" onClick={handleRecharge}>确认充值</Button>
            </motion.div>
          </div>
        )}
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

  useEffect(() => {
    Promise.all([notificationApi.getList({ isRead: activeTab === 'unread' ? 0 : undefined }), notificationApi.getUnreadCount()])
      .then(([listRes, countRes]) => { setNotifications(listRes.list); setUnreadCount(countRes.count); })
      .catch(() => {});
  }, [activeTab]);

  const handleReadAll = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {}
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
                {item.count && item.count > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{item.count > 9 ? '9+' : item.count}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 mt-4">
          {notifications.length === 0 ? (
            <EmptyState icon={<Icons.MessageSquare className="w-16 h-16" />} title={activeTab === 'unread' ? '暂无未读消息' : '暂无消息'} />
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <Card key={n.id} className={cn('p-4', !n.isRead && 'bg-blue-50/50 border-blue-100')}>
                  <div className="flex gap-4">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', n.type === 'order' ? 'bg-blue-100 text-blue-600' : n.type === 'feed' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600')}>
                      <Icons.Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-slate-900 truncate">{n.title}</h3>
                        {!n.isRead && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2" />}
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2 mb-2">{n.content}</p>
                      <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

// ==================== 后台管理登录页 ====================

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    try {
      const result = await adminApi.login({ username, password });
      localStorage.setItem('admin_token', result.token);
      localStorage.setItem('admin_info', JSON.stringify(result.admin));
      // 使用 window.location.href 强制刷新页面，避免白屏
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-primary rounded-[20px] flex items-center justify-center mx-auto mb-4">
              <Icons.LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-brand-primary mb-2">后台管理系统</h1>
            <p className="text-slate-400 text-sm">请使用管理员账号登录</p>
          </div>
          <div className="space-y-4">
            <Input placeholder="请输入用户名" value={username} onChange={e => setUsername(e.target.value)} icon={<Icons.User className="w-5 h-5" />} />
            <Input placeholder="请输入密码" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} icon={<Icons.Lock className="w-5 h-5" />}
              suffix={<button onClick={() => setShowPassword(!showPassword)} className="text-slate-400">{showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}</button>} />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleLogin} loading={loading}>登录</Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
};

// ==================== 主应用 ====================

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // 检查本地存储的登录状态
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      <Router>
        <div className="w-full min-h-screen bg-brand-bg relative overflow-x-hidden">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/details/:id" element={<DetailsPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route path="/my-adoptions" element={<MyAdoptionsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/balance" element={<BalancePage />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/orders" element={<Suspense fallback={<LoadingSpinner />}><OrdersPage /></Suspense>} />
              <Route path="/adoption/:id" element={<Suspense fallback={<LoadingSpinner />}><AdoptionDetailPage /></Suspense>} />
              <Route path="/adoption/:id/redemption" element={<Suspense fallback={<LoadingSpinner />}><RedemptionPage /></Suspense>} />
              <Route path="/feed-bill/:id" element={<Suspense fallback={<LoadingSpinner />}><FeedBillDetailPage /></Suspense>} />
              <Route path="/admin-login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<Suspense fallback={<LoadingSpinner />}><AdminPage /></Suspense>} />
            </Routes>
          </AnimatePresence>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}
