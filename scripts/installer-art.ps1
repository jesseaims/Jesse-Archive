# Generates the setup wizard images in installer/art with the colors of the app's
# default "Notte" theme (src/theme.ts). The logo comes from the original 360 px artwork
# (installer/art-source/jesse-logo-original.jpg, the same picture as public/jesse-logo.png
# at a higher resolution). Every image is produced at the exact size Inno Setup uses for
# each DPI setting, so the wizard never resamples it.
# Run again after changing the logo or the palette:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer-art.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'installer\art'
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter *.png | Remove-Item
$source = [System.Drawing.Image]::FromFile((Join-Path $root 'installer\art-source\jesse-logo-original.jpg'))

function Color([string]$hex, [int]$alpha = 255) {
    $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
    [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B)
}
$background = '#0d0e16'; $accent = '#a97ee0'; $text = '#e9eaf5'; $muted = '#9396ab'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class Art {
    // Soft radial glow blended per pixel (smooth falloff, light dithering against banding).
    public static void Glow(Bitmap bmp, double cx, double cy, double r, Color c, double strength) {
        var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * bmp.Height];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        var rnd = new Random(7);
        for (int y = 0; y < bmp.Height; y++) {
            for (int x = 0; x < bmp.Width; x++) {
                double d = Math.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / r;
                if (d >= 1) continue;
                double t = 1 - d; double a = strength * t * t * (3 - 2 * t);
                int i = y * data.Stride + x * 4;
                double n = (rnd.NextDouble() - 0.5) * 1.5;
                px[i] = Clamp(px[i] + (c.B - px[i]) * a + n);
                px[i + 1] = Clamp(px[i + 1] + (c.G - px[i + 1]) * a + n);
                px[i + 2] = Clamp(px[i + 2] + (c.R - px[i + 2]) * a + n);
            }
        }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
    }

    // Same glow on a transparent canvas: the color stays fixed and only the alpha fades,
    // so the image blends with whatever the wizard paints behind it.
    public static void GlowAlpha(Bitmap bmp, double cx, double cy, double r, Color c, double strength) {
        var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * bmp.Height];
        for (int y = 0; y < bmp.Height; y++) {
            for (int x = 0; x < bmp.Width; x++) {
                double d = Math.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / r;
                if (d >= 1) continue;
                double t = 1 - d;
                int i = y * data.Stride + x * 4;
                px[i] = c.B; px[i + 1] = c.G; px[i + 2] = c.R;
                px[i + 3] = Clamp(255 * strength * t * t * (3 - 2 * t));
            }
        }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
    }

    // Square center crop of the source, resampled to size x size with high-quality bicubic
    // (mirrored edges, no dark halo), then lightly sharpened to recover the detail that
    // downscaling softens.
    public static Bitmap Logo(Image src, int size) {
        int side = Math.Min(src.Width, src.Height);
        var crop = new Rectangle((src.Width - side) / 2, (src.Height - side) / 2, side, side);
        var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        using (var attr = new ImageAttributes()) {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.CompositingMode = CompositingMode.SourceCopy;
            attr.SetWrapMode(WrapMode.TileFlipXY);
            g.DrawImage(src, new Rectangle(0, 0, size, size), crop.X, crop.Y, crop.Width, crop.Height, GraphicsUnit.Pixel, attr);
        }
        double ratio = (double)side / size;
        if (ratio > 1.05) Sharpen(bmp, Math.Min(0.55, 0.25 + 0.12 * ratio));
        return bmp;
    }

    // Unsharp mask with a 3x3 Gaussian kernel.
    static void Sharpen(Bitmap bmp, double amount) {
        int w = bmp.Width, h = bmp.Height;
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * h];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        var res = (byte[])px.Clone();
        int[] k = { 1, 2, 1, 2, 4, 2, 1, 2, 1 };
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                for (int ch = 0; ch < 3; ch++) {
                    double blur = 0; int n = 0;
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            int xx = Math.Max(0, Math.Min(w - 1, x + dx)), yy = Math.Max(0, Math.Min(h - 1, y + dy));
                            blur += px[yy * data.Stride + xx * 4 + ch] * k[n++];
                        }
                    }
                    int i = y * data.Stride + x * 4 + ch;
                    res[i] = Clamp(px[i] + amount * (px[i] - blur / 16));
                }
            }
        }
        Marshal.Copy(res, 0, data.Scan0, res.Length);
        bmp.UnlockBits(data);
    }

    public static GraphicsPath Rounded(float x, float y, float w, float h, float r) {
        var p = new GraphicsPath();
        float d = 2 * r;
        p.AddArc(x, y, d, d, 180, 90); p.AddArc(x + w - d, y, d, d, 270, 90);
        p.AddArc(x + w - d, y + h - d, d, d, 0, 90); p.AddArc(x, y + h - d, d, d, 90, 90);
        p.CloseFigure(); return p;
    }

    // Logo with antialiased rounded corners: the pre-scaled bitmap is painted 1:1 through a
    // texture brush, so only the edge of the shape is antialiased and the picture is not
    // resampled again.
    public static void DrawLogo(Graphics g, Image src, int x, int y, int size, Color border) {
        using (var logo = Logo(src, size))
        using (var brush = new TextureBrush(logo, WrapMode.Clamp))
        using (var path = Rounded(x, y, size, size, size * 0.22f)) {
            brush.TranslateTransform(x, y);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.FillPath(brush, path);
            using (var pen = new Pen(border, Math.Max(1f, size / 80f))) {
                using (var inner = Rounded(x + pen.Width / 2, y + pen.Width / 2, size - pen.Width, size - pen.Width, size * 0.22f - pen.Width / 2))
                    g.DrawPath(pen, inner);
            }
        }
    }

    static byte Clamp(double v) { return (byte)Math.Max(0, Math.Min(255, Math.Round(v))); }
}
'@

