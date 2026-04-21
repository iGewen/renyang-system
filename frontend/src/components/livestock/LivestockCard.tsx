/**
 * LivestockCard.tsx - 活体卡片组件
 * 从 App.tsx 拆分出来的独立模块
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Icons } from '../ui';
import type { Livestock } from '../../types';

interface LivestockCardProps {
  item: Livestock;
  index: number;
  onClick: () => void;
}

export const LivestockCard: React.FC<LivestockCardProps> = ({ item, index, onClick }) => {
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
