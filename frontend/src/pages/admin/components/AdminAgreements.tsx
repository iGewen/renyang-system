import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Card, Modal, Input, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';

interface Agreement {
  id: string;
  agreementKey: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const AdminAgreements: React.FC = () => {
  const toast = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null | undefined>(undefined);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [formData, setFormData] = useState({
    agreementKey: '',
    title: '',
    content: '',
  });

  // 预设协议类型 - 项目中所有需要协议的地方
  const presetAgreements = [
    { key: 'user', title: '用户协议', description: '用户注册/登录时需要同意' },
    { key: 'privacy', title: '隐私政策', description: '用户注册/登录时需要同意' },
    { key: 'adoption', title: '领养协议', description: '用户领养活体时需要同意' },
    { key: 'feed', title: '饲料费协议', description: '用户缴纳饲料费时需要同意' },
    { key: 'redemption', title: '买断协议', description: '用户申请买断时需要同意' },
  ];

  useEffect(() => {
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    try {
      const res = await adminApi.getAgreements();
      setAgreements(res || []);
    } catch (error) {
      console.error('Failed to load agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agreement?: Agreement) => {
    if (agreement) {
      setEditingKey(agreement.agreementKey);
      setFormData({
        agreementKey: agreement.agreementKey,
        title: agreement.title,
        content: agreement.content,
      });
    } else {
      setEditingKey(null); // null 表示添加新协议
      setFormData({
        agreementKey: '',
        title: '',
        content: '',
      });
    }
  };

  const handleSelectPreset = (key: string) => {
    const preset = presetAgreements.find(p => p.key === key);
    const existing = agreements.find(a => a.agreementKey === key);
    setEditingKey(key);
    setFormData({
      agreementKey: key,
      title: existing?.title || preset?.title || '',
      content: existing?.content || '',
    });
  };

  const handleCancel = () => {
    setEditingKey(undefined);
    setFormData({ agreementKey: '', title: '', content: '' });
  };

  const handleSave = async () => {
    if (!formData.agreementKey || !formData.title || !formData.content) {
      toast.warning('请填写完整信息');
      return;
    }

    setSaving(true);
    try {
      await adminApi.saveAgreement(formData);
      toast.success('保存成功');
      setEditingKey(undefined);
      setFormData({ agreementKey: '', title: '', content: '' });
      loadAgreements();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    setConfirmAction({
      message: '确定要删除该协议吗？',
      onConfirm: async () => {
        try {
          await adminApi.deleteAgreement(key);
          toast.success('删除成功');
          loadAgreements();
        } catch (error: any) {
          toast.error(error.message || '删除失败');
        }
      },
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-end items-center mb-6">
        <Button onClick={() => handleEdit()}>
          <Icons.Plus className="w-4 h-4 mr-2" />
          添加协议
        </Button>
      </div>

      {/* 预设协议快捷入口 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-500 mb-3">快捷编辑（点击编辑对应协议）</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {presetAgreements.map(preset => {
            const existing = agreements.find(a => a.agreementKey === preset.key);
            return (
              <button
                key={preset.key}
                onClick={() => handleSelectPreset(preset.key)}
                className={cn(
                  'p-3 rounded-xl text-left transition-all',
                  existing
                    ? 'bg-brand-primary/10 border-2 border-brand-primary'
                    : 'bg-slate-50 border-2 border-slate-100 hover:border-brand-primary/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{preset.title}</span>
                  {existing && <Icons.Check className="w-4 h-4 text-brand-primary" />}
                </div>
                <p className="text-xs text-slate-500">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 编辑表单 */}
      {editingKey !== undefined && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {agreements.some(a => a.agreementKey === editingKey) ? '编辑协议' : '添加协议'}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="协议键名（英文标识）"
                value={formData.agreementKey}
                onChange={e => setFormData({ ...formData, agreementKey: e.target.value })}
                placeholder="如：user_agreement"
                disabled={agreements.some(a => a.agreementKey === editingKey)}
              />
              <Input
                label="协议标题"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="如：用户协议"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="agreement-content">协议内容</label>
              <textarea
                id="agreement-content"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
                rows={15}
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                placeholder="请输入协议内容，支持HTML格式"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleCancel}>取消</Button>
              <Button onClick={handleSave} loading={saving}>保存</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 协议列表 */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">协议键名</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">标题</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">更新时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map(agreement => (
                <tr key={agreement.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{agreement.agreementKey}</td>
                  <td className="py-3 px-4 font-medium">{agreement.title}</td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {new Date(agreement.updatedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(agreement)}
                        className="text-brand-primary hover:underline text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(agreement.agreementKey)}
                        className="text-red-500 hover:underline text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agreements.length === 0 && (
            <EmptyState icon={<Icons.FileText className="w-12 h-12" />} title="暂无协议" description="点击上方按钮添加协议" />
          )}
        </div>
      </Card>

      {/* 通用确认弹窗 */}
      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="确认操作">
        <div className="space-y-4">
          <p className="text-slate-600">{confirmAction?.message}</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
            <Button onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}>确认</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
