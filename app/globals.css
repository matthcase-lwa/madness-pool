@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

@layer base {
  * {
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #1a0f05;
  }
  ::-webkit-scrollbar-thumb {
    background: #ff7410;
    border-radius: 3px;
  }
}

@layer components {
  /* Court lines background texture */
  .court-texture {
    background-image:
      linear-gradient(rgba(255, 116, 16, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 116, 16, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* Grain overlay */
  .grain::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.4;
  }

  /* Orange accent line */
  .accent-line {
    @apply border-l-4 border-court-500 pl-4;
  }

  /* Card style */
  .card {
    @apply bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm;
  }

  .card-hover {
    @apply card transition-all duration-200 hover:bg-white/10 hover:border-court-500/30 hover:shadow-lg hover:shadow-court-500/10;
  }

  /* Rank badge */
  .rank-badge {
    @apply font-display text-2xl w-10 h-10 flex items-center justify-center rounded-full;
  }

  /* Seed badge */
  .seed-badge {
    @apply text-xs font-bold px-1.5 py-0.5 rounded font-body;
  }

  .seed-1 { @apply bg-court-500 text-white; }
  .seed-2, .seed-3, .seed-4 { @apply bg-amber-500/80 text-black; }
  .seed-5plus { @apply bg-white/20 text-chalk; }
  .seed-9plus { @apply bg-emerald-500/80 text-white; }

  /* Button styles */
  .btn-primary {
    @apply bg-court-500 hover:bg-court-400 text-white font-bold px-6 py-3 rounded-lg transition-all duration-200 font-body tracking-wide hover:shadow-lg hover:shadow-court-500/30 active:scale-95;
  }

  .btn-secondary {
    @apply bg-white/10 hover:bg-white/20 text-chalk border border-white/20 font-bold px-6 py-3 rounded-lg transition-all duration-200 font-body;
  }

  /* Score shimmer loading */
  .shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,116,16,0.1) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Nav link */
  .nav-link {
    @apply text-white/60 hover:text-court-400 transition-colors duration-200 font-body text-sm tracking-wide;
  }

  .nav-link.active {
    @apply text-court-400;
  }
}

/* Staggered animation helpers */
.animate-delay-100 { animation-delay: 100ms; }
.animate-delay-200 { animation-delay: 200ms; }
.animate-delay-300 { animation-delay: 300ms; }
.animate-delay-400 { animation-delay: 400ms; }
.animate-delay-500 { animation-delay: 500ms; }

/* Initially hidden for staggered reveals */
.stagger-child {
  opacity: 0;
  animation: slideUp 0.5s ease-out forwards;
}
