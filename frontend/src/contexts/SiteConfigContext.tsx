import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { siteConfigApi } from '../services/api';

interface SiteConfig {
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  siteKeywords: string;
  contactPhone: string;
  contactEmail: string;
  loaded: boolean;
}

const defaultConfig: SiteConfig = {
  siteName: '云端牧场',
  siteTitle: '云端牧场 - 智慧领养平台',
  siteDescription: '连接自然与科技，每一份领养都是对生命的尊重与呵护',
  siteKeywords: '云端牧场,智慧农业,活体领养,云养殖',
  contactPhone: '',
  contactEmail: '',
  loaded: false,
};

const SiteConfigContext = createContext<SiteConfig>(defaultConfig);

export const useSiteConfig = () => useContext(SiteConfigContext);

interface SiteConfigProviderProps {
  children: ReactNode;
}

export const SiteConfigProvider: React.FC<SiteConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfig>(defaultConfig);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await siteConfigApi.get();
        const newConfig: SiteConfig = {
          siteName: data.site_name || defaultConfig.siteName,
          siteTitle: data.site_title || defaultConfig.siteTitle,
          siteDescription: data.site_description || defaultConfig.siteDescription,
          siteKeywords: data.site_keywords || defaultConfig.siteKeywords,
          contactPhone: data.contact_phone || '',
          contactEmail: data.contact_email || '',
          loaded: true,
        };
        setConfig(newConfig);

        // 更新页面标题
        if (newConfig.siteTitle) {
          document.title = newConfig.siteTitle;
        }

        // 更新 meta 描述
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription && newConfig.siteDescription) {
          metaDescription.setAttribute('content', newConfig.siteDescription);
        }

        // 更新 meta 关键词
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords && newConfig.siteKeywords) {
          metaKeywords = document.createElement('meta');
          metaKeywords.setAttribute('name', 'keywords');
          document.head.appendChild(metaKeywords);
        }
        if (metaKeywords && newConfig.siteKeywords) {
          metaKeywords.setAttribute('content', newConfig.siteKeywords);
        }
      } catch (error) {
        console.error('Failed to load site config:', error);
        setConfig(prev => ({ ...prev, loaded: true }));
      }
    };

    loadConfig();
  }, []);

  return (
    <SiteConfigContext.Provider value={config}>
      {children}
    </SiteConfigContext.Provider>
  );
};
