/**
 * SecurityPage.tsx - 账户安全页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition, Icons, Card, Modal, Input, Button, useToast } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';

const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
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
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // 使用 change_phone 类型发送换绑手机验证码
      await authApi.sendSmsCode(phoneForm.newPhone, 'change_phone');
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
      // 清除登录状态并跳转到登录页
      logout();
      navigate('/auth', { state: { mode: 'login' } });
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
      // 获取最新用户信息并刷新
      const updatedUser = await authApi.getCurrentUser();
      refreshUser(updatedUser);
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

export default SecurityPage;