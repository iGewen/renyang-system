import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { siteConfigApi } from '../services/api';
import logger from '../utils/logger';

interface SiteConfig {
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  siteKeywords: string;
  contactPhone: string;
  contactEmail: string;
  contactWechat: string;
  loaded: boolean;
}

interface PaymentConfig {
  alipayEnabled: boolean;
  wechatEnabled: boolean;
  loaded: boolean;
}

interface AppConfig {
  site: SiteConfig;
  payment: PaymentConfig;
}

const defaultSiteConfig: SiteConfig = {
  siteName: '云端牧场',
  siteTitle: '云端牧场 - 智慧领养平台',
  siteDescription: '连接自然与科技，每一份领养都是对生命的尊重与呵护',
  siteKeywords: '云端牧场,智慧农业,活体领养,云养殖',
  contactPhone: '',
  contactEmail: '',
  contactWechat: '',
  loaded: false,
};

const defaultPaymentConfig: PaymentConfig = {
  alipayEnabled: true,
  wechatEnabled: true,
  loaded: false,
};

const defaultConfig: AppConfig = {
  site: defaultSiteConfig,
  payment: defaultPaymentConfig,
};

const AppConfigContext = createContext<AppConfig>(defaultConfig);

export const useSiteConfig = () => useContext(AppConfigContext).site;
export const usePaymentConfig = () => useContext(AppConfigContext).payment;
export const useAppConfig = () => useContext(AppConfigContext);

interface AppConfigProviderProps {
  children: ReactNode;
}

export const SiteConfigProvider: React.FC<AppConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 并行加载站点配置和支付配置
        const [siteData, paymentData] = await Promise.all([
          siteConfigApi.get().catch(() => null),
          siteConfigApi.getPaymentConfig().catch(() => null),
        ]);

        const newSiteConfig: SiteConfig = {
          siteName: siteData?.site_name || defaultSiteConfig.siteName,
          siteTitle: siteData?.site_title || defaultSiteConfig.siteTitle,
          siteDescription: siteData?.site_description || defaultSiteConfig.siteDescription,
          siteKeywords: siteData?.site_keywords || defaultSiteConfig.siteKeywords,
          contactPhone: siteData?.contact_phone || '',
          contactEmail: siteData?.contact_email || '',
          contactWechat: (siteData as any)?.contact_wechat || '',
          loaded: true,
        };

        const newPaymentConfig: PaymentConfig = {
          alipayEnabled: paymentData?.alipay_enabled ?? true,
          wechatEnabled: paymentData?.wechat_enabled ?? true,
          loaded: true,
        };

        setConfig({
          site: newSiteConfig,
          payment: newPaymentConfig,
        });

        // 更新页面标题
        if (newSiteConfig.siteTitle) {
          document.title = newSiteConfig.siteTitle;
        }

        // 更新 meta 描述
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription && newSiteConfig.siteDescription) {
          metaDescription.setAttribute('content', newSiteConfig.siteDescription);
        }

        // 更新 meta 关键词
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords && newSiteConfig.siteKeywords) {
          metaKeywords = document.createElement('meta');
          metaKeywords.setAttribute('name', 'keywords');
          document.head.appendChild(metaKeywords);
        }
        if (metaKeywords && newSiteConfig.siteKeywords) {
          metaKeywords.setAttribute('content', newSiteConfig.siteKeywords);
        }
      } catch (error) {
        logger.error('Failed to load config:', error);
        setConfig(prev => ({
          site: { ...prev.site, loaded: true },
          payment: { ...prev.payment, loaded: true },
        }));
      }
    };

    loadConfig();
  }, []);

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
};
