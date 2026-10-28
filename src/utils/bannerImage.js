/**
 * Banner image utilities for SupaMart Admin Portal.
 * Handles both:
 * 1. Text + Side Image composite banners (800x320 standard ratio)
 * 2. Full-bleed standardized graphic banners (800x320 standard ratio)
 */

export const THEME_PRESETS = [
  {
    id: 'farm-fresh',
    name: 'Farm Fresh',
    background: '#E4F2E9',
    text: '#121712',
    secondary: '#3B5145',
    button: '#0A7C47',
    buttonText: '#FFFFFF',
  },
  {
    id: 'monthly-ration',
    name: 'Monthly Ration',
    background: '#0A7C47',
    text: '#FFFFFF',
    secondary: '#D1FAE5',
    button: '#FFFFFF',
    buttonText: '#0A7C47',
  },
  {
    id: 'tea-time',
    name: 'Tea Time',
    background: '#1E2B23',
    text: '#FFFFFF',
    secondary: '#CBD5E1',
    button: '#FFFFFF',
    buttonText: '#0A7C47',
  },
  {
    id: 'warm-amber',
    name: 'Special Offers',
    background: '#FFF7ED',
    text: '#1C1917',
    secondary: '#78350F',
    button: '#D97706',
    buttonText: '#FFFFFF',
  },
  {
    id: 'fresh-blue',
    name: 'Daily Essentials',
    background: '#EFF6FF',
    text: '#0F172A',
    secondary: '#1E40AF',
    button: '#2563EB',
    buttonText: '#FFFFFF',
  },
];

/**
 * Converts a full graphic image to 800x320 (2.5:1 ratio) with centered cropping
 */
