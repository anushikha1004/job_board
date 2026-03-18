# Tech Design System (2026)

## Overview

This design system features **Glassmorphism** with a dark tech aesthetic, using a dark grey background with vibrant accent colors for a modern, futuristic look.

## Color Palette

### Primary Colors
- **Background**: `#0f172a` (Deep Dark Blue-Grey)
- **Background Secondary**: `#1a1f3a` (Slightly Lighter)
- **Foreground**: `#e2e8f0` (Light Slate)
- **Foreground Muted**: `#94a3b8` (Medium Slate)

### Accent Colors
- **Cyber Purple**: `#a78bfa` (Primary Accent)
- **Cyber Purple Dark**: `#7c3aed` (Hover State)
- **Electric Blue**: `#06b6d4` (Secondary Accent)
- **Electric Blue Dark**: `#0891b2` (Hover State)
- **Neon Green**: `#4ade80` (Status/Success)
- **Neon Pink**: `#ec4899` (Highlights)

## Key Features

### 1. Glassmorphism

All cards use a frosted glass effect with:
- Semi-transparent background: `rgba(30, 41, 59, 0.7)`
- Subtle border: `1px solid rgba(148, 163, 184, 0.2)`
- Backdrop blur: `10px` or `20px`

```css
.glass {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
```

### 2. Dark Mode

Complete dark mode implementation:
- Deep background prevents eye strain
- High contrast text for readability
- Vibrant accents pop against dark surfaces

### 3. Job Cards

Interactive cards with:
- Smooth hover animations (lift effect)
- Gradient borders on hover
- Purple glow effect
- Glass morphism styling

```css
.job-card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.job-card:hover {
  border-color: #a78bfa;
  box-shadow: 0 0 30px rgba(167, 139, 250, 0.2);
  transform: translateY(-8px);
}
```

### 4. Apply Button

Vibrant gradient button with glow effect:
- **Gradient**: Purple to Electric Blue
- **Glow**: Dynamic shadow on hover
- **Transform**: Lifts on hover

```css
.btn-primary {
  background: linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%);
  color: #0f172a;
  box-shadow: 0 0 20px rgba(167, 139, 250, 0.3);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 30px rgba(167, 139, 250, 0.6);
  transform: translateY(-2px);
}
```

### 5. Tags

Soft, colorful badges:
- **Purple Tags**: Technologies
- **Blue Tags**: Skills
- **Green Tags**: Remote/Status

```css
.tag {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 20px;
  padding: 6px 12px;
}
```

## CSS Classes

### Utility Classes

```html
<!-- Glass Morphism -->
<div class="glass">...</div>
<div class="glass-heavy">...</div>

<!-- Buttons -->
<button class="btn-primary">Apply Now</button>
<button class="btn-secondary">View More</button>

<!-- Cards -->
<div class="card">...</div>
<div class="job-card">...</div>

<!-- Typography -->
<h2 class="section-title">Featured Jobs</h2>
<h3 class="job-title">Senior DevOps Engineer</h3>
<p class="job-company">Acme Tech</p>

<!-- Tags -->
<span class="tag">Python</span>
<span class="tag tag-blue">Remote</span>
<span class="tag tag-green">Hiring</span>

<!-- Data Display -->
<p class="salary-range">$120K - $180K</p>
```

## Animation Effects

### Hover Effects
- **Cards**: Lift 4-8px with glow
- **Buttons**: Glow expansion and slight lift
- **Tags**: Background intensification
- **Border Colors**: Transition to purple/blue

### Transitions
All transitions use: `all 0.3s ease`

## Layout Recommendations

### Container
- Max-width: 1200px
- Padding: 24px on sides
- Background: `#0f172a`

### Grid
- Job cards in 2-3 column grid
- Responsive: 1 column on mobile, 2-3 on desktop

### Spacing
- Section gaps: 32px
- Card padding: 24px
- Tag gaps: 8px

## Example Structure

```html
<body>
  <header class="glass">
    <h1 class="section-title">IT Jobs Board 2026</h1>
    <p class="foreground-muted">Find your next opportunity</p>
  </header>

  <main>
    <section class="section">
      <h2 class="section-title">Featured Opportunities</h2>
      
      <div class="job-card">
        <h3 class="job-title">Senior DevOps Engineer</h3>
        <p class="job-company">Acme Tech</p>
        
        <div class="job-tags">
          <span class="tag">Python</span>
          <span class="tag tag-blue">Docker</span>
          <span class="tag tag-green">Remote</span>
        </div>
        
        <p class="salary-range">$120K - $180K USD</p>
        
        <button class="btn-primary">Apply Now</button>
      </div>
    </section>
  </main>
</body>
```

## Browser Support

- ✅ Chrome/Edge (Chromium 88+)
- ✅ Firefox 103+
- ✅ Safari 15.4+
- ✅ Mobile Browsers

Backdrop-filter has fallbacks for older browsers.

## Accessibility

- High contrast text on dark backgrounds (WCAG AA)
- Focus states on interactive elements
- Smooth animations (respects `prefers-reduced-motion`)
- Semantic HTML structure
