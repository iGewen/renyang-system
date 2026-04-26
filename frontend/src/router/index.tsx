import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui';
import { AdminProtectedRoute, UserProtectedRoute } from './RouteGuards';

// Lazy load existing pages
const OrdersPage = lazy(() => import('../pages/order/OrdersPage'));
const AdoptionDetailPage = lazy(() => import('../pages/adoption/AdoptionDetailPage'));
const FeedBillDetailPage = lazy(() => import('../pages/feed-bill/FeedBillDetailPage'));
const RedemptionPage = lazy(() => import('../pages/redemption/RedemptionPage'));
const AdminPage = lazy(() => import('../pages/admin/AdminPage'));
const BalancePage = lazy(() => import('../pages/user/BalancePage'));
const AuthPage = lazy(() => import('../pages/auth/AuthPage'));
const DetailsPage = lazy(() => import('../pages/details/DetailsPage'));
const PaymentPage = lazy(() => import('../pages/payment/PaymentPage'));
const PaymentResultPage = lazy(() => import('../pages/payment-result/PaymentResultPage'));
const SuccessPage = lazy(() => import('../pages/success/SuccessPage'));
const MyAdoptionsPage = lazy(() => import('../pages/my-adoptions/MyAdoptionsPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));
const SecurityPage = lazy(() => import('../pages/security/SecurityPage'));
const NotificationPage = lazy(() => import('../pages/notification/NotificationPage'));
const GrowthRecordsPage = lazy(() => import('../pages/growth-records/GrowthRecordsPage'));
const SupportPage = lazy(() => import('../pages/support/SupportPage'));

// 首页 - 直接导入以避免循环依赖
import { HomePage } from '../pages/home/HomePage';

/**
 * 应用路由配置
 */
export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={
        <Suspense fallback={<LoadingSpinner />}>
          <AuthPage />
        </Suspense>
      } />
      <Route path="/admin-login" element={<AdminLoginPageWrapper />} />

      {/* 需要登录的用户路由 */}
      <Route path="/details/:id" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <DetailsPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/payment" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <PaymentPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/payment-result" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <PaymentResultPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/success" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <SuccessPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/orders" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <OrdersPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/my-adoptions" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <MyAdoptionsPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/profile" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <ProfilePage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/balance" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <BalancePage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/notifications" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <NotificationPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/security" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <SecurityPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/growth-records" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <GrowthRecordsPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/support" element={
        <UserProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <SupportPage />
          </Suspense>
        </UserProtectedRoute>
      } />
      <Route path="/adoption/:id" element={
        <Suspense fallback={<LoadingSpinner />}>
          <UserProtectedRoute>
            <AdoptionDetailPage />
          </UserProtectedRoute>
        </Suspense>
      } />
      <Route path="/adoption/:id/redemption" element={
        <Suspense fallback={<LoadingSpinner />}>
          <UserProtectedRoute>
            <RedemptionPage />
          </UserProtectedRoute>
        </Suspense>
      } />
      <Route path="/feed-bill/:id" element={
        <Suspense fallback={<LoadingSpinner />}>
          <UserProtectedRoute>
            <FeedBillDetailPage />
          </UserProtectedRoute>
        </Suspense>
      } />

      {/* 管理后台路由 */}
      <Route path="/admin/*" element={
        <AdminProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <AdminPage />
          </Suspense>
        </AdminProtectedRoute>
      } />

      {/* 404 重定向 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// 管理后台登录页包装器
const AdminLoginPageWrapper: React.FC = () => {
  const [LoginPage, setLoginPage] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import('../pages/admin/AdminLoginPage').then(module => {
      setLoginPage(() => module.default);
    });
  }, []);

  if (!LoginPage) return <LoadingSpinner />;
  return <LoginPage />;
};