export function convertBannerToStandardDimensions(file, targetWidth = 800, targetHeight = 320) {
  return new Promise((resolve, reject) => {
    if (!file || (!file.type?.startsWith('image/') && typeof file !== 'string')) {
      return reject(new Error('Please select a valid image file.'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const onImageLoaded = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context not available'));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const srcRatio = srcW / srcH;
      const targetRatio = targetWidth / targetHeight;

      let renderW, renderH, offsetX, offsetY;
      if (srcRatio > targetRatio) {
        renderH = targetHeight;
        renderW = srcW * (targetHeight / srcH);
        offsetX = (targetWidth - renderW) / 2;
        offsetY = 0;
      } else {
        renderW = targetWidth;
        renderH = srcH * (targetWidth / srcW);
        offsetX = 0;
        offsetY = (targetHeight - renderH) / 2;
      }

      ctx.fillStyle = '#F4F6F4';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, offsetX, offsetY, renderW, renderH);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas image conversion failed'));
          const standardizedFile = new File(
            [blob],
            (file.name ? file.name.replace(/\.[^/.]+$/, '') : 'banner') + '_800x320.jpg',
            { type: 'image/jpeg', lastModified: Date.now() }
          );
          resolve({
            file: standardizedFile,
            previewUrl: URL.createObjectURL(blob),
            width: targetWidth,
            height: targetHeight,
          });
        },
        'image/jpeg',
        0.92
      );
    };

    img.onload = onImageLoaded;
    img.onerror = () => reject(new Error('Could not decode image'));

    if (typeof file === 'string') {
      img.src = file;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Creates a composite 800x320 banner with text on the left and a side image on the right.
 */
export function createCompositeBanner({
  imageSource, // File, Blob, or URL string
  label = '',
  title = '',
  subtitle = '',
  buttonText = 'Shop now',
  theme = THEME_PRESETS[0],
  targetWidth = 800,
  targetHeight = 320,
}) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas 2D context not available'));

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Helper to draw text & shape layout
    const renderScene = (imgElement = null) => {
      // 1. Background Fill
      ctx.fillStyle = theme.background || '#E4F2E9';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Subtle decorative radial accent in bottom-right
      const gradient = ctx.createRadialGradient(
        targetWidth * 0.75, targetHeight * 0.5, 50,
        targetWidth * 0.75, targetHeight * 0.5, targetWidth * 0.6
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 2. Right Side: Product / Visual Card
      if (imgElement) {
        const cardX = 424;
        const cardY = 24;
        const cardW = 352;
        const cardH = targetHeight - 48; // 272px
        const cardRadius = 24;
        const pad = 12;
        const innerW = cardW - pad * 2;
        const innerH = cardH - pad * 2;

        ctx.save();
        // Rounded card clipping for side image
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
        } else {
          ctx.moveTo(cardX + cardRadius, cardY);
          ctx.lineTo(cardX + cardW - cardRadius, cardY);
          ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardRadius, cardRadius);
          ctx.lineTo(cardX + cardW, cardY + cardH - cardRadius);
          ctx.arcTo(cardX + cardW, cardY + cardH, cardX + cardW - cardRadius, cardY + cardH, cardRadius);
          ctx.lineTo(cardX + cardRadius, cardY + cardH);
          ctx.arcTo(cardX, cardY + cardH, cardX, cardY + cardH - cardRadius, cardRadius);
          ctx.lineTo(cardX, cardY + cardRadius);
          ctx.arcTo(cardX, cardY, cardX + cardRadius, cardY, cardRadius);
          ctx.closePath();
        }
        ctx.clip();

        // White card background behind image with soft fill
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cardX, cardY, cardW, cardH);

        // Draw image contained and centered within the card padding
        const imgW = imgElement.naturalWidth || imgElement.width || 1;
        const imgH = imgElement.naturalHeight || imgElement.height || 1;
        const imgRatio = imgW / imgH;
        const innerRatio = innerW / innerH;

        let drawW, drawH, drawX, drawY;
        if (imgRatio > innerRatio) {
          drawW = innerW;
          drawH = innerW / imgRatio;
          drawX = cardX + pad;
          drawY = cardY + pad + (innerH - drawH) / 2;
        } else {
          drawH = innerH;
          drawW = innerH * imgRatio;
          drawX = cardX + pad + (innerW - drawW) / 2;
          drawY = cardY + pad;
        }

        ctx.drawImage(imgElement, drawX, drawY, drawW, drawH);
        ctx.restore();
      }

      // 3. Left Side: Typography & Button Layout
      const textX = 40;
      let currentY = 40;

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Label / Tag (Uppercase, bold)
      if (label && label.trim()) {
        ctx.font = '700 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = theme.secondary || '#3B5145';
        ctx.fillText(label.trim().toUpperCase(), textX, currentY);
        currentY += 28;
      } else {
        currentY += 8;
      }

      // Title (Bold 800, line-wrapped with auto-clamping)
      ctx.font = '800 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = theme.text || '#121712';
      const maxTitleWidth = imgElement ? 364 : targetWidth - 80;
      const titleLines = wrapText(ctx, title || 'Special Promotion', maxTitleWidth);
      titleLines.forEach((line) => {
        ctx.fillText(line, textX, currentY);
        currentY += 34;
      });

      // Subtitle (Medium weight 500)
      if (subtitle && subtitle.trim()) {
        currentY += 4;
        ctx.font = '500 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = theme.secondary || '#3B5145';
        ctx.fillText(subtitle.trim(), textX, currentY);
        currentY += 24;
      }

      // "Shop now" Pill Button
      const rawBtn = (buttonText || 'Shop now').trim();
      const btnText = rawBtn.endsWith('›') || rawBtn.endsWith('>') ? rawBtn : `${rawBtn}  ›`;
      ctx.font = '700 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      const textMetrics = ctx.measureText(btnText);
      const btnPaddingX = 20;
      const btnW = Math.max(110, Math.round(textMetrics.width + btnPaddingX * 2));
      const btnH = 40;
      const btnRadius = 20;
      const btnY = Math.max(currentY + 16, targetHeight - 70);

      // Button background pill
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(textX, btnY, btnW, btnH, btnRadius);
      } else {
        ctx.moveTo(textX + btnRadius, btnY);
        ctx.lineTo(textX + btnW - btnRadius, btnY);
        ctx.arcTo(textX + btnW, btnY, textX + btnW, btnY + btnRadius, btnRadius);
        ctx.lineTo(textX + btnW, btnY + btnH - btnRadius);
        ctx.arcTo(textX + btnW, btnY + btnH, textX + btnW - btnRadius, btnY + btnH, btnRadius);
        ctx.lineTo(textX + btnRadius, btnY + btnH);
        ctx.arcTo(textX, btnY + btnH, textX, btnY + btnH - btnRadius, btnRadius);
        ctx.lineTo(textX, btnY + btnRadius);
        ctx.arcTo(textX, btnY, textX + btnRadius, btnY, btnRadius);
        ctx.closePath();
      }
      ctx.fillStyle = theme.button || '#0A7C47';
      ctx.fill();

      // Button label centered vertically
      ctx.fillStyle = theme.buttonText || '#FFFFFF';
      ctx.fillText(btnText, textX + btnPaddingX, btnY + Math.round((btnH - 14) / 2));

      // 4. Export as Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas conversion failed'));
          const finalFile = new File([blob], 'banner_composite.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve({
            file: finalFile,
            previewUrl: URL.createObjectURL(blob),
            width: targetWidth,
            height: targetHeight,
          });
        },
        'image/jpeg',
        0.92
      );
    };

    const loadImg = async () => {
      if (!imageSource) {
        renderScene(null);
        return;
      }
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        if (typeof imageSource === 'string') {
          if (imageSource.startsWith('http')) {
            try {
              const res = await fetch(imageSource, { mode: 'cors' });
              const blob = await res.blob();
              img.src = URL.createObjectURL(blob);
            } catch (_) {
              img.src = imageSource;
            }
          } else {
            img.src = imageSource;
          }
        } else if (imageSource instanceof Blob || imageSource instanceof File) {
          img.src = URL.createObjectURL(imageSource);
        } else {
          renderScene(null);
          return;
        }

        img.onload = () => {
          renderScene(img);
        };
        img.onerror = () => {
          renderScene(null);
        };
      } catch (_) {
        renderScene(null);
      }
    };

    loadImg();
  });
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  // If title wraps to more than 2 lines, truncate the 2nd line gracefully
  if (lines.length > 2) {
    let secondLine = lines[1];
    while (secondLine.length > 0 && ctx.measureText(secondLine + '...').width > maxWidth) {
      secondLine = secondLine.slice(0, -1).trim();
    }
    lines[1] = secondLine + '...';
    return [lines[0], lines[1]];
  }

  return lines;
}

