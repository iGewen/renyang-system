import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Badge, Card, Modal, Input, EmptyState, useToast } from '../../../components/ui';
import { adminApi } from '../../../services/api';
import type { Livestock, LivestockType } from '../../../types';

export const AdminLivestock: React.FC = () => {
  const toast = useToast();
  const [types, setTypes] = useState<LivestockType[]>([]);
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showLivestockModal, setShowLivestockModal] = useState(false);
  const [editingType, setEditingType] = useState<LivestockType | null>(null);
  const [editingLivestock, setEditingLivestock] = useState<Livestock | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [typeForm, setTypeForm] = useState({ name: '', description: '' });
  const [livestockForm, setLivestockForm] = useState({
    name: '', typeId: '', price: '', monthlyFeedFee: '', redemptionMonths: '12', stock: '', description: '', image: ''
  });

  useEffect(() => {
    Promise.all([adminApi.getLivestockTypes(), adminApi.getLivestockList()])
      .then(([typesRes, livestockRes]) => {
        setTypes(typesRes);
        setLivestock(livestockRes.list || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveType = async () => {
    try {
      if (editingType) {
        await adminApi.updateLivestockType(editingType.id, typeForm);
      } else {
        await adminApi.createLivestockType(typeForm);
      }
      const typesRes = await adminApi.getLivestockTypes();
      setTypes(typesRes);
      setShowTypeModal(false);
      setEditingType(null);
      setTypeForm({ name: '', description: '' });
      toast.success('保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    }
  };

  const handleDeleteType = async (id: string) => {
    setConfirmAction({
      message: '确定要删除此类型吗？',
      onConfirm: async () => {
        try {
          await adminApi.deleteLivestockType(id);
          setTypes(types.filter(t => t.id !== id));
          toast.success('删除成功');
        } catch (error: any) {
          toast.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleSaveLivestock = async () => {
    try {
      if (livestockForm.image) {
        const imageUrl = livestockForm.image.trim();
        const isRelativePath = imageUrl.startsWith('/');
        const isHttpsUrl = imageUrl.startsWith('https://');
        const isDataUrl = imageUrl.startsWith('data:image/');
        if (!isRelativePath && !isHttpsUrl && !isDataUrl) {
          toast.error('图片URL格式不正确：只允许相对路径（如 /uploads/xxx）或 HTTPS 链接');
          return;
        }
        if (imageUrl.toLowerCase().startsWith('javascript:')) {
          toast.error('图片URL包含不安全的协议');
          return;
        }
      }

      const data = {
        name: livestockForm.name,
        typeId: livestockForm.typeId,
        price: Number.parseFloat(livestockForm.price),
        monthlyFeedFee: Number.parseFloat(livestockForm.monthlyFeedFee),
        redemptionMonths: Number.parseInt(livestockForm.redemptionMonths),
        stock: Number.parseInt(livestockForm.stock),
        description: livestockForm.description,
        mainImage: livestockForm.image || undefined,
        images: livestockForm.image ? [livestockForm.image] : [],
      };
      if (editingLivestock) {
        await adminApi.updateLivestock(editingLivestock.id, data);
      } else {
        await adminApi.createLivestock(data);
      }
      const livestockRes = await adminApi.getLivestockList();
      setLivestock(livestockRes.list || []);
      setShowLivestockModal(false);
      setEditingLivestock(null);
      setLivestockForm({ name: '', typeId: '', price: '', monthlyFeedFee: '', redemptionMonths: '12', stock: '', description: '', image: '' });
      toast.success('保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 2 : 1;
      const statusStr = newStatus === 1 ? 'on_sale' : 'off_sale';
      await adminApi.updateLivestockStatus(id, statusStr);
      setLivestock(livestock.map(l => l.id === id ? { ...l, status: newStatus } : l));
      toast.success('状态更新成功');
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleDeleteLivestock = async (id: string) => {
    setConfirmAction({
      message: '确定要删除这个活体吗？',
      onConfirm: async () => {
        try {
          await adminApi.deleteLivestock(id);
          setLivestock(livestock.filter(l => l.id !== id));
          toast.success('删除成功');
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
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setEditingType(null); setTypeForm({ name: '', description: '' }); setShowTypeModal(true); }}>添加类型</Button>
          <Button onClick={() => { setEditingLivestock(null); setLivestockForm({ name: '', typeId: '', price: '', monthlyFeedFee: '', redemptionMonths: '12', stock: '', description: '', image: '' }); setShowLivestockModal(true); }}>添加活体</Button>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">活体类型</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {types.map(type => (
            <div key={type.id} className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
              <div>
                <p className="font-medium">{type.name}</p>
                <p className="text-xs text-slate-400">{(type as any).description || '暂无描述'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingType(type); setTypeForm({ name: type.name, description: (type as any).description || '' }); setShowTypeModal(true); }} className="text-brand-primary text-sm">编辑</button>
                <button onClick={() => handleDeleteType(type.id)} className="text-red-500 text-sm">删除</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">活体列表</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">编号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">类型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">价格</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">库存</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {livestock.map(item => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm text-slate-600">{item.livestockNo || '-'}</td>
                  <td className="py-3 px-4">{item.name}</td>
                  <td className="py-3 px-4">{types.find(t => t.id === item.typeId)?.name || '-'}</td>
                  <td className="py-3 px-4">¥{item.price}</td>
                  <td className="py-3 px-4">{item.stock}</td>
                  <td className="py-3 px-4">
                    <Badge variant={item.status === 1 ? 'success' : 'default'}>{item.status === 1 ? '在售' : '下架'}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingLivestock(item); setLivestockForm({ name: item.name, typeId: item.typeId, price: String(item.price), monthlyFeedFee: String(item.monthlyFeedFee), redemptionMonths: String(item.redemptionMonths || 12), stock: String(item.stock), description: item.description || '', image: item.mainImage || '' }); setShowLivestockModal(true); }} className="text-brand-primary text-sm">编辑</button>
                      <button onClick={() => handleToggleStatus(item.id, item.status)} className="text-blue-600 text-sm">{item.status === 1 ? '下架' : '上架'}</button>
                      <button onClick={() => handleDeleteLivestock(item.id)} className="text-red-500 text-sm">删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {livestock.length === 0 && <EmptyState icon={<Icons.Package className="w-12 h-12" />} title="暂无活体数据" />}
        </div>
      </Card>

      <Modal open={showTypeModal} onClose={() => setShowTypeModal(false)} title={editingType ? '编辑类型' : '添加类型'}>
        <div className="space-y-4 p-6">
          <Input label="类型名称" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="请输入类型名称" />
          <Input label="描述" value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="请输入描述（选填）" />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowTypeModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSaveType}>保存</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLivestockModal} onClose={() => setShowLivestockModal(false)} title={editingLivestock ? '编辑活体' : '添加活体'}>
        <div className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
          <Input label="名称" value={livestockForm.name} onChange={e => setLivestockForm({ ...livestockForm, name: e.target.value })} placeholder="请输入活体名称" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="livestock-type">类型</label>
            <select id="livestock-type" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none" value={livestockForm.typeId} onChange={e => setLivestockForm({ ...livestockForm, typeId: e.target.value })}>
              <option value="">请选择类型</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Input label="价格" type="number" value={livestockForm.price} onChange={e => setLivestockForm({ ...livestockForm, price: e.target.value })} placeholder="请输入价格" />
          <Input label="月饲料费" type="number" value={livestockForm.monthlyFeedFee} onChange={e => setLivestockForm({ ...livestockForm, monthlyFeedFee: e.target.value })} placeholder="请输入月饲料费" />
          <Input label="库存" type="number" value={livestockForm.stock} onChange={e => setLivestockForm({ ...livestockForm, stock: e.target.value })} placeholder="请输入库存数量" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="livestock-image">图片URL</label>
            <input id="livestock-image" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none" value={livestockForm.image} onChange={e => setLivestockForm({ ...livestockForm, image: e.target.value })} placeholder="/uploads/xxx.jpg 或 https://..." />
            <p className="text-xs text-slate-400 mt-1">支持相对路径（/uploads/）或 HTTPS 链接</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="livestock-description">描述</label>
            <textarea id="livestock-description" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none" rows={3} value={livestockForm.description} onChange={e => setLivestockForm({ ...livestockForm, description: e.target.value })} placeholder="请输入描述" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowLivestockModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSaveLivestock}>保存</Button>
          </div>
        </div>
      </Modal>

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
