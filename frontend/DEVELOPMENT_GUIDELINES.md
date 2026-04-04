# 云端牧场 (Cloud Ranch) 完整开发规范与 API 文档

本文档是“云端牧场”项目的核心开发指南，旨在为 AI 编程工具及人类开发者提供统一的**设计风格、代码规范、命名规范**以及**前后端对接的 API 接口标准**。请在后续的开发、迭代和重构中严格遵守本指南。

---

## 1. 整体设计风格与设计规范 (Design Guidelines)

本项目采用**现代、极简、高端**的 UI 设计风格，强调“智慧农业”与“自然生态”的结合。

### 1.1 色彩规范 (Color Palette)
*   **品牌主色 (Brand Primary)**: `#10b981` (Emerald 500) - 代表自然、健康、生命力。
*   **品牌辅助色 (Brand Accent)**: `#059669` (Emerald 600) - 用于强调和悬停状态。
*   **背景色 (Background)**: `#f8fafc` (Slate 50) - 页面主背景，提供干净的视觉体验。
*   **卡片背景 (Card Background)**: `#ffffff` (White) - 配合轻微的阴影 (`shadow-sm`)。
*   **文本颜色 (Typography)**:
    *   主标题/强调文本: `#0f172a` (Slate 900)
    *   正文/次要文本: `#64748b` (Slate 500)
    *   辅助说明文本: `#94a3b8` (Slate 400)

### 1.2 排版规范 (Typography)
*   **字体族 (Font Family)**: 
    *   无衬线字体 (Sans-serif): `Inter`, `system-ui`, `sans-serif` (用于正文和通用 UI)。
    *   展示字体 (Display): 标题和数字使用更具现代感的无衬线字体组合，强调粗细对比。
