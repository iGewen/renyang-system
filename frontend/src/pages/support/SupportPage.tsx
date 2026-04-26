/**
 * SupportPage.tsx - 专属管家页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons } from '../../components/ui';
import { useSiteConfig } from '../../contexts/SiteConfigContext';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const siteConfig = useSiteConfig();

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
            {!siteConfig.contactPhone && !siteConfig.contactEmail && (
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

export default SupportPage;