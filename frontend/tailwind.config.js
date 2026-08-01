/** @type {import('tailwindcss').Config} */
/**
 * TokenBazaar theme aligned with PriceAI visual language:
 * - Page: #fbfcfe
 * - Primary controls: charcoal #1a1828
 * - Brand accent: violet #8b5cf6 (Aurora)
 * - Soft borders/shadows, rounded-full pills for primary CTAs
 */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Charcoal primary (PriceAI button/nav selected)
        primary: {
          50: '#f5f3ff',
          100: '#e6e8f2',
          200: '#e3e4ee',
          300: '#a8a6b8',
          400: '#7a7590',
          500: '#65607a',
          600: '#1a1828',
          700: '#14121f',
          800: '#0f0e18',
          900: '#0c0b14',
          950: '#0c1011'
        },
        // Brand violet accent (Aurora)
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95'
        },
        // Semantic success (retained green)
        success: {
          50: '#f0faf4',
          100: '#e8f3ec',
          200: '#c6e9d4',
          300: '#95d8b3',
          400: '#65cc8c',
          500: '#45bf78',
          600: '#2f7a4b',
          700: '#25633c',
          800: '#1d4e30',
          900: '#163c25'
        },
        page: {
          DEFAULT: '#fbfcfe',
          soft: '#f8f9fd'
        },
        ink: {
          primary: '#14121f',
          body: '#1a1828',
          muted: '#65607a',
          soft: '#7a7590',
          placeholder: '#9b97ad',
          on: '#faf9ff'
        },
        line: {
          DEFAULT: '#e3e4ee',
          subtle: '#eef0f7',
          muted: 'rgb(168 166 184 / 0.28)'
        },
        surface: {
          DEFAULT: '#f1f3f9',
          hover: '#eef0f7',
          muted: '#e6e8f2',
          selected: '#dddfea'
        },
        accent: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#111718'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'PingFang SC',
          'Microsoft YaHei',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        display: [
          'Inter',
          'PingFang SC',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif'
        ],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        glass: '0 20px 55px rgba(26, 24, 40, 0.045)',
        'glass-sm': '0 10px 30px rgba(26, 24, 40, 0.06)',
        glow: '0 0 0 3px rgba(139, 92, 246, 0.18)',
        'glow-lg': '0 0 0 4px rgba(139, 92, 246, 0.22)',
        card: '0 20px 55px rgba(26, 24, 40, 0.045)',
        'card-hover': '0 24px 60px rgba(26, 24, 40, 0.08)',
        control: '0 10px 30px rgba(26, 24, 40, 0.06)',
        floating: '0 30px 80px rgba(26, 24, 40, 0.18)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #1a1828 0%, #14121f 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'mesh-gradient':
          'radial-gradient(920px 520px at 12% -8%, rgba(139, 92, 246, 0.16) 0px, transparent 62%), radial-gradient(780px 480px at 92% 8%, rgba(167, 139, 250, 0.12) 0px, transparent 58%), radial-gradient(640px 420px at 55% 110%, rgba(196, 181, 253, 0.10) 0px, transparent 55%)',
        'aurora-dots':
          'radial-gradient(circle at 1px 1px, rgba(26, 24, 40, 0.07) 1px, transparent 0)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.12)' },
          '100%': { boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.2)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  },
  plugins: []
}