*   **字号层级**: 严格遵循 Tailwind 的默认字号层级 (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl`, `text-4xl`)。

### 1.3 UI 组件风格 (UI Components)
*   **圆角 (Border Radius)**: 偏好大圆角设计，卡片通常使用 `rounded-2xl` 或 `rounded-3xl`，按钮使用 `rounded-xl` 或 `rounded-full`。
*   **阴影 (Shadows)**: 避免沉重的阴影，使用柔和的扩散阴影，如 `shadow-sm` 或自定义的 `shadow-brand-primary/20`。
*   **动画与过渡 (Animations)**: 
    *   页面切换和元素出场必须使用 `framer-motion` (导入为 `motion/react`) 进行平滑过渡。
    *   悬停效果 (Hover) 必须包含 `transition-colors` 或 `transition-all`，时长通常为默认的 150ms 或 300ms。
*   **图标 (Icons)**: 统一使用 `lucide-react` 图标库，保持线条粗细一致。

### 1.4 响应式设计 (Responsive Design)
*   **移动端优先 (Mobile-First)**: 默认样式为移动端样式。
*   **断点 (Breakpoints)**: 使用 Tailwind 的标准断点 (`sm:`, `md:`, `lg:`, `xl:`)。
*   **后台管理端**: PC 端采用左侧固定侧边栏，移动端采用顶部导航+抽屉式侧边栏。

---

## 2. 代码规范 (Coding Standards)

### 2.1 技术栈
*   **框架**: React 18+ (使用 Functional Components 和 Hooks)
*   **构建工具**: Vite
*   **语言**: TypeScript (严格模式)
*   **样式**: Tailwind CSS (通过 `cn` 工具函数合并类名)
*   **路由**: React Router DOM v6

### 2.2 组件开发规范
*   **函数式组件**: 所有组件必须是函数式组件，使用箭头函数定义。
*   **状态管理**: 优先使用 React 内置 Hooks (`useState`, `useEffect`, `useMemo`)。
*   **类名合并**: 动态类名必须使用 `cn` 工具函数 (基于 `clsx` 和 `tailwind-merge`)，例如：`className={cn("base-class", isActive && "active-class")}`。
*   **图片加载**: 所有的 `<img>` 标签必须包含 `referrerPolicy="no-referrer"` 属性。

---

## 3. 命名规范 (Naming Conventions)

*   **文件与目录**:
    *   React 组件文件使用 **PascalCase** (例如 `OrderDetailsPage.tsx`, `Navbar.tsx`)。
    *   工具函数、服务文件使用 **camelCase** (例如 `utils.ts`, `api.ts`)。
*   **变量与函数**: 使用 **camelCase** (例如 `fetchLivestock`, `isMobileMenuOpen`)。
*   **常量**: 使用 **UPPER_SNAKE_CASE** (例如 `LIVESTOCK_DATA`, `MAX_RETRY_COUNT`)。
*   **TypeScript 类型/接口**: 使用 **PascalCase** (例如 `Livestock`, `UserProfile`)，不建议使用 `I` 前缀。
*   **CSS 类名**: 严格使用 Tailwind CSS 的原子类名，不自定义 CSS 文件（除非全局配置）。

---

## 4. API 接口文档 (API Documentation)

前端所有的网络请求均已封装在 `src/services/api.ts` 文件中。当前使用的是基于 `Promise` 和 `setTimeout` 的本地 Mock 数据。后端开发完成后，前端只需修改该文件引入 `axios` 或 `fetch` 即可。

### 4.1 数据模型 (Data Models)

**Livestock (动物/活体)**
```typescript
interface Livestock {
  id: string;
  name: string;
  type: 'sheep' | 'chicken' | 'ostrich';
  price: number;
  monthlyFeed: number;
  description: string;
  image: string;
}
```

**Order (订单)**
```typescript
interface Order {
  id: string;
  livestockId: string;
  userId: string;
  status: 'pending' | 'paid' | 'completed';
  createdAt: string;
}
```

### 4.2 C端 (用户端) 接口

#### 1. 获取可领养动物列表
*   **接口路径**: `GET /api/livestock`
*   **响应数据**: `Livestock[]`

#### 2. 获取动物详情
*   **接口路径**: `GET /api/livestock/:id`
*   **响应数据**: `Livestock`

#### 3. 创建领养订单
*   **接口路径**: `POST /api/orders`
*   **请求体**: `{ "livestockId": "string" }`
*   **响应数据**: `{ "orderId": "string", "adoptionId": "string" }`

#### 4. 支付订单
*   **接口路径**: `POST /api/orders/:orderId/pay`
*   **响应数据**: `{ "success": true }`

#### 5. 获取我的领养列表
*   **接口路径**: `GET /api/users/me/adoptions`
*   **响应数据**: `Adoption[]`

#### 6. 获取用户个人信息
*   **接口路径**: `GET /api/users/me/profile`
*   **响应数据**: `{ name, avatar, stats: { adoptions, days, saved } }`

### 4.3 B端 (后台管理端) 接口

#### 1. 获取控制台统计数据
*   **接口路径**: `GET /api/admin/dashboard/stats`
*   **响应数据**: 
    ```json
    {
      "totalRevenue": 128450,
      "revenueTrend": "+12.5%",
      "activeOrders": 342,
      "ordersTrend": "+5.2%",
      "totalUsers": 1284,
      "usersTrend": "+18.1%",
      "conversionRate": 3.8,
      "conversionTrend": "+1.2%"
    }
    ```

#### 2. 获取最近订单列表 (简要)
*   **接口路径**: `GET /api/admin/orders/recent`
*   **响应数据**: `Array<{ id, user, item, amount, status, date }>`

#### 3. 获取后台活体列表
*   **接口路径**: `GET /api/admin/livestock`
*   **响应数据**: `Livestock[]`

#### 4. 新增活体
*   **接口路径**: `POST /api/admin/livestock`
*   **请求体**: `Partial<Livestock>`
*   **响应数据**: `{ "success": true, "id": "string" }`

#### 5. 更新活体
*   **接口路径**: `PUT /api/admin/livestock/:id`
*   **请求体**: `Partial<Livestock>`
*   **响应数据**: `{ "success": true }`

#### 6. 删除活体
*   **接口路径**: `DELETE /api/admin/livestock/:id`
*   **响应数据**: `{ "success": true }`

---

## 5. 前端真实对接指南

当后端接口准备就绪后，请按照以下步骤替换 `src/services/api.ts` 中的 Mock 数据：

1.  安装 HTTP 客户端：`npm install axios`
2.  配置 Axios 实例（处理 baseURL、Token 拦截器、全局错误处理）。
3.  重写 `src/services/api.ts`，将 `delay` 替换为真实的 `axios.get/post` 调用。
4.  配置 `vite.config.ts` 中的 proxy 解决本地跨域问题。
