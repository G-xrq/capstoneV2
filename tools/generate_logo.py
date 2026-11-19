import math
from PIL import Image, ImageDraw, ImageFilter

def create_bbdrts_logo():
    # Supersampled high-res canvas (2048x2048 -> downscaled to 512x512)
    dim = 2048
    scale = dim / 512.0
    
    # SVG string
    svg = '''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background subtle ambient glow -->
    <radialGradient id="bbdrtsGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#06b6d4" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
    </radialGradient>
    
    <!-- Outer Shield Gradient -->
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="45%" stop-color="#10b981"/>
      <stop offset="80%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>

    <!-- Top Isometric Facet (Roof / Protection) -->
    <linearGradient id="topFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>

    <!-- Left Facet (Trust / Blockchain Node) -->
    <linearGradient id="leftFacet" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>

    <!-- Right Facet (Transparency / Verification) -->
    <linearGradient id="rightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>

    <!-- Heart / Core Light -->
    <linearGradient id="heartCore" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#a7f3d0"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>

  <!-- Ambient Glow -->
  <circle cx="256" cy="256" r="230" fill="url(#bbdrtsGlow)"/>

  <!-- Outer Hexagonal Blockchain Perimeter (Rounded corners) -->
  <path d="M256 36 L446 146 L446 366 L256 476 L66 366 L66 146 Z" 
        stroke="url(#shieldGrad)" 
        stroke-width="18" 
        stroke-linejoin="round" 
        stroke-linecap="round"
        fill="rgba(16, 185, 129, 0.04)" />

  <!-- Inner Interconnecting Blockchain Nodes -->
  <!-- Top Roof / Relief Shelter Cap -->
  <path d="M256 110 L386 185 L256 260 L126 185 Z" 
        fill="url(#topFacet)" 
        stroke="rgba(255, 255, 255, 0.25)"
        stroke-width="2"
        stroke-linejoin="round" />

  <!-- Left Facet (Security Pillar) -->
  <path d="M126 185 L256 260 L256 410 L126 335 Z" 
        fill="url(#leftFacet)" 
        stroke="rgba(255, 255, 255, 0.15)"
        stroke-width="2"
        stroke-linejoin="round" />

  <!-- Right Facet (Transparency Pillar) -->
  <path d="M256 260 L386 185 L386 335 L256 410 Z" 
        fill="url(#rightFacet)" 
        stroke="rgba(255, 255, 255, 0.2)"
        stroke-width="2"
        stroke-linejoin="round" />

  <!-- Dynamic Center Heart Prism (Donation & Human Relief) -->
  <path d="M256 180 C272 152 316 152 330 186 C342 216 318 246 256 294 C194 246 170 216 182 186 C196 152 240 152 256 180 Z" 
        fill="url(#heartCore)" />

  <!-- Cryptographic Blockchain Node Vertices -->
  <circle cx="256" cy="36" r="11" fill="#34d399"/>
  <circle cx="446" cy="146" r="11" fill="#38bdf8"/>
  <circle cx="446" cy="366" r="11" fill="#06b6d4"/>
  <circle cx="256" cy="476" r="11" fill="#10b981"/>
  <circle cx="66" cy="366" r="11" fill="#059669"/>
  <circle cx="66" cy="146" r="11" fill="#6ee7b7"/>
  
  <!-- Subtle Internal Crystal Accent Rays -->
  <line x1="256" y1="36" x2="256" y2="110" stroke="#34d399" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 6"/>
  <line x1="446" y1="146" x2="386" y2="185" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 6"/>
  <line x1="446" y1="366" x2="386" y2="335" stroke="#06b6d4" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 6"/>
  <line x1="256" y1="476" x2="256" y2="410" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 6"/>
  <line x1="66" y1="366" x2="126" y2="335" stroke="#059669" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 6"/>
  <line x1="66" y1="146" x2="126" y2="185" stroke="#6ee7b7" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 6"/>
</svg>'''

    with open('frontend/public/logo.svg', 'w', encoding='utf-8') as f:
        f.write(svg)
    print("Wrote frontend/public/logo.svg")

    # Now render high-res 512x512 PNG with PIL
    im = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    def s(val):
        return val * scale

    # Draw hexagonal outer shield with gradient simulation
    # Hexagon points:
    hex_pts = [
        (s(256), s(36)),
        (s(446), s(146)),
        (s(446), s(366)),
        (s(256), s(476)),
        (s(66), s(366)),
        (s(66), s(146))
    ]
    
    # Outer shield fill
    draw.polygon(hex_pts, fill=(16, 185, 129, 14))

    # Outer shield stroke (width = 18 * scale)
    shield_stroke = int(18 * scale)
    for i in range(len(hex_pts)):
        p1 = hex_pts[i]
        p2 = hex_pts[(i + 1) % len(hex_pts)]
        # color interpolate around hexagon
        t = i / len(hex_pts)
        r = int(16 * (1 - t) + 6 * t)
        g = int(185 * (1 - t) + 182 * t)
        b = int(129 * (1 - t) + 212 * t)
        draw.line([p1, p2], fill=(r, g, b, 240), width=shield_stroke)

    # Internal connecting dashed lines
    def draw_dashed(p1, p2, col, w):
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        steps = int(dist / (14 * scale))
        for step in range(steps):
            if step % 2 == 0:
                t1 = step / steps
                t2 = min(1.0, (step + 0.6) / steps)
                draw.line([(p1[0] + dx * t1, p1[1] + dy * t1), 
                           (p1[0] + dx * t2, p1[1] + dy * t2)], 
                          fill=col, width=int(w * scale))

    draw_dashed((s(256), s(36)), (s(256), s(110)), (52, 211, 153, 200), 6)
    draw_dashed((s(446), s(146)), (s(386), s(185)), (56, 189, 248, 200), 6)
    draw_dashed((s(446), s(366)), (s(386), s(335)), (6, 182, 212, 200), 6)
    draw_dashed((s(256), s(476)), (s(256), s(410)), (16, 185, 129, 200), 6)
    draw_dashed((s(66), s(366)), (s(126), s(335)), (5, 150, 105, 200), 6)
    draw_dashed((s(66), s(146)), (s(126), s(185)), (110, 231, 183, 200), 6)

    # 3D Isometric cube / prism facets
    # Top facet (roof)
    top_facet = [(s(256), s(110)), (s(386), s(185)), (s(256), s(260)), (s(126), s(185))]
    draw.polygon(top_facet, fill=(52, 211, 153, 235))
    draw.line(top_facet + [top_facet[0]], fill=(255, 255, 255, 80), width=int(2 * scale))

    # Left facet (trust)
    left_facet = [(s(126), s(185)), (s(256), s(260)), (s(256), s(410)), (s(126), s(335))]
    draw.polygon(left_facet, fill=(5, 150, 105, 245))
    draw.line(left_facet + [left_facet[0]], fill=(255, 255, 255, 50), width=int(2 * scale))

    # Right facet (transparency)
    right_facet = [(s(256), s(260)), (s(386), s(185)), (s(386), s(335)), (s(256), s(410))]
    draw.polygon(right_facet, fill=(6, 182, 212, 245))
    draw.line(right_facet + [right_facet[0]], fill=(255, 255, 255, 70), width=int(2 * scale))

    # Central glowing heart
    heart_pts = []
    # Parametric heart curve scaled
    for deg in range(0, 360, 2):
        rad = math.radians(deg)
        # standard heart formula: x = 16*sin^3(t), y = -(13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t))
        hx = 16 * (math.sin(rad) ** 3)
        hy = -(13 * math.cos(rad) - 5 * math.cos(2*rad) - 2 * math.cos(3*rad) - math.cos(4*rad))
        px = s(256) + hx * (4.2 * scale)
        py = s(215) + hy * (4.2 * scale)
        heart_pts.append((px, py))
    draw.polygon(heart_pts, fill=(240, 253, 250, 255))
    draw.line(heart_pts + [heart_pts[0]], fill=(56, 189, 248, 180), width=int(3 * scale))

    # Node vertex circles
    node_rad = int(12 * scale)
    nodes = [
        ((s(256), s(36)), (52, 211, 153)),
        ((s(446), s(146)), (56, 189, 248)),
        ((s(446), s(366)), (6, 182, 212)),
        ((s(256), s(476)), (16, 185, 129)),
        ((s(66), s(366)), (5, 150, 105)),
        ((s(66), s(146)), (110, 231, 183)),
    ]
    for pt, col in nodes:
        draw.ellipse([pt[0] - node_rad, pt[1] - node_rad, pt[0] + node_rad, pt[1] + node_rad], fill=col)
        draw.ellipse([pt[0] - node_rad/2, pt[1] - node_rad/2, pt[0] + node_rad/2, pt[1] + node_rad/2], fill=(255, 255, 255, 220))

    # Downscale with Lanczos for beautiful anti-aliasing
    final_png = im.resize((512, 512), Image.Resampling.LANCZOS)
    final_png.save('frontend/public/logo.png', 'PNG')
    print("Wrote frontend/public/logo.png (512x512)")

if __name__ == '__main__':
    create_bbdrts_logo()
