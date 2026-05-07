# Quick Start: Figma Generated Components

## Setup (30 seconds)

```bash
# Components are ready to use immediately!
# No additional installation needed.
```

---

## Usage Examples

### 1. Login Page
```tsx
import { LoginCard } from '@/components/figma-generated/LoginCard';

export default function LoginPage() {
  const handleLogin = async (email: string, password: string) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    // Handle response
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <LoginCard onSubmit={handleLogin} />
    </div>
  );
}
```

### 2. Mobile Preview
```tsx
import { MobileFrame } from '@/components/figma-generated/MobileFrame';
import { LoginCard } from '@/components/figma-generated/LoginCard';

export default function MobilePreview() {
  return (
    <div style={{ padding: '40px', background: '#f5f5f5' }}>
      <MobileFrame variant="light">
        <LoginCard />
      </MobileFrame>
    </div>
  );
}
```

### 3. With State Management
```tsx
import { useState } from 'react';
import { LoginCard } from '@/components/figma-generated/LoginCard';

export default function SmartLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError('');
      
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        setError('Invalid credentials');
        return;
      }

      // Success - redirect
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginCard
      onSubmit={handleSubmit}
      isLoading={loading}
      error={error || undefined}
    />
  );
}
```

---

## Design Tokens

### Using CSS Variables
```css
/* Colors */
--primary-purple: #6B2FAA;
--primary-navy: #142A3F;
--surface-white: #FFFFFF;
--background-light: #F2F2F7;

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

### In TypeScript
```typescript
import tokens from '@/components/figma-generated/tokens.json';

const buttonColor = tokens.colors.primary.navy; // #142A3F
const spacing = tokens.spacing.md; // 16px
```

---

## Component Props

### LoginCard
```typescript
interface LoginCardProps {
  onSubmit?: (email: string, password: string) => void;
  isLoading?: boolean;
  error?: string;
}
```

### MobileFrame
```typescript
interface MobileFrameProps {
  variant?: 'light' | 'dark';
  hasStatusBar?: boolean;
  children?: React.ReactNode;
}
```

---

## Customization

### Override Colors
```tsx
<LoginCard onSubmit={handleLogin} />

// In your CSS:
:global(.loginCard) {
  background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
}
```

### Extend Components
```tsx
import { LoginCard } from '@/components/figma-generated/LoginCard';
import styles from './CustomLogin.module.css';

export function CustomLoginCard(props: React.ComponentProps<typeof LoginCard>) {
  return (
    <div className={styles.wrapper}>
      <LoginCard {...props} />
      <p>Don't have an account? <a href="/signup">Sign up</a></p>
    </div>
  );
}
```

---

## File Structure
```
src/components/figma-generated/
├── LoginCard.tsx
├── LoginCard.module.css
├── MobileFrame.tsx
├── MobileFrame.module.css
└── index.ts (export all)
```

---

## TypeScript Support ✅
All components are fully typed with no `any` types. Full IDE autocomplete support.

---

## Responsive Design ✅
Components automatically adapt to:
- Mobile (< 480px)
- Tablet (480px - 768px)
- Desktop (> 768px)

---

## Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+

---

## Need Help?

📖 **Full Documentation:** See `FIGMA_COMPONENT_LIBRARY.md`  
📊 **Design Tokens:** See `figma-design-tokens.json`  
📝 **Report:** See `FIGMA_MCP_REPORT.md`

---

**Ready to build?** Start with the examples above! 🚀
