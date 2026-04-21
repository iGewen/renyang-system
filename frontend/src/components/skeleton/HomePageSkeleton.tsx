/**
 * HomePageSkeleton.tsx - 首页骨架屏组件
 * 从 App.tsx 拆分出来的独立模块
 */

import React from 'react';

export const HomePageSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {[1, 2, 3, 4, 5, 6].map((id) => (
      <div key={`skeleton-home-card-${id}`} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="relative h-64 bg-slate-200 animate-pulse" />
        <div className="p-6 space-y-4">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-slate-200 rounded animate-pulse w-full" />
          <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-6">
              <div className="space-y-1">
                <div className="h-2 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="h-2 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-14 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    ))}
  </div>
);
