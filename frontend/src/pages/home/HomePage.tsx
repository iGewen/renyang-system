import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icons, PageTransition, Button, EmptyState } from '../../components/ui';
import { Navbar } from '../../components/layout';
import { HomePageSkeleton } from '../../components/skeleton';
import { LivestockCard } from '../../components/livestock';
import { livestockApi, notificationApi } from '../../services/api';
import type { Livestock } from '../../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [livestockList, setLivestockList] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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

    const token = localStorage.getItem('token');
    if (token) {
      notificationApi.getUnreadCount().then(res => setUnreadCount(res.count)).catch(() => {});
    }
  }, []);

  const rightContent = (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/notifications')}
      className="relative w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-white/30 flex items-center justify-center text-brand-primary shadow-sm"
    >
      <Icons.Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
    </motion.button>
  );

  return (
    <PageTransition>
      <div className="min-h-screen pb-28">
        <Navbar title="云端牧场" transparent rightContent={rightContent} />
        <div className="max-w-screen-xl mx-auto px-6 pt-2 pb-8">
          <header className="mb-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-brand-accent/10 to-emerald-50 text-brand-accent text-[10px] font-bold uppercase tracking-wider mb-4 border border-brand-accent/10"
            >
              <Icons.Leaf className="w-3.5 h-3.5" />
              智慧农业新体验
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl font-display font-bold text-brand-primary leading-tight mb-4"
            >
              在云端，<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-indigo-600">拥有属于您的牧场</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-slate-500 text-base max-w-md leading-relaxed"
            >
              连接自然与科技，每一份领养都是对生命的尊重与呵护。
            </motion.p>
          </header>

          {(() => {
            if (loading) {
              return <HomePageSkeleton />;
            }
            if (livestockList.length === 0) {
              return (
                <EmptyState
                  icon={<Icons.Sprout className="w-10 h-10" />}
                  title="暂无可领养的活体"
                  description="我们正在为您寻找更多优质活体，请稍后再来查看"
                  action={
                    <Button variant="outline" onClick={() => globalThis.location.reload()}>
                      刷新页面
                    </Button>
                  }
                />
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {livestockList.map((item, index) => (
                  <LivestockCard
                    key={item.id}
                    item={item}
                    index={index}
                    onClick={() => navigate(`/details/${item.id}`)}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </PageTransition>
  );
};

export default HomePage;