function New-Canvas([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
    return $bmp, $g
}
function Save($bmp, $g, [string]$name) {
    $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
# Hinted grayscale antialiasing: the panel is transparent, and ClearType needs an opaque background.
function Draw-Text($g, [string]$s, [string]$family, [int]$px, [string]$hex, [float]$y, [int]$w) {
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $font = New-Object System.Drawing.Font $family, $px, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush (Color $hex)
    $format = New-Object System.Drawing.StringFormat; $format.Alignment = 'Center'
    $g.DrawString($s, $font, $brush, (New-Object System.Drawing.RectangleF 0, ([Math]::Round($y)), $w, ($px * 2)), $format)
    $font.Dispose(); $brush.Dispose(); $format.Dispose()
}

# Image area sizes from the Inno Setup 7 documentation, DPI 100% to 250%.
# Page background (aspect 497:360).
foreach ($size in @(@(596, 432), @(796, 576), @(994, 720), @(1193, 864), @(1272, 922), @(1471, 1066), @(1630, 1148))) {
    $w = $size[0]; $h = $size[1]
    $bmp, $g = New-Canvas $w $h
    $g.Clear((Color $background))
    $g.Flush()
    [Art]::Glow($bmp, $w * 0.92, $h * 0.02, $w * 0.72, (Color $accent), 0.26)
    [Art]::Glow($bmp, $w * 0.04, $h * 1.0, $w * 0.58, (Color '#5b6be0'), 0.13)
    Save $bmp $g "background-$w.png"
}

# Side panel of the welcome and finish pages (aspect 164:314).
foreach ($size in @(@(202, 386), @(269, 515), @(336, 643), @(403, 772), @(430, 824), @(498, 953), @(534, 1022))) {
    $w = $size[0]; $h = $size[1]; $s = $w / 202
    # Transparent panel: the page background shows through, so the panel has no edge of
    # its own; only a soft glow behind the logo.
    $bmp, $g = New-Canvas $w $h
    $cy = $h * 0.36
    [Art]::GlowAlpha($bmp, $w * 0.5, $cy, $w * 0.6, (Color $accent), 0.22)
    # 128 px at 100% DPI; about 340 px at 250%, still below the 360 px of the source.
    $logoSize = [int][Math]::Round(128 * $s)
    $lx = [int][Math]::Round(($w - $logoSize) / 2); $ly = [int][Math]::Round($cy - $logoSize / 2)
    [Art]::DrawLogo($g, $source, $lx, $ly, $logoSize, (Color $accent 150))
    $below = $ly + $logoSize
    Draw-Text $g "Jesse's Archive" 'Segoe UI Semibold' ([int][Math]::Round(19 * $s)) $text ($below + 14 * $s) $w
    Draw-Text $g 'Password manager' 'Segoe UI' ([int][Math]::Round(12 * $s)) $muted ($below + 44 * $s) $w
    $line = New-Object System.Drawing.Pen (Color $accent 120), ([Math]::Round(2 * $s))
    $ly2 = [Math]::Round($below + 72 * $s) + 0.5 * ($line.Width % 2)
    $g.DrawLine($line, [float]([Math]::Round($w / 2 - 18 * $s)), [float]$ly2, [float]([Math]::Round($w / 2 + 18 * $s)), [float]$ly2)
    $line.Dispose()
    Save $bmp $g "side-$w.png"
}

# Small logo in the top-right corner of the inner pages (square, transparent).
foreach ($n in 58, 77, 97, 116, 124, 143, 159) {
    $bmp, $g = New-Canvas $n $n
    $g.Clear([System.Drawing.Color]::Transparent)
    $pad = [int][Math]::Round($n * 0.06)
    [Art]::DrawLogo($g, $source, $pad, $pad, $n - 2 * $pad, (Color $accent 150))
    Save $bmp $g "small-$n.png"
}
$source.Dispose()
Get-ChildItem $out -Filter *.png | ForEach-Object { '{0,-20} {1,8}' -f $_.Name, $_.Length }